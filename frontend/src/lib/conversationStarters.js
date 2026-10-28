// Abridores de conversación (Fase B). Lógica pura, sin IA ni backend: se derivan del porqué del match
// (match_reason, que ya calcula el backend) para que el primer mensaje no parta de una página en blanco.
// Reduce la barrera del "¿y ahora qué digo?" apoyándose en lo que de verdad compartís o os complementa.
//
// Reglas de diseño (ver Especificacion/05-match-percepcion.md, Fase B):
// - Solo `comun` (os parecéis) y `complementa` (os enriquecéis). La `friccion` NO abre conversación:
//   es información delicada; vive en la tarjeta de contexto del chat, no como tema de apertura.
// - Selección DETERMINISTA sembrada por el matchId: los chips no parpadean ni cambian en cada poll.
// - `variant` (0, 1, 2…) rota la selección cuando la persona pide "otra sugerencia".

// Preguntas concretas por dimensión. Cada clave ofrece varias formulaciones para que "otra sugerencia"
// aporte variedad. Son frases completas y enviables, en voz activa y sin presión.
const COMUN = {
  sensorial: [
    'A los dos os importa el ambiente. ¿Hay algún sitio donde te sientas especialmente a gusto?',
    '¿Qué cosas te cargan las pilas y cuáles te agotan?'
  ],
  comunicacion: [
    'Os comunicáis de forma parecida. ¿Hay algo que te gustaría que supiera de ti desde ya?',
    '¿Prefieres mensajes largos o ir poco a poco?'
  ],
  emocional: [
    'Vivís las emociones de forma parecida. ¿Qué te hizo ilusión esta semana?',
    '¿Hay algo que te apasione y de lo que podrías hablar durante horas?'
  ],
  social: [
    'Lleváis una energía social parecida. ¿Prefieres planes tranquilos o con más gente?',
    '¿Cómo es tu plan ideal para desconectar?'
  ]
};

const COMPLEMENTA = {
  ritmo: [
    'Parece que lleváis ritmos distintos. ¿Cómo es un buen día para ti?',
    '¿Eres más de mañanas o de noches?'
  ],
  estructura: [
    'Organizáis el día de forma distinta. ¿Prefieres planear o improvisar?',
    '¿Qué te ayuda a sentir que un día ha ido bien?'
  ]
};

// Fallback cuando no hay porqué (perfil oculto, o aún sin responder bastante): nadie se queda sin chips.
const GENERICOS = [
  '¿Qué es lo primero que haces al llegar a casa?',
  '¿Tienes algún interés al que dediques mucho tiempo?',
  '¿Prefieres planes tranquilos o con más gente?',
  '¿Hay algo que te gustaría que supiera de ti desde ya?'
];

// Cuántos chips se muestran a la vez.
const COUNT = 3;

// djb2: hash estable de una cadena a entero no negativo. Misma semilla que el avatar procedural, para
// que la selección sea reproducible entre render y render (y entre polls) sin estado extra.
const hash = (str = '') => {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
};

// Toma un elemento de `arr` de forma determinista a partir de una semilla.
const pick = (arr, seed) => arr[seed % arr.length];

// Construye hasta COUNT abridores únicos para un match.
// matchReason: { comun: string[], complementa: string[], friccion: string[] } | null | undefined
// matchId: string (semilla estable). variant: entero que rota la selección ("otra sugerencia").
export const conversationStarters = (matchReason, matchId = '', variant = 0) => {
  const seed = hash(matchId) + variant;

  // Una frase por clave presente en el porqué, eligiendo formulación según la semilla.
  const fromFamily = (keys = [], table) =>
    keys.filter((k) => table[k]).map((k, i) => pick(table[k], seed + i));

  const rotate = (arr, by) => (arr.length ? arr.map((_, i) => arr[(i + by) % arr.length]) : arr);
  const comun = rotate(fromFamily(matchReason?.comun, COMUN), seed);
  const complementa = rotate(fromFamily(matchReason?.complementa, COMPLEMENTA), seed);
  const genericos = rotate(GENERICOS, seed % GENERICOS.length);

  // Se intercalan las familias para que, si hay de ambas, salga 1 común + 1 complementa antes de repetir
  // familia (así se ven tanto "en qué os parecéis" como "en qué os complementáis"). Los genéricos rellenan.
  const interleave = (a, b) => {
    const out = [];
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (i < a.length) out.push(a[i]);
      if (i < b.length) out.push(b[i]);
    }
    return out;
  };
  const pool = [...interleave(comun, complementa), ...genericos];

  // Únicos, respetando el orden, hasta COUNT.
  const out = [];
  for (const s of pool) {
    if (!out.includes(s)) out.push(s);
    if (out.length === COUNT) break;
  }
  return out;
};

// Número de variantes útiles para "otra sugerencia": suficientes para que rote sin repetir enseguida.
export const STARTER_VARIANTS = 3;
