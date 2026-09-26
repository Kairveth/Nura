// Limpia texto libre ANTES de guardarlo: quita caracteres de control y etiquetas HTML/scripts.
// React ya escapa al pintar, pero no se confía en un solo cinturón. "<3" se conserva (no es una etiqueta).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAGS = /<\/?[a-zA-Z!][^>]*>?/g;

export const sanitizeText = (value) =>
  value
    .normalize('NFC')
    .replace(CONTROL, '')
    .replace(TAGS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
