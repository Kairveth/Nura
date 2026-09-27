import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { log, audit, ipTag } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignora lo que pase de 72 bytes
const MAX_FAILED_LOGINS = 5; // intentos fallidos antes de bloquear la cuenta
const LOCK_MINUTES = 15;
const RESET_TOKEN_MINUTES = 30;
const RESET_COOLDOWN_SECONDS = 120; // no reenviar el email si ya se pidió hace menos de esto
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

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const GENERIC_RESET_MESSAGE = 'Si existe una cuenta con ese email, te hemos enviado un enlace para restablecer la contraseña.';

// POST /api/auth/forgot-password { email }. Responde SIEMPRE el mismo mensaje, exista o no la
// cuenta (evita enumeración): el email es el único canal por el que se sabe si funcionó de verdad.
export const forgotPassword = async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const result = await pool.query('SELECT id, email, reset_requested_at FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    const cooldown = user?.reset_requested_at && Date.now() - new Date(user.reset_requested_at).getTime() < RESET_COOLDOWN_SECONDS * 1000;

    if (user && !cooldown) {
      const token = crypto.randomBytes(32).toString('base64url'); // viaja por email; solo su hash se guarda
      await pool.query(
        'UPDATE users SET reset_token_hash = $2, reset_token_expires_at = NOW() + make_interval(mins => $3), reset_requested_at = NOW() WHERE id = $1',
        [user.id, sha256(token), RESET_TOKEN_MINUTES]
      );

      const link = `${(process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0]}/reset-password?token=${token}`;
      const sent = await sendEmail({
        to: user.email,
        subject: 'Restablece tu contraseña de Nura',
        html: `<p>Pediste restablecer tu contraseña. Este enlace caduca en ${RESET_TOKEN_MINUTES} minutos y solo sirve una vez.</p><p><a href="${link}">${link}</a></p><p>Si no fuiste tú, ignora este correo: tu contraseña sigue igual.</p>`
      });
      audit(sent ? 'password_reset_requested' : 'password_reset_email_failed', { user_id: user.id, ip: ipTag(req) });
    } else {
      audit('password_reset_unknown_or_cooldown', { ip: ipTag(req) });
    }

    res.json({ message: GENERIC_RESET_MESSAGE });
  } catch (err) {
    log('ERROR', 'forgot-password failed', { code: err.code, message: err.message });
    // El mismo mensaje también en el error: no delatar por el tipo de respuesta si algo falló
    res.json({ message: GENERIC_RESET_MESSAGE });
  }
};

// POST /api/auth/reset-password { token, password }. El token es de un solo uso: se limpia tanto
// si acierta como si falla por caducado, y cambiar la contraseña restablece todas las sesiones.
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.body ?? {};
    const password = req.body?.password;
    if (typeof token !== 'string' || !token) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
      return res.status(400).json({ error: 'Password must be 8-72 characters' });
    }

    const result = await pool.query(
      'SELECT id, reset_token_expires_at FROM users WHERE reset_token_hash = $1',
      [sha256(token)]
    );
    const user = result.rows[0];
    const valid = user && new Date(user.reset_token_expires_at) > new Date();

    if (!valid) {
      audit('password_reset_invalid_token', { ip: ipTag(req) });
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users SET password_hash = $2, token_version = token_version + 1,
         failed_logins = 0, locked_until = NULL,
         reset_token_hash = NULL, reset_token_expires_at = NULL
       WHERE id = $1`,
      [user.id, passwordHash]
    );
    audit('password_reset_done', { user_id: user.id, ip: ipTag(req) });

    res.json({ ok: true });
  } catch (err) {
    log('ERROR', 'reset-password failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
