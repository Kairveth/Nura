import crypto from 'crypto';
import sharp from 'sharp';

// Sube fotos de perfil a Supabase Storage con la service key (nunca expuesta al navegador).
// El bucket es público solo para LECTURA por URL directa; listar/escribir exige la service key,
// así que un nombre aleatorio es la única puerta — no hay enumeración posible (comprobado a mano).
const BUCKET = 'profile-photos';
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png' };
// Sin límite, un Storage colgado deja cada petición esperando para siempre y se acumulan hasta agotar el servidor
export const EXTERNAL_TIMEOUT_MS = 10_000;

const base = () => process.env.SUPABASE_URL;
const authHeaders = (contentType) => ({
  authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  apikey: process.env.SUPABASE_SERVICE_KEY,
  ...(contentType && { 'content-type': contentType, 'cache-control': 'max-age=300' }) // ver nota de caché abajo
});

// Sniff de cabecera de fichero: el `mimetype` que manda el navegador no es de fiar por sí solo
export const sniffImageMime = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
};

// Las fotos del móvil traen EXIF con las coordenadas GPS de dónde se hicieron (a menudo, la casa de la
// persona), y la URL de la foto es pública. Se vuelve a codificar la imagen en vez de borrar bloques a mano:
// sale sin NINGÚN metadato (EXIF, GPS, XMP, comentarios) ni datos escondidos tras la imagen. `rotate()`
// aplica antes la orientación del EXIF para que la foto no salga girada al perderla. `limitInputPixels`
// corta las bombas de descompresión (pocos KB que se expanden a gigapíxeles y tumban el proceso).
const MAX_INPUT_PIXELS = 40_000_000; // ~ una foto de 48 MP recortada; de sobra para un móvil actual
const MAX_SIDE = 1600; // la foto nunca se muestra más grande: menos peso y nada de originales a resolución completa

export const cleanImage = async (buffer, mime) => {
  const image = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  return mime === 'image/png' ? image.png().toBuffer() : image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
};

// Borra la foto anterior del usuario (si la había) y sube la nueva bajo un nombre aleatorio.
// Nota: la URL pública pasa por el CDN de Supabase (`cache-control: max-age=300`), así que tras
// reemplazar una foto la anterior puede seguir sirviéndose desde caché hasta 5 min. El borrado en
// origen es inmediato (verificable con /object/info/public/...); nunca volvemos a devolver esa URL.
// ponytail: sin miniaturas/redimensionado; añadir si el peso de las fotos en el feed se nota.
export const replaceProfilePhoto = async (userId, buffer, mime, previousUrl) => {
  const path = `${userId}/${crypto.randomUUID()}.${MIME_EXT[mime]}`;
  const res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${path}`, {
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    method: 'POST',
    headers: authHeaders(mime),
    body: buffer
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status} ${await res.text()}`);

  deleteProfilePhoto(previousUrl).catch(() => {});

  return `${base()}/storage/v1/object/public/${BUCKET}/${path}`;
};

// La única photo_url válida es la que devolvió POST /api/profiles/photo para ESTE usuario: su carpeta,
// nombre UUID, extensión jpg/png. Cualquier otra URL permitiría un píxel espía (cada persona que viera el
// perfil cargaría una imagen de un servidor ajeno y le dejaría su IP y la hora), usar la foto de otro
// usuario o saltarse la limpieza y los límites de la subida.
const PHOTO_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/;
export const isOwnPhotoUrl = (userId, url) => {
  const prefix = `${base()}/storage/v1/object/public/${BUCKET}/${userId}/`;
  return typeof url === 'string' && url.startsWith(prefix) && PHOTO_NAME.test(url.slice(prefix.length));
};

// Borra una foto por su URL pública. Sin URL (o una que no es de este bucket) no hace nada.
// Devuelve la promesa: quien llama decide si espera (borrar cuenta) o no (reemplazar foto).
export const deleteProfilePhoto = async (url) => {
  const path = url?.split(`/object/public/${BUCKET}/`)[1];
  if (!path) return;
  const res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${path}`, {
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS), method: 'DELETE', headers: authHeaders() });
  if (!res.ok && res.status !== 404) throw new Error(`storage delete failed: ${res.status}`);
};

// Borra TODAS las fotos del usuario (carpeta `<userId>/`), no solo la del perfil: una foto subida
// y nunca guardada en el perfil, o una antigua cuyo borrado best-effort falló, también son suyas.
export const deleteUserPhotos = async (userId) => {
  const list = await fetch(`${base()}/storage/v1/object/list/${BUCKET}`, {
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: `${userId}/`, limit: 1000 })
  });
  if (!list.ok) throw new Error(`storage list failed: ${list.status}`);
  const prefixes = (await list.json()).map((obj) => `${userId}/${obj.name}`);
  if (prefixes.length === 0) return;

  const res = await fetch(`${base()}/storage/v1/object/${BUCKET}`, {
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    method: 'DELETE',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes })
  });
  if (!res.ok) throw new Error(`storage delete failed: ${res.status}`);
};
