import { Pool } from 'pg';
import { log } from '../utils/logger.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const createSwipe = async (req, res) => {
  try {
    const { swiped_id, action } = req.body;
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
    } else {
      res.status(500).json({ error: 'Failed to record swipe' });
    }
  }
};

export const getMatches = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT m.*,
        p1.photo_url AS photo_url,
        u1.email,
        CASE WHEN m.user_a = $1 THEN p2.description ELSE p1.description END AS description,
        CASE WHEN m.user_a = $1 THEN p2.age ELSE p1.age END AS age,
        CASE WHEN m.user_a = $1 THEN u2.id ELSE u1.id END AS matched_user_id
       FROM matches m
       LEFT JOIN profiles p1 ON p1.user_id = m.user_a
       LEFT JOIN profiles p2 ON p2.user_id = m.user_b
       LEFT JOIN users u1 ON u1.id = m.user_a
       LEFT JOIN users u2 ON u2.id = m.user_b
       WHERE m.user_a = $1 OR m.user_b = $1
       ORDER BY m.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    log('ERROR', 'get matches failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
};
