// Paginación por cursor (keyset): coste constante con millones de filas, a diferencia de OFFSET.
// Los ids son UUID (sin orden cronológico), así que las listas se ordenan por (created_at DESC, id DESC)
// y el cursor es opaco: codifica el `created_at` (con microsegundos, como texto) y el `id` de la última fila.
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 20;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

export const parseLimit = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_LIMIT) : DEFAULT_LIMIT;
};

const encodeCursor = (ts, id) => Buffer.from(JSON.stringify([ts, id])).toString('base64url');

// null = sin cursor (primera página) · false = cursor inválido · { ts, id } = cursor válido
export const parseCursor = (value) => {
  if (value === undefined || value === '') return null;
  try {
    const [ts, id] = JSON.parse(Buffer.from(String(value), 'base64url').toString());
    return typeof ts === 'string' && TS_RE.test(ts) && isUuid(id) ? { ts, id } : false;
  } catch {
    return false;
  }
};

// Las consultas devuelven `cursor_ts` (created_at::text, sin perder microsegundos) y piden `limit + 1`
// filas: la fila extra indica si hay más páginas sin hacer un COUNT. `cursor_ts` no sale al cliente.
export const toPage = (rows, limit) => {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    data: page.map(({ cursor_ts, ...row }) => row),
    next_cursor: hasMore ? encodeCursor(last.cursor_ts, last.id) : null
  };
};
