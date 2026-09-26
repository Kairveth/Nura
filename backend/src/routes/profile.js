import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { userLimiter } from '../middleware/rateLimiter.js';
import {
  createProfile,
  updateProfile,
  getProfile,
  getFeed
} from '../controllers/profileController.js';

const router = express.Router();

// Protected routes (require auth)
router.post('/', authMiddleware, userLimiter, createProfile);
router.put('/', authMiddleware, userLimiter, updateProfile);
router.get('/feed', authMiddleware, userLimiter, getFeed);

// Perfil por id: requiere sesión (una ruta pública permitiría rastrear perfiles)
router.get('/:userId', authMiddleware, userLimiter, getProfile);

export default router;
