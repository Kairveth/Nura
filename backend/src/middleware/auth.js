import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { log } from '../utils/logger.js';

// Valida el JWT (solo HS256) y que la sesión no se haya restablecido: cada usuario tiene un
// `token_version`; al restablecer sesiones se incrementa y los tokens anteriores dejan de valer.
export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  try {
    const result = await pool.query('SELECT token_version FROM users WHERE id = $1', [decoded.id]);
    const user = result.rows[0];
    if (!user || user.token_version !== (decoded.tv ?? 0)) {
      return res.status(401).json({ error: 'Session expired' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    // Falla cerrado: si no se puede comprobar la sesión, no se deja pasar
    log('ERROR', 'session check failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Authentication check failed' });
  }
};
