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
