import { Pool } from 'pg';
import { log } from '../utils/logger.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const createProfile = async (req, res) => {
  try {
    const { description, age, location, neurotipo } = req.body;
    const userId = req.user.id;

    if (!description || !age || !location || !neurotipo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (age < 18 || age > 120) {
      return res.status(400).json({ error: 'Age must be 18-120' });
    }

    if (description.length > 200) {
      return res.status(400).json({ error: 'Description max 200 chars' });
    }

    const result = await pool.query(
      'INSERT INTO profiles (user_id, description, age, location, neurotipo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, description, age, location, neurotipo]
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
    const { description, age, location, neurotipo, photo_url } = req.body;
    const userId = req.user.id;

    if (age && (age < 18 || age > 120)) {
      return res.status(400).json({ error: 'Age must be 18-120' });
    }

    if (description && description.length > 200) {
      return res.status(400).json({ error: 'Description max 200 chars' });
    }

    const updates = [];
    const values = [userId];
    let paramCount = 2;

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (age !== undefined) {
      updates.push(`age = $${paramCount++}`);
      values.push(age);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (neurotipo !== undefined) {
      updates.push(`neurotipo = $${paramCount++}`);
      values.push(neurotipo);
    }
    if (photo_url !== undefined) {
      updates.push(`photo_url = $${paramCount++}`);
      values.push(photo_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE profiles SET ${updates.join(', ')} WHERE user_id = $1 RETURNING *`;
    const result = await pool.query(query, values);

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

export const getFeed = async (req, res) => {
  try {
    const { age_min, age_max, location, neurotipo, limit = 10, offset = 0 } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT p.id, p.user_id, p.photo_url, p.description, p.age, p.location, p.neurotipo, p.created_at
      FROM profiles p
      WHERE p.user_id != $1
      AND p.user_id NOT IN (
        SELECT swiped_id FROM swipes WHERE swiper_id = $1
      )
    `;

    const values = [userId];
    let paramCount = 2;

    if (age_min) {
      query += ` AND p.age >= $${paramCount++}`;
      values.push(age_min);
    }

    if (age_max) {
      query += ` AND p.age <= $${paramCount++}`;
      values.push(age_max);
    }

    if (location) {
      query += ` AND p.location = $${paramCount++}`;
      values.push(location);
    }

    if (neurotipo) {
      query += ` AND p.neurotipo = $${paramCount++}`;
      values.push(neurotipo);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    log('ERROR', 'get feed failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
};
