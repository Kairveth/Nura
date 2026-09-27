import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { userLimiter } from '../middleware/rateLimiter.js';
import {
  createProfile,
  updateProfile,
  getProfile,
  getFeed,
  uploadPhoto
} from '../controllers/profileController.js';

const router = express.Router();
// En memoria (nunca en disco): el fichero se reenvía directo a Supabase Storage. Límite algo por
// encima del máximo de la foto (5MB) para dejar sitio a la codificación multipart.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 1 } });

// Protected routes (require auth)
router.post('/', authMiddleware, userLimiter, createProfile);
router.put('/', authMiddleware, userLimiter, updateProfile);
router.get('/feed', authMiddleware, userLimiter, getFeed);
// multer llama a next(err) en fallos (fichero demasiado grande, campo equivocado): se convierte
// en un 400 legible en vez de caer al manejador genérico de errores (que respondería 500).
const photoUpload = (req, res, next) =>
  upload.single('photo')(req, res, (err) => (err ? res.status(400).json({ error: 'Invalid photo upload' }) : next()));

router.post('/photo', authMiddleware, userLimiter, photoUpload, uploadPhoto);

// Perfil por id: requiere sesión (una ruta pública permitiría rastrear perfiles)
router.get('/:userId', authMiddleware, userLimiter, getProfile);

export default router;
