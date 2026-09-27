import pool from '../db.js';
import { log } from '../utils/logger.js';
import { parseLimit, parseCursor, toPage, isUuid } from '../utils/pagination.js';
import { sanitizeText } from '../utils/sanitize.js';
import { sniffImageMime, replaceProfilePhoto } from '../utils/storage.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// La API expone `neurotipo`; en la BD la columna es `neurodivergence_type`.
export const NEUROTIPOS = ['TDAH', 'Autismo', 'Dislexia', 'Dispraxia', 'No diagnosticado', 'Prefiero no decir'];
const COLUMNS = 'id, user_id, photo_url, description, age, location, neurodivergence_type AS neurotipo, created_at';
const FEED_COLUMNS = `p.id, p.user_id, p.photo_url, p.description, p.age, p.location,
  p.neurodivergence_type AS neurotipo, p.created_at, p.created_at::text AS cursor_ts`;

// Texto libre: se limpia (control, HTML) antes de validar longitud y de guardar
const clean = (value) => (typeof value === 'string' ? sanitizeText(value) : value);

const toAge = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 18 && n <= 120 ? n : null;
};

// Devuelve un mensaje de error o null. Con `partial`, solo valida los campos presentes.
const validateProfile = ({ description, age, location, neurotipo }, { partial = false } = {}) => {
  const missing = (v) => v === undefined || v === null || v === '';
  if (!partial && [description, age, location, neurotipo].some(missing)) return 'Missing required fields';
  if (!missing(description) && (typeof description !== 'string' || description.length > 200)) return 'Description max 200 chars';
  if (!missing(age) && toAge(age) === null) return 'Age must be 18-120';
  if (!missing(location) && (typeof location !== 'string' || location.length > 100)) return 'Invalid location';
  if (!missing(neurotipo) && !NEUROTIPOS.includes(neurotipo)) return 'Invalid neurotipo';
  return null;
};

export const createProfile = async (req, res) => {
  try {
    const { age, neurotipo, photo_url } = req.body ?? {};
    const description = clean(req.body?.description);
    const location = clean(req.body?.location);
    const userId = req.user.id;

    const error = validateProfile({ description, age, location, neurotipo });
    if (error) return res.status(400).json({ error });
    if (photo_url !== undefined && (typeof photo_url !== 'string' || photo_url.length > 500)) {
      return res.status(400).json({ error: 'Invalid photo_url' });
    }

    const result = await pool.query(
      `INSERT INTO profiles (user_id, description, age, location, neurodivergence_type, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
      [userId, description, toAge(age), location, neurotipo, photo_url ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    log('ERROR', 'create profile failed', { code: err.code, message: err.message });
    if (err.code === '23505') {
      res.status(409).json({ error: 'Profile already exists for this user' });
    } else {
      res.status(500).json({ error: 'Failed to create profile' });
    }
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { age, neurotipo, photo_url } = req.body ?? {};
    const description = clean(req.body?.description);
    const location = clean(req.body?.location);
    const userId = req.user.id;

    const error = validateProfile({ description, age, location, neurotipo }, { partial: true });
    if (error) return res.status(400).json({ error });
    if (photo_url !== undefined && (typeof photo_url !== 'string' || photo_url.length > 500)) {
      return res.status(400).json({ error: 'Invalid photo_url' });
    }

    const updates = ['updated_at = NOW()'];
    const values = [userId];
    const set = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (description !== undefined) set('description', description);
    if (age !== undefined) set('age', toAge(age));
    if (location !== undefined) set('location', location);
    if (neurotipo !== undefined) set('neurodivergence_type', neurotipo);
    if (photo_url !== undefined) set('photo_url', photo_url);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await pool.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $1 RETURNING ${COLUMNS}`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    log('ERROR', 'update profile failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// POST /api/profiles/photo (multipart/form-data, campo "photo"). Devuelve { photo_url }; el cliente
// la incluye al crear o editar su perfil (aquí no se toca la BD, solo el almacenamiento de objetos).
export const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo required' });
    if (req.file.size > MAX_PHOTO_BYTES) return res.status(400).json({ error: 'Photo must be 5MB or less' });

    // No fiarse del mimetype que manda el navegador: se comprueba la cabecera real del fichero
    const mime = sniffImageMime(req.file.buffer);
    if (!mime) return res.status(400).json({ error: 'Photo must be JPEG or PNG' });

    const existing = await pool.query('SELECT photo_url FROM profiles WHERE user_id = $1', [req.user.id]);
    const photo_url = await replaceProfilePhoto(req.user.id, req.file.buffer, mime, existing.rows[0]?.photo_url);

    res.status(201).json({ photo_url });
  } catch (err) {
    log('ERROR', 'upload photo failed', { message: err.message });
    res.status(500).json({ error: 'Failed to upload photo' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(404).json({ error: 'Profile not found' });

    const result = await pool.query(`SELECT ${COLUMNS} FROM profiles WHERE user_id = $1`, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    log('ERROR', 'get profile failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// GET /api/profiles/feed?limit=10&cursor=<opaco>&age_min=&age_max=&location=&neurotipo=
// Respuesta: { data: [...], next_cursor: "<opaco>" | null }
export const getFeed = async (req, res) => {
  try {
    const { age_min, age_max, location, neurotipo } = req.query;
    const userId = req.user.id;
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);

    if (cursor === false) return res.status(400).json({ error: 'Invalid cursor' });
    if ((age_min && toAge(age_min) === null) || (age_max && toAge(age_max) === null)) {
      return res.status(400).json({ error: 'Age filter must be 18-120' });
    }
    if (neurotipo && !NEUROTIPOS.includes(neurotipo)) return res.status(400).json({ error: 'Invalid neurotipo' });
    const cleanLocation = clean(location);
    if (cleanLocation && (typeof cleanLocation !== 'string' || cleanLocation.length > 100)) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    const values = [userId];
    const where = [
      'p.user_id <> $1',
      // NOT EXISTS aprovecha el índice único de swipes (from_user_id, to_user_id); NOT IN no escala
      'NOT EXISTS (SELECT 1 FROM swipes s WHERE s.from_user_id = $1 AND s.to_user_id = p.user_id)'
    ];
    const add = (clause, ...params) => {
      let i = values.length;
      values.push(...params);
      where.push(clause.replace(/\?/g, () => `$${++i}`));
    };

    if (cursor) add('(p.created_at, p.id) < (?::timestamp, ?::uuid)', cursor.ts, cursor.id);
    if (age_min) add('p.age >= ?', toAge(age_min));
    if (age_max) add('p.age <= ?', toAge(age_max));
    if (cleanLocation) add('p.location = ?', cleanLocation);
    if (neurotipo) add('p.neurodivergence_type = ?', neurotipo);

    values.push(limit + 1);
    const result = await pool.query(
      `SELECT ${FEED_COLUMNS} FROM profiles p
       WHERE ${where.join(' AND ')}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $${values.length}`,
      values
    );

    res.json(toPage(result.rows, limit));
  } catch (err) {
    log('ERROR', 'get feed failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
};
