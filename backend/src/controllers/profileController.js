import pool from '../db.js';
import { log } from '../utils/logger.js';
import { parseLimit, parseCursor, toPage } from '../utils/pagination.js';
import { sanitizeText } from '../utils/sanitize.js';
import { sniffImageMime, cleanImage, replaceProfilePhoto, isOwnPhotoUrl } from '../utils/storage.js';
import { countSwipesToday, DAILY_SWIPE_LIMIT } from './swipeController.js';
import { sortByPerception, matchReason, DIMENSIONS, pickPerc, stripPerc } from '../utils/perception.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_NEUROTIPOS = 6; // varias etiquetas están bien (TDAH + TEA...), todas a la vez ya no informa nada

// La API expone `neurotipos` (lista); en la BD la columna es `neurodivergence_types` (array).
// Incluye "Neurotípico" (Nura no es solo para personas diagnosticadas) y "Sin diagnóstico formal"
// como una etiqueta más, no un campo aparte: se marca junto a lo que se sospecha tener.
export const NEUROTIPOS = [
  'TDAH',
  'TEA/Autismo',
  'Dislexia',
  'Discalculia',
  'Dispraxia',
  'PAS (Alta Sensibilidad)',
  'AACC (Altas Capacidades)',
  'TOC',
  'Tourette',
  'TLP',
  'Neurotípico',
  'Sin diagnóstico formal',
  'Prefiero no decir'
];
// Qué busca la persona (US-006: "intención explícita", pedido por la persona de Carlos). Una sola
// opción, no varias: es "qué buscas ahora mismo", no una lista de posibilidades a la vez.
export const INTENTIONS = ['Relación', 'Amistad', 'Aún no lo sé'];

const COLUMNS = `id, user_id, photo_url, description, age, location, neurodivergence_types AS neurotipos, intention, created_at,
  perc_ritmo, perc_estructura, perc_sensorial, perc_comunicacion, perc_emocional, perc_social, connection_note`;
// La foto REAL no va en el feed (solo avatar derivado de user_id). Sí van los perc_* crudos y connection_note:
// se usan para ordenar y para el porqué cualitativo, y los perc_* se eliminan antes de responder (ver getFeed).
const FEED_COLUMNS = `p.id, p.user_id, p.description, p.age, p.location,
  p.neurodivergence_types AS neurotipos, p.intention, p.created_at, p.created_at::text AS cursor_ts,
  p.perc_ritmo, p.perc_estructura, p.perc_sensorial, p.perc_comunicacion, p.perc_emocional, p.perc_social, p.connection_note`;

// Texto libre: se limpia (control, HTML) antes de validar longitud y de guardar
const clean = (value) => (typeof value === 'string' ? sanitizeText(value) : value);

const toAge = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 18 && n <= 120 ? n : null;
};

// Lista válida: array de strings de NEUROTIPOS, sin repetidos, 1-6 elementos. null = campo ausente.
const validNeurotipos = (value) => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_NEUROTIPOS) return null;
  const unique = [...new Set(value)];
  if (unique.length !== value.length || !unique.every((v) => NEUROTIPOS.includes(v))) return null;
  return unique;
};

// photo_url (si viene) solo puede ser una foto de la carpeta propia del bucket (ver isOwnPhotoUrl).
// Devuelve el mensaje de error o null. Compartido entre crear y actualizar perfil.
const photoUrlError = (userId, photo_url) =>
  photo_url !== undefined && !isOwnPhotoUrl(userId, photo_url) ? 'Invalid photo_url' : null;

// Devuelve un mensaje de error o null. Con `partial`, solo valida los campos presentes.
// `perc` mapea cada columna perc_* (ver DIMENSIONS) a su valor del body. La percepción y el manual de
// conexión nunca son obligatorios (cuestionario progresivo): solo se validan los que vienen.
const validateProfile = ({ description, age, location, neurotipos, intention, connection_note, perc = {} }, { partial = false } = {}) => {
  const missing = (v) => v === undefined || v === null || v === '';
  const present = (v) => v !== undefined && v !== null; // null/undefined = ausente (modo progresivo/partial)
  if (!partial && [description, age, location, intention].some(missing)) return 'Missing required fields';
  if (!partial && neurotipos === undefined) return 'Missing required fields';
  if (!missing(description) && (typeof description !== 'string' || description.length > 200)) return 'Description max 200 chars';
  if (!missing(age) && toAge(age) === null) return 'Age must be 18-120';
  if (!missing(location) && (typeof location !== 'string' || location.length > 100)) return 'Invalid location';
  if (neurotipos !== undefined && validNeurotipos(neurotipos) === null) return 'Invalid neurotipos';
  if (!missing(intention) && !INTENTIONS.includes(intention)) return 'Invalid intention';
  if (present(connection_note) && (typeof connection_note !== 'string' || connection_note.length > 200)) return 'Invalid connection_note';
  for (const { column } of DIMENSIONS) {
    const v = perc[column];
    if (present(v) && !(Number.isInteger(v) && v >= 1 && v <= 5)) return 'Invalid perception value';
  }
  return null;
};

