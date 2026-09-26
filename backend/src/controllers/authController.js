import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { log } from '../utils/logger.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignora lo que pase de 72 bytes
// Hash de relleno: login compara siempre contra un hash, exista o no el usuario (evita enumerar por tiempo)
const DUMMY_HASH = bcrypt.hashSync('nura-dummy-password', 10);

const readCredentials = (body) => {
  const { email, password } = body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return null;
  return { email: email.trim().toLowerCase(), password };
};

export const signup = async (req, res) => {
  try {
    const creds = readCredentials(req.body);
    if (!creds) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const { email, password } = creds;

    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (password.length < MIN_PASSWORD || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
      return res.status(400).json({ error: 'Password must be 8-72 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.status(201).json({ user, token });
  } catch (err) {
    log('ERROR', 'signup failed', { code: err.code, message: err.message });
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Signup failed' });
    }
  }
};

export const login = async (req, res) => {
  try {
    const creds = readCredentials(req.body);
    if (!creds) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const { email, password } = creds;

    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    log('ERROR', 'login failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Login failed' });
  }
};
