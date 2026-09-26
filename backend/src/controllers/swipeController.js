import pool from '../db.js';
import { log } from '../utils/logger.js';
import { parseLimit, parseCursor, toPage } from '../utils/pagination.js';

export const createSwipe = async (req, res) => {
  try {
    const { swiped_id, action } = req.body ?? {};
    const swiper_id = req.user.id;

    if (!swiped_id || !action || !['yes', 'no'].includes(action)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (swiper_id === parseInt(swiped_id)) {
      return res.status(400).json({ error: 'Cannot swipe yourself' });
    }

    const result = await pool.query(
      'INSERT INTO swipes (swiper_id, swiped_id, action) VALUES ($1, $2, $3) RETURNING *',
      [swiper_id, swiped_id, action]
    );

    // Check if match was created
    const matchCheck = await pool.query(
      'SELECT * FROM matches WHERE (user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1)',
      [swiper_id, swiped_id]
    );

    res.status(201).json({
      swipe: result.rows[0],
      match: matchCheck.rows[0] || null
    });
  } catch (err) {
    log('ERROR', 'create swipe failed', { code: err.code, message: err.message });
    if (err.code === '23505') {
      res.status(409).json({ error: 'Already swiped this profile' });
    } else if (err.code === '23503') {
      res.status(404).json({ error: 'Profile not found' });
    } else {
      res.status(500).json({ error: 'Failed to record swipe' });
    }
  }
};

// GET /api/swipes/matches?limit=10&cursor=<id>
// Respuesta: { data: [...], next_cursor: "<id>" | null }. Solo datos del OTRO usuario, nunca su email.
export const getMatches = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);
    if (cursor === false) return res.status(400).json({ error: 'Invalid cursor' });

    const values = [userId];
    let cursorClause = '';
    if (cursor) {
      values.push(cursor);
      cursorClause = `AND m.id < $${values.length}`;
    }
    values.push(limit + 1);

    const result = await pool.query(
      `SELECT m.id, m.created_at, p.user_id AS matched_user_id,
              p.photo_url, p.description, p.age, p.location, p.neurotipo
       FROM matches m
       JOIN profiles p ON p.user_id = CASE WHEN m.user_a = $1 THEN m.user_b ELSE m.user_a END
       WHERE (m.user_a = $1 OR m.user_b = $1) ${cursorClause}
       ORDER BY m.id DESC
       LIMIT $${values.length}`,
      values
    );

    res.json(toPage(result.rows, limit));
  } catch (err) {
    log('ERROR', 'get matches failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
};
