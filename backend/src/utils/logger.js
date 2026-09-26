import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}\n`;

  console.log(entry);

  try {
    fs.appendFileSync(path.join(__dirname, '../../logs.txt'), entry);
  } catch (err) {
    console.error('Logging failed:', err.message);
  }
};

// Eventos de seguridad (login, bloqueos, límites...). Solo ids y acciones: nunca email, contraseña,
// token ni contenido. La IP se registra como huella con sal para poder correlacionar sin guardarla.
export const audit = (event, data = {}) => log('AUDIT', event, data);

export const ipTag = (req) =>
  crypto.createHash('sha256').update(`${req.ip}|${process.env.JWT_SECRET}`).digest('hex').slice(0, 12);
