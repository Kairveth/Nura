import crypto from 'crypto';

// Sube fotos de perfil a Supabase Storage con la service key (nunca expuesta al navegador).
// El bucket es público solo para LECTURA por URL directa; listar/escribir exige la service key,
// así que un nombre aleatorio es la única puerta — no hay enumeración posible (comprobado a mano).
const BUCKET = 'profile-photos';
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png' };

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

// Borra la foto anterior del usuario (si la había) y sube la nueva bajo un nombre aleatorio.
// Nota: la URL pública pasa por el CDN de Supabase (`cache-control: max-age=300`), así que tras
// reemplazar una foto la anterior puede seguir sirviéndose desde caché hasta 5 min. El borrado en
// origen es inmediato (verificable con /object/info/public/...); nunca volvemos a devolver esa URL.
// ponytail: sin miniaturas/redimensionado; añadir si el peso de las fotos en el feed se nota.
export const replaceProfilePhoto = async (userId, buffer, mime, previousUrl) => {
  const path = `${userId}/${crypto.randomUUID()}.${MIME_EXT[mime]}`;
  const res = await fetch(`${base()}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: authHeaders(mime),
    body: buffer
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status} ${await res.text()}`);

  if (previousUrl) {
    const prevPath = previousUrl.split(`/object/public/${BUCKET}/`)[1];
    if (prevPath) {
      fetch(`${base()}/storage/v1/object/${BUCKET}/${prevPath}`, { method: 'DELETE', headers: authHeaders() }).catch(() => {});
    }
  }

  return `${base()}/storage/v1/object/public/${BUCKET}/${path}`;
};
