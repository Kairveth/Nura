import pool from '../db.js';
import { log } from '../utils/logger.js';
import { parseLimit, parseCursor, toPage, isUuid } from '../utils/pagination.js';
import { sanitizeText } from '../utils/sanitize.js';

const MAX_MESSAGE_LENGTH = 2000;

// Confirma que el usuario es de verdad parte del match y devuelve qué lado es (1 o 2),
// para saber qué columna de "last_read_at" le corresponde. Ningún endpoint de chat sigue sin esto.
const loadMembership = async (matchId, userId) => {
  if (!isUuid(matchId)) return null;
  const { rows } = await pool.query('SELECT user_1_id, user_2_id FROM matches WHERE id = $1', [matchId]);
  const match = rows[0];
  if (!match) return null;
  if (match.user_1_id === userId) return { side: 1, otherId: match.user_2_id };
  if (match.user_2_id === userId) return { side: 2, otherId: match.user_1_id };
  return null;
};

// GET /api/matches/:matchId/messages?limit=20&cursor=<opaco>
// Respuesta: { data: [...], next_cursor }. Orden: más recientes primero (igual que el resto de listas);
// el cliente les da la vuelta para pintarlos de arriba hacia abajo.
export const getMessages = async (req, res) => {
  try {
    const membership = await loadMembership(req.params.matchId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Match not found' });

    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);
    if (cursor === false) return res.status(400).json({ error: 'Invalid cursor' });

    const values = [req.params.matchId];
    let cursorClause = '';
    if (cursor) {
      values.push(cursor.ts, cursor.id);
      cursorClause = 'AND (created_at, id) < ($2::timestamp, $3::uuid)';
    }
    values.push(limit + 1);

    const result = await pool.query(
      `SELECT id, sender_id, content, created_at, created_at::text AS cursor_ts
       FROM messages WHERE match_id = $1 ${cursorClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length}`,
      values
    );

    res.json(toPage(result.rows, limit));
  } catch (err) {
    log('ERROR', 'get messages failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// POST /api/matches/:matchId/messages { content }
export const createMessage = async (req, res) => {
  try {
    const membership = await loadMembership(req.params.matchId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Match not found' });

    const content = typeof req.body?.content === 'string' ? sanitizeText(req.body.content) : '';
    if (!content) return res.status(400).json({ error: 'Message cannot be empty' });
    if (content.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });

    const result = await pool.query(
      'INSERT INTO messages (match_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id, sender_id, content, created_at',
      [req.params.matchId, req.user.id, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    log('ERROR', 'create message failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// POST /api/matches/:matchId/read: marca como leído todo lo recibido hasta ahora (US-011).
export const markRead = async (req, res) => {
  try {
    const membership = await loadMembership(req.params.matchId, req.user.id);
    if (!membership) return res.status(404).json({ error: 'Match not found' });

    const column = membership.side === 1 ? 'user_1_last_read_at' : 'user_2_last_read_at';
    await pool.query(`UPDATE matches SET ${column} = NOW() WHERE id = $1`, [req.params.matchId]);
    res.json({ ok: true });
  } catch (err) {
    log('ERROR', 'mark read failed', { code: err.code, message: err.message });
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};
