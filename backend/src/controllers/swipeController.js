import pool from '../db.js';
import { log } from '../utils/logger.js';
import { parseLimit, parseCursor, toPage, isUuid } from '../utils/pagination.js';

// POST /api/swipes { swiped_id, action: 'yes' | 'no' }
// El match mutuo se crea aquí, dentro de una transacción con bloqueo por pareja: si dos personas se dan
// "sí" a la vez, la segunda transacción espera a la primera y ve su swipe (no se pierde ningún match).
export const createSwipe = async (req, res) => {
  const { swiped_id, action } = req.body ?? {};
  const swiper_id = req.user.id;

  if (!isUuid(swiped_id) || !['yes', 'no'].includes(action)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (swiped_id.toLowerCase() === String(swiper_id).toLowerCase()) {
    return res.status(400).json({ error: 'Cannot swipe yourself' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pair = [swiper_id, swiped_id].map((id) => id.toLowerCase()).sort().join(':');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`swipe:${pair}`]);

    const swipe = await client.query(
      `INSERT INTO swipes (from_user_id, to_user_id, direction) VALUES ($1, $2, $3)
       RETURNING id, to_user_id AS swiped_id, direction AS action, created_at`,
      [swiper_id, swiped_id, action]
    );

    let match = null;
    if (action === 'yes') {
      // Orden canónico (menor id primero) para que la pareja no se duplique como (A,B) y (B,A)
      const created = await client.query(
        `INSERT INTO matches (user_1_id, user_2_id)
         SELECT LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid)
         WHERE EXISTS (
           SELECT 1 FROM swipes WHERE from_user_id = $2::uuid AND to_user_id = $1::uuid AND direction = 'yes'
         )
         ON CONFLICT (user_1_id, user_2_id) DO NOTHING
         RETURNING id, created_at`,
        [swiper_id, swiped_id]
      );
      if (created.rows[0]) match = { ...created.rows[0], matched_user_id: swiped_id };
    }

    await client.query('COMMIT');
    res.status(201).json({ swipe: swipe.rows[0], match });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    log('ERROR', 'create swipe failed', { code: err.code, message: err.message });
    if (err.code === '23505') {
      res.status(409).json({ error: 'Already swiped this profile' });
    } else if (err.code === '23503') {
      res.status(404).json({ error: 'Profile not found' });
    } else {
      res.status(500).json({ error: 'Failed to record swipe' });
    }
  } finally {
    client.release();
  }
};

// GET /api/swipes/matches?limit=10&cursor=<opaco>
// Respuesta: { data: [...], next_cursor: "<opaco>" | null }. Solo datos del OTRO usuario, nunca su email.
export const getMatches = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);
    if (cursor === false) return res.status(400).json({ error: 'Invalid cursor' });

    const values = [userId];
    let cursorClause = '';
    if (cursor) {
      values.push(cursor.ts, cursor.id);
      cursorClause = 'AND (m.created_at, m.id) < ($2::timestamp, $3::uuid)';
    }
    values.push(limit + 1);

    const result = await pool.query(
      `SELECT m.id, m.created_at, m.created_at::text AS cursor_ts, p.user_id AS matched_user_id,
              p.photo_url, p.description, p.age, p.location, p.neurodivergence_type AS neurotipo
       FROM matches m
       JOIN profiles p ON p.user_id = CASE WHEN m.user_1_id = $1 THEN m.user_2_id ELSE m.user_1_id END
       WHERE (m.user_1_id = $1 OR m.user_2_id = $1) ${cursorClause}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $${values.length}`,
      values
    );

    res.json(toPage(result.rows, limit));
  } catch (err) {
    log('ERROR', 'get matches failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
};
