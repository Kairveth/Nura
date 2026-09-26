import { Pool } from 'pg';
import { log } from './utils/logger.js';

// Un único pool compartido: cada Pool abre hasta `max` conexiones y Postgres (Supabase/Render)
// limita el total. Con 3 pools de 10 se agotaba antes; con uno solo, el consumo es predecible.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000 // una consulta lenta no puede bloquear el pool
});

// Sin este handler, un error en una conexión inactiva tumba el proceso
pool.on('error', (err) => log('ERROR', 'pg pool error', { message: err.message }));

export default pool;
