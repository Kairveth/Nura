import crypto from 'crypto';
import pool from '../db.js';

// Huella del email de una cuenta borrada con reportes en contra (tabla reported_account_deletions,
// migración 013). Es un HMAC, no el email ni un hash simple: sin la clave del servidor no se puede revertir
// ni comprobar contra una lista de emails. La clave deriva de JWT_SECRET: si se rota, las huellas
// anteriores dejan de coincidir (se pierde la detección, no se filtra nada).
const emailHmac = (email) =>
  crypto.createHmac('sha256', `${process.env.JWT_SECRET}:reported-accounts`).update(email.trim().toLowerCase()).digest('hex');

// Dentro de la transacción del borrado: si la cuenta tiene reportes en contra, guarda su huella.
export const rememberIfReported = async (client, userId, email) => {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM match_reports WHERE reported_user_id = $1', [userId]);
  if (rows[0].n === 0) return 0;
  await client.query(
    `INSERT INTO reported_account_deletions (email_hmac, reports_count) VALUES ($1, $2)
     ON CONFLICT (email_hmac) DO UPDATE
       SET reports_count = reported_account_deletions.reports_count + EXCLUDED.reports_count, last_deleted_at = NOW()`,
    [emailHmac(email), rows[0].n]
  );
  return rows[0].n;
};

// Al registrarse: ¿vuelve alguien cuya cuenta anterior se borró con reportes en contra?
export const reportsBeforeDeletion = async (email) => {
  const { rows } = await pool.query('SELECT reports_count FROM reported_account_deletions WHERE email_hmac = $1', [emailHmac(email)]);
  return rows[0]?.reports_count ?? 0;
};
