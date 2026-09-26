import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { log, audit, ipTag } from '../utils/logger.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignora lo que pase de 72 bytes
const MAX_FAILED_LOGINS = 5; // intentos fallidos antes de bloquear la cuenta
const LOCK_MINUTES = 15;
// Hash de relleno: login compara siempre contra un hash, exista o no el usuario (evita enumerar por tiempo)
const DUMMY_HASH = bcrypt.hashSync('nura-dummy-password', 10);

const readCredentials = (body) => {
  const { email, password } = body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return null;
  return { email: email.trim().toLowerCase(), password };
};

// `tv` (token_version) permite restablecer todas las sesiones de un usuario (ver logoutAll)
const signToken = (user, tokenVersion = 0) =>
  jwt.sign({ id: user.id, email: user.email, tv: tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256'
  });

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
    audit('signup_ok', { user_id: user.id, ip: ipTag(req) });

    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    log('ERROR', 'signup failed', { code: err.code, message: err.message });
    if (err.code === '23505') {
      audit('signup_duplicate', { ip: ipTag(req) });
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Signup failed' });
    }
  }
};

// Suma un fallo y bloquea la cuenta al llegar al máximo. Si un bloqueo anterior ya caducó,
// la cuenta empieza a contar de nuevo desde 1 (en un solo UPDATE atómico).
const registerFailedLogin = (userId) =>
  pool.query(
    `UPDATE users SET
       failed_logins = CASE WHEN locked_until IS NOT NULL AND locked_until <= NOW() THEN 1 ELSE failed_logins + 1 END,
       locked_until = CASE
         WHEN locked_until IS NOT NULL AND locked_until <= NOW() THEN NULL
         WHEN failed_logins + 1 >= $2 THEN NOW() + make_interval(mins => $3)
         ELSE locked_until
       END
     WHERE id = $1`,
    [userId, MAX_FAILED_LOGINS, LOCK_MINUTES]
  );

export const login = async (req, res) => {
  try {
    const creds = readCredentials(req.body);
    if (!creds) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const { email, password } = creds;

    const result = await pool.query(
      'SELECT id, email, password_hash, token_version, failed_logins, locked_until FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    const locked = Boolean(user?.locked_until && new Date(user.locked_until) > new Date());
    // Se compara siempre (aunque la cuenta no exista o esté bloqueada) para que el tiempo no delate nada
    const passwordMatch = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || locked || !passwordMatch) {
      if (user && !locked) await registerFailedLogin(user.id);
      audit(locked ? 'login_blocked_locked' : 'login_failed', { user_id: user?.id ?? null, ip: ipTag(req) });
      // Misma respuesta en los tres casos: no revela si el email existe ni si está bloqueado
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.failed_logins > 0 || user.locked_until) {
      await pool.query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);
    }
    audit('login_ok', { user_id: user.id, ip: ipTag(req) });

    res.json({ user: { id: user.id, email: user.email }, token: signToken(user, user.token_version) });
  } catch (err) {
    log('ERROR', 'login failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Login failed' });
  }
};

// POST /api/auth/logout-all (requiere sesión): invalida TODOS los tokens vigentes del usuario,
// incluido el actual. Para "cerrar sesión en todos los dispositivos" o tras un cambio de contraseña.
export const logoutAll = async (req, res) => {
  try {
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
    audit('sessions_reset', { user_id: req.user.id, ip: ipTag(req) });
    res.json({ ok: true });
  } catch (err) {
    log('ERROR', 'logout-all failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to reset sessions' });
  }
};
