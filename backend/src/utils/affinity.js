// Reordena una página de perfiles hacia mayor afinidad, sin ocultar a nadie: nunca decide QUIÉN
// aparece (eso lo sigue haciendo el filtro de siempre), solo EN QUÉ ORDEN dentro de la página que ya
// se iba a mostrar. El cursor de paginación se calcula ANTES de este reordenado (ver toPage) y nunca
// se toca aquí, así que nadie se salta ni se repite entre páginas.

// Etiquetas que no dicen nada comparable de la persona: no cuentan ni como "igual" ni como pareja.
const IGNORE_TAGS = new Set(['Sin diagnóstico formal', 'Prefiero no decir']);

// Pares de etiquetas DISTINTAS que la comunidad neurodivergente suele describir como compatibles.
// Deliberadamente corta y conservadora: mejor pocas afirmaciones que podamos defender que muchas
// inventadas. TLP queda fuera a propósito (las dinámicas de pareja ahí son un tema clínico serio,
// no un rasgo de personalidad que "encaje bien" con otro).
export const COMPLEMENTARY_PAIRS = [
  ['TDAH', 'TEA/Autismo'],
  ['AACC (Altas Capacidades)', 'TDAH'],
  ['PAS (Alta Sensibilidad)', 'TEA/Autismo']
];

const SHARED_TAG_POINTS = 2;
const COMPLEMENTARY_PAIR_POINTS = 3;
// Margen de aleatoriedad: dos personas con la misma puntuación no siempre salen en el mismo orden,
// y de vez en cuando alguien con menos puntos se cuela antes. La química real no sigue una fórmula.
const JITTER_SPREAD = 2.5;

const relevantTags = (tags) => (tags ?? []).filter((t) => !IGNORE_TAGS.has(t));

export const affinityScore = (mine, card) => {
  const mineTags = relevantTags(mine);
  const cardTags = relevantTags(card);
  if (mineTags.length === 0 || cardTags.length === 0) return 0;

  const cardSet = new Set(cardTags);
  let score = 0;
  for (const tag of mineTags) if (cardSet.has(tag)) score += SHARED_TAG_POINTS;

  const mineSet = new Set(mineTags);
  for (const [a, b] of COMPLEMENTARY_PAIRS) {
    if ((mineSet.has(a) && cardSet.has(b)) || (mineSet.has(b) && cardSet.has(a))) score += COMPLEMENTARY_PAIR_POINTS;
  }
  return score;
};

// Reordena SOLO la página ya decidida (array corto, ya paginado). No usar sobre listas grandes:
// no es una búsqueda, es un empujón de orden sobre lo que ya se iba a enseñar.
export const sortByAffinity = (myTags, rows) =>
  [...rows]
    .map((row) => ({ row, key: affinityScore(myTags, row.neurotipos) + Math.random() * JITTER_SPREAD }))
    .sort((a, b) => b.key - a.key)
    .map(({ row }) => row);
