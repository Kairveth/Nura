// Topes numéricos compartidos: viven en un solo sitio para no repetir el mismo número en varios
// ficheros (cambiarlo aquí basta). Son límites semánticos, no de infraestructura por petición.

// bcrypt ignora lo que pase de 72 bytes, así que no tiene sentido aceptar contraseñas más largas.
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD_BYTES = 72;

// Llamadas HTTP salientes (Supabase Storage, Resend): sin tope, un proveedor colgado deja cada
// petición esperando para siempre y se acumulan hasta agotar el servidor.
export const EXTERNAL_TIMEOUT_MS = 10_000;
