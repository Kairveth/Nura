import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { log, audit, ipTag } from '../utils/logger.js';
import { deleteUserPhotos } from '../utils/storage.js';
import { rememberIfReported } from '../utils/reportedAccounts.js';

const MAX_PASSWORD_BYTES = 72; // mismo tope que authController (bcrypt ignora lo que pase de 72 bytes)

// GET /api/account/export (US-013): todos los datos PROPIOS en un JSON, descargado al momento.
// Nada de terceros: ni el perfil de la otra persona ni sus mensajes, solo los ids de los matches.
// Nunca sale nada de seguridad (hash, token_version, bloqueos, token de reset).
export const exportData = async (req, res) => {
  const userId = req.user.id;
  try {
    const [account, profile, swipes, matches, messages, reports] = await Promise.all([
      pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [userId]),
      pool.query(
        `SELECT photo_url, description, age, location, neurodivergence_types AS neurotipos, intention,
                created_at, updated_at
         FROM profiles WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        'SELECT to_user_id, direction AS action, created_at FROM swipes WHERE from_user_id = $1 ORDER BY created_at',
        [userId]
      ),
      pool.query(
        `SELECT id AS match_id, created_at, blocked_at, (blocked_by = $1) AS blocked_by_me
         FROM matches WHERE user_1_id = $1 OR user_2_id = $1 ORDER BY created_at`,
        [userId]
      ),
      pool.query(
        'SELECT match_id, content, created_at FROM messages WHERE sender_id = $1 ORDER BY created_at',
        [userId]
      ),
      pool.query(
        'SELECT match_id, reason, created_at FROM match_reports WHERE reporter_id = $1 ORDER BY created_at',
        [userId]
      )
    ]);

    audit('data_exported', { user_id: userId, ip: ipTag(req) });
    res.json({
      exported_at: new Date().toISOString(),
      account: account.rows[0],
      profile: profile.rows[0] ?? null,
      swipes: swipes.rows,
      matches: matches.rows,
      messages_sent: messages.rows,
      reports_filed: reports.rows
    });
  } catch (err) {
    log('ERROR', 'data export failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to export data' });
  }
};

// POST /api/account/delete (US-012), body { password }: borrado inmediato y definitivo.
// Pide la contraseña aunque haya sesión: un token robado o una pestaña abierta no bastan para borrar.
// Contraseña incorrecta = 403, no 401: el cliente cierra la sesión ante cualquier 401.
export const deleteAccount = async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body ?? {};
  if (typeof password !== 'string' || !password || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return res.status(400).json({ error: 'Password required' });
  }

  const client = await pool.connect();
  try {
    const user = await client.query('SELECT email, password_hash FROM users WHERE id = $1', [userId]);
    if (!user.rows[0] || !(await bcrypt.compare(password, user.rows[0].password_hash))) {
      audit('account_delete_denied', { user_id: userId, ip: ipTag(req) });
      return res.status(403).json({ error: 'Incorrect password' });
    }

    // swipes, matches y messages.sender_id apuntan a users SIN cascada: un DELETE de users a secas
    // falla por FK. Orden: matches (arrastra messages), swipes, y por último users (arrastra profiles).
    // Se borran las conversaciones enteras, también para la otra persona. Los reportes NO se borran
    // (match_id/reporter_id pasan a NULL, migración 013): borrar la cuenta no puede borrar las pruebas.
    await client.query('BEGIN');
    await rememberIfReported(client, userId, user.rows[0].email);
    await client.query('DELETE FROM matches WHERE user_1_id = $1 OR user_2_id = $1', [userId]);
    await client.query('DELETE FROM swipes WHERE from_user_id = $1 OR to_user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    log('ERROR', 'account delete failed', { code: err.code, message: err.message });
    return res.status(500).json({ error: 'Failed to delete account' });
  } finally {
    client.release();
  }

  audit('account_deleted', { user_id: userId, ip: ipTag(req) });
  // Las fotos se borran DESPUÉS del COMMIT: si la BD fallara, no quedaría un perfil apuntando a una foto
  // borrada. Si falla Storage, la cuenta ya no existe y las URLs son aleatorias; se registra el user_id
  // para borrar a mano su carpeta `<userId>/` del bucket.
  try {
    await deleteUserPhotos(userId);
  } catch (err) {
    log('ERROR', 'account photo delete failed', { user_id: userId, message: err.message });
  }
  res.status(204).end();
};
