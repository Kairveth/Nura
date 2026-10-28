// Motor de puntuación del match por percepción (Fase A). Funciones puras, sin BD ni efectos: reciben
// dos perfiles (sus columnas perc_*) y devuelven un orden interno o el porqué cualitativo. NUNCA produce
// un porcentaje: el número existe solo para ordenar; la UI compone el texto a partir de matchReason.
//
// Modelo Base × Chispa (ver Especificacion/05-match-percepcion.md):
// - Base  = media de las dimensiones de SIMILITUD (cómo necesitáis vivir: el desajuste aquí es fricción).
// - Chispa = media de las dimensiones de COMPLEMENTO (cómo se mueven vuestras mentes: encajan los opuestos).
// - match = base * chispa (multiplicativo: una base pobre no se rescata con chispa).

// Las 6 dimensiones del día 1, en orden. `kind` define cómo puntúa cada una:
// 'similitud'  → respuestas cercanas suman (base común).
// 'complemento' → respuestas opuestas suman (chispa).
export const DIMENSIONS = [
  { key: 'ritmo',        column: 'perc_ritmo',        kind: 'complemento' },
  { key: 'estructura',   column: 'perc_estructura',   kind: 'complemento' },
  { key: 'sensorial',    column: 'perc_sensorial',    kind: 'similitud' },
  { key: 'comunicacion', column: 'perc_comunicacion', kind: 'similitud' },
  { key: 'emocional',    column: 'perc_emocional',    kind: 'similitud' },
  { key: 'social',       column: 'perc_social',       kind: 'similitud' }
];

// Rango máximo entre dos respuestas 1–5: usado para normalizar la distancia a [0,1].
const MAX_RANGE = 4;

// Umbrales cualitativos para matchReason (NO afectan a scoreMatch). Se expresan en distancia normalizada:
// 0 = respuesta idéntica, 1 = extremos opuestos. Cada punto de la escala 1–5 son 0.25 de distancia.
const UMBRAL_COMUN = 0.25;        // similitud: a ≤1 punto de diferencia → "tenéis esto en común".
const UMBRAL_COMPLEMENTA = 0.5;   // complemento: ≥2 puntos de diferencia → "os complementáis aquí".

// ¿Ha respondido la persona esta dimensión? (entero 1–5; null/undefined = sin responder).
const respondida = (valor) => valor !== null && valor !== undefined;

// Puntuación de orden interno entre dos perfiles. `null` = aún no puntuable (una familia entera sin
// responder por alguno de los dos): el feed lo tratará como orden cronológico, sin inventar valores.
export const scoreMatch = (mine, other) => {
  const similitud = [];   // aportes de las dimensiones de base común
  const complemento = []; // aportes de las dimensiones de chispa

  for (const { column, kind } of DIMENSIONS) {
    const a = mine?.[column];
    const b = other?.[column];
    if (!respondida(a) || !respondida(b)) continue; // solo cuentan las que AMBOS respondieron

    const dist = Math.abs(a - b) / MAX_RANGE; // 0..1
    const aporta = kind === 'similitud' ? 1 - dist : dist;
    (kind === 'similitud' ? similitud : complemento).push(aporta);
  }

  const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const base = media(similitud);
  const chispa = media(complemento);

  if (base === null || chispa === null) return null; // falta una familia completa → sin puntuar
  return base * chispa; // 0..1, solo para ordenar; NUNCA se muestra como %
};

// Estructura para que la UI componga el texto cualitativo (sin número, sin %): en qué coincidís (base
// común) y en qué os complementáis (chispa). Solo mira dimensiones respondidas por ambos.
export const matchReason = (mine, other) => {
  const comun = [];
  const complementa = [];

  for (const { key, column, kind } of DIMENSIONS) {
    const a = mine?.[column];
    const b = other?.[column];
    if (!respondida(a) || !respondida(b)) continue;

    const dist = Math.abs(a - b) / MAX_RANGE;
    if (kind === 'similitud' && dist <= UMBRAL_COMUN) comun.push(key);
    else if (kind === 'complemento' && dist >= UMBRAL_COMPLEMENTA) complementa.push(key);
  }

  return { comun, complementa };
};
