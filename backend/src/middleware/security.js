import { audit, ipTag } from '../utils/logger.js';

// Lista blanca de orígenes: FRONTEND_URL admite varios separados por comas.
// En producción solo cuenta FRONTEND_URL (obligatoria); en desarrollo se añaden los puertos locales de
// Vite, porque el navegador envía Origin también en las peticiones que pasan por el proxy.
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];

export const allowedOrigins = () => {
  const configured = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return process.env.NODE_ENV === 'production' ? configured : [...new Set([...configured, ...DEV_ORIGINS])];
};

export const corsOptions = {
  origin: (origin, cb) => cb(null, !origin || allowedOrigins().includes(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: false, // la sesión viaja en Authorization, no en cookies
  maxAge: 600
};

// Defensa CSRF: una petición que cambia datos y declara un Origin ajeno se rechaza.
// (Con Bearer en cabecera no hay credenciales automáticas; esto protege si algún día se usan cookies.)
export const originCheck = (req, res, next) => {
  const origin = req.headers.origin;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !origin || allowedOrigins().includes(origin)) return next();
  audit('origin_rejected', { route: req.baseUrl + req.path, ip: ipTag(req) });
  res.status(403).json({ error: 'Origin not allowed' });
};

// Las respuestas de la API contienen datos personales: que ningún proxy ni navegador las cachee
export const noStore = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
