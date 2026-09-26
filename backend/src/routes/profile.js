import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  createProfile,
  updateProfile,
  getProfile,
  getFeed
} from '../controllers/profileController.js';

const router = express.Router();

// Protected routes (require auth)
router.post('/', authMiddleware, createProfile);
router.put('/', authMiddleware, updateProfile);
router.get('/feed', authMiddleware, getFeed);

// Public routes
router.get('/:userId', getProfile);

export default router;
