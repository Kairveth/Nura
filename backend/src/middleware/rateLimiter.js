import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { audit, ipTag } from '../utils/logger.js';

const limiter = (options) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, opts) => {
      audit('rate_limited', { route: req.baseUrl + req.path, user_id: req.user?.id ?? null, ip: ipTag(req) });
      res.status(opts.statusCode).json(opts.message);
    },
    ...options
  });

// Registro y login: 5 intentos / 15 min por IP (además del bloqueo por cuenta en authController)
export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts' }
});

// Red de seguridad global por IP
export const apiLimiter = limiter({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests' }
});

// Por usuario autenticado (se monta después de authMiddleware): frena scraping y swipes en ráfaga
export const userLimiter = limiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => (req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip)),
  message: { error: 'Too many requests' }
});

// Recuperar contraseña: 3 / hora por IP. Se suma al enfriamiento por cuenta del controlador
// (2 min entre envíos), que evita que muchas IPs distintas saturen el buzón de una sola víctima.
export const passwordResetLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many requests' }
});

// Enviar mensajes: 10 / min por usuario (checklist de seguridad, punto 5). Aparte del límite general
// de userLimiter, que ya cubre la lectura por polling (2s = 30 peticiones/min, dentro de su cupo).
export const messageLimiter = limiter({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip)),
  message: { error: 'Too many messages' }
});