export const createProfile = async (req, res) => {
  try {
    const { age, neurotipos, intention, photo_url } = req.body ?? {};
    const description = clean(req.body?.description);
    const location = clean(req.body?.location);
    const connection_note = clean(req.body?.connection_note);
    // perc_* del body, por columna (null = sin responder: la percepción es progresiva, nunca obligatoria)
    const perc = {};
    for (const { column } of DIMENSIONS) perc[column] = req.body?.[column];
    const userId = req.user.id;

    const error = validateProfile({ description, age, location, neurotipos, intention, connection_note, perc }) || photoUrlError(userId, photo_url);
    if (error) return res.status(400).json({ error });

    const result = await pool.query(
      `INSERT INTO profiles (user_id, description, age, location, neurodivergence_types, intention, photo_url,
         perc_ritmo, perc_estructura, perc_sensorial, perc_comunicacion, perc_emocional, perc_social, connection_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING ${COLUMNS}`,
      [userId, description, toAge(age), location, validNeurotipos(neurotipos), intention, photo_url ?? null,
       perc.perc_ritmo ?? null, perc.perc_estructura ?? null, perc.perc_sensorial ?? null,
       perc.perc_comunicacion ?? null, perc.perc_emocional ?? null, perc.perc_social ?? null,
       connection_note ?? null]
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
    const { age, neurotipos, intention, photo_url } = req.body ?? {};
    const description = clean(req.body?.description);
    const location = clean(req.body?.location);
    const connection_note = clean(req.body?.connection_note);
    const perc = {};
    for (const { column } of DIMENSIONS) perc[column] = req.body?.[column];
    const userId = req.user.id;

    const error = validateProfile({ description, age, location, neurotipos, intention, connection_note, perc }, { partial: true }) || photoUrlError(userId, photo_url);
    if (error) return res.status(400).json({ error });

    const updates = ['updated_at = NOW()'];
    const values = [userId];
    const set = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (description !== undefined) set('description', description);
    if (age !== undefined) set('age', toAge(age));
    if (location !== undefined) set('location', location);
    if (neurotipos !== undefined) set('neurodivergence_types', validNeurotipos(neurotipos));
    if (intention !== undefined) set('intention', intention);
    if (photo_url !== undefined) set('photo_url', photo_url);
    if (connection_note !== undefined) set('connection_note', connection_note);
    // perc_* como enteros (ya validados 1–5); solo los presentes se actualizan (cuestionario progresivo)
    for (const { column } of DIMENSIONS) if (perc[column] !== undefined) set(column, perc[column]);

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

    let clean;
    try {
      clean = await cleanImage(req.file.buffer, mime);
    } catch {
      // Cabecera de JPEG/PNG pero contenido corrupto, truncado o demasiado grande al descomprimir
      return res.status(400).json({ error: 'Photo could not be processed' });
    }

    const existing = await pool.query('SELECT photo_url FROM profiles WHERE user_id = $1', [req.user.id]);
    const photo_url = await replaceProfilePhoto(req.user.id, clean, mime, existing.rows[0]?.photo_url);

    res.status(201).json({ photo_url });
  } catch (err) {
    log('ERROR', 'upload photo failed', { message: err.message });
    res.status(500).json({ error: 'Failed to upload photo' });
  }
};

// GET /api/profiles/me — SOLO el perfil propio (sale de la sesión, sin id en la ruta). Los perfiles
// ajenos llegan por el feed (los que aún no has valorado) o por tus matches; no hay forma de pedir el de
// otra persona por id. Esto evitaba que quien fue bloqueado siguiera consultando el perfil actualizado
// (ubicación incluida) de quien le bloqueó.
export const getMyProfile = async (req, res) => {
  try {
    const result = await pool.query(`SELECT ${COLUMNS} FROM profiles WHERE user_id = $1`, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    log('ERROR', 'get profile failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Tope de perfiles SERVIDOS al día (no solo valorados): sin él, el feed se recorría con el cursor sin hacer
// ningún swipe y se bajaba a todos los usuarios con su neurotipo (dato de salud). 10x el tope de swipes:
// de sobra para valorar 15 y cambiar de filtros varias veces; un scraper se queda en 150 por cuenta y día.
export const FEED_DAILY_CAP = DAILY_SWIPE_LIMIT * 10;

// Reserva en UNA sentencia y devuelve cuántos perfiles puede servir esta petición. `FOR UPDATE` bloquea la
// fila del usuario: peticiones en paralelo esperan su turno y no pueden pasarse del tope entre las dos.
// El contador se reinicia solo al cambiar de día (UTC).
const reserveFeedQuota = async (userId, wanted) => {
  const { rows } = await pool.query(
    `WITH cur AS (
       SELECT CASE WHEN feed_served_on = CURRENT_DATE THEN feed_served_count ELSE 0 END AS used
       FROM users WHERE id = $1 FOR UPDATE
     ), g AS (
       SELECT used, LEAST($2::int, GREATEST(0, $3::int - used)) AS granted FROM cur
     )
     UPDATE users u SET feed_served_count = g.used + g.granted, feed_served_on = CURRENT_DATE
     FROM g WHERE u.id = $1
     RETURNING g.granted`,
    [userId, wanted, FEED_DAILY_CAP]
  );
  return rows[0]?.granted ?? 0;
};

const refundFeedQuota = (userId, unused) =>
  pool.query(
    'UPDATE users SET feed_served_count = GREATEST(0, feed_served_count - $2) WHERE id = $1 AND feed_served_on = CURRENT_DATE',
    [userId, unused]
  );

// GET /api/profiles/feed?limit=10&cursor=<opaco>&age_min=&age_max=&location=&neurotipos=TDAH&neurotipos=TEA
// Filtra por solape: cualquier perfil que comparta AL MENOS una de las etiquetas pedidas.
// Respuesta: { data: [...], next_cursor: "<opaco>" | null }
export const getFeed = async (req, res) => {
  try {
    const { age_min, age_max, location } = req.query;
    const neurotipos = req.query.neurotipos === undefined ? [] : [].concat(req.query.neurotipos);
    const userId = req.user.id;
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);

    if (cursor === false) return res.status(400).json({ error: 'Invalid cursor' });
    if ((age_min && toAge(age_min) === null) || (age_max && toAge(age_max) === null)) {
      return res.status(400).json({ error: 'Age filter must be 18-120' });
    }
    if (neurotipos.length > 0 && !neurotipos.every((v) => NEUROTIPOS.includes(v))) {
      return res.status(400).json({ error: 'Invalid neurotipos' });
    }
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
    if (neurotipos.length > 0) add('p.neurodivergence_types && ?::text[]', neurotipos);

    const swipesToday = await countSwipesToday(userId);
    const granted = await reserveFeedQuota(userId, limit);
    if (granted === 0) {
      return res.json({ data: [], next_cursor: null, feed_limit_reached: true, swipes_today: swipesToday, daily_limit: DAILY_SWIPE_LIMIT });
    }

    values.push(granted + 1);
    const result = await pool.query(
      `SELECT ${FEED_COLUMNS} FROM profiles p
       WHERE ${where.join(' AND ')}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $${values.length}`,
      values
    );

    const page = toPage(result.rows, granted); // el cursor sale de aquí, con el orden cronológico real
    // Solo cuenta lo que de verdad se sirvió: una página corta (fin del feed, filtros estrechos) devuelve el resto
    if (page.data.length < granted) await refundFeedQuota(userId, granted - page.data.length);

    // Mi percepción, para ordenar y para el porqué cualitativo del match.
    const mine = await pool.query(
      `SELECT perc_ritmo, perc_estructura, perc_sensorial, perc_comunicacion, perc_emocional, perc_social
         FROM profiles WHERE user_id = $1`,
      [userId]
    );
    const myPerc = mine.rows[0] ?? null;
    if (myPerc) page.data = sortByPerception(myPerc, page.data); // null → sin reordenar (cronológico)
    // match_reason cualitativo; NO se exponen los perc_* crudos de la otra persona (son datos íntimos)
    page.data = page.data.map((card) => ({ ...stripPerc(card), match_reason: matchReason(myPerc, pickPerc(card)) }));

    res.json({ ...page, swipes_today: swipesToday, daily_limit: DAILY_SWIPE_LIMIT });
  } catch (err) {
    log('ERROR', 'get feed failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
};
