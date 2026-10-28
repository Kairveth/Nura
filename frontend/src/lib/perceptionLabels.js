// Texto compartido entre el feed y el chat para no duplicar las frases de percepción.
// Las keys llegan del backend (match_reason.comun / match_reason.complementa).
export const PERC_LABELS = {
  ritmo: 'el ritmo mental',
  estructura: 'la estructura del día',
  sensorial: 'la energía sensorial',
  comunicacion: 'la forma de comunicaros',
  emocional: 'la intensidad emocional',
  social: 'la energía social'
};

// Une las keys en una frase legible: "A", "A y B", "A, B y C". Ignora las keys desconocidas.
export const labelList = (keys = []) => {
  const parts = keys.map((k) => PERC_LABELS[k]).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
};
