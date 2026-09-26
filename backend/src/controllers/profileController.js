import pool from '../db.js';
import { log } from '../utils/logger.js';
import { parseLimit, parseCursor, toPage } from '../utils/pagination.js';

export const NEUROTIPOS = ['TDAH', 'Autismo', 'Dislexia', 'Dispraxia', 'No diagnosticado', 'Prefiero no decir'];
const FEED_COLUMNS = 'p.id, p.user_id, p.photo_url, p.description, p.age, p.location, p.neurotipo, p.created_at';

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
    const { description, age, location, neurotipo } = req.body ?? {};
    const userId = req.user.id;

    const error = validateProfile({ description, age, location, neurotipo });
    if (error) return res.status(400).json({ error });

    const result = await pool.query(
      'INSERT INTO profiles (user_id, description, age, location, neurotipo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, description, toAge(age), location, neurotipo]
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
    const { description, age, location, neurotipo, photo_url } = req.body ?? {};
    const userId = req.user.id;

    const error = validateProfile({ description, age, location, neurotipo }, { partial: true });
    if (error) return res.status(400).json({ error });
    if (photo_url !== undefined && (typeof photo_url !== 'string' || photo_url.length > 500)) {
      return res.status(400).json({ error: 'Invalid photo_url' });
    }

    const updates = [];
    const values = [userId];
    const set = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (description !== undefined) set('description', description);
    if (age !== undefined) set('age', toAge(age));
    if (location !== undefined) set('location', location);
    if (neurotipo !== undefined) set('neurotipo', neurotipo);
    if (photo_url !== undefined) set('photo_url', photo_url);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await pool.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $1 RETURNING *`,
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

export const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'SELECT id, user_id, photo_url, description, age, location, neurotipo, created_at FROM profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    log('ERROR', 'get profile failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// GET /api/profiles/feed?limit=10&cursor=<id>&age_min=&age_max=&location=&neurotipo=
// Respuesta: { data: [...], next_cursor: "<id>" | null }
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
    if (location && (typeof location !== 'string' || location.length > 100)) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    const values = [userId];
    const where = [
      'p.user_id <> $1',
      // NOT EXISTS aprovecha el índice único de swipes (swiper_id, swiped_id); NOT IN no escala
      'NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = $1 AND s.swiped_id = p.user_id)'
    ];
    const add = (clause, value) => {
      values.push(value);
      where.push(clause.replace('?', `$${values.length}`));
    };

    if (cursor) add('p.id < ?', cursor);
    if (age_min) add('p.age >= ?', toAge(age_min));
    if (age_max) add('p.age <= ?', toAge(age_max));
    if (location) add('p.location = ?', location);
    if (neurotipo) add('p.neurotipo = ?', neurotipo);

    values.push(limit + 1);
    const result = await pool.query(
      `SELECT ${FEED_COLUMNS} FROM profiles p WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT $${values.length}`,
      values
    );

    res.json(toPage(result.rows, limit));
  } catch (err) {
    log('ERROR', 'get feed failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
};
