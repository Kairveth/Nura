// Paginación por cursor (keyset): coste constante con millones de filas, a diferencia de OFFSET.
// Las listas se ordenan por `id DESC`; el cursor es el `id` de la última fila recibida.
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 20;

export const parseLimit = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_LIMIT) : DEFAULT_LIMIT;
};

// null = sin cursor (primera página) · false = cursor inválido · string = id (BIGINT viaja como texto)
export const parseCursor = (value) => {
  if (value === undefined || value === '') return null;
  return /^\d{1,18}$/.test(String(value)) ? String(value) : false;
};

// Se piden `limit + 1` filas: la fila extra indica si hay más páginas sin hacer un COUNT
export const toPage = (rows, limit) => {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, next_cursor: hasMore ? String(data[data.length - 1].id) : null };
};
