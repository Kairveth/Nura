import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { userLimiter } from '../middleware/rateLimiter.js';
import { createSwipe, getMatches } from '../controllers/swipeController.js';

const router = express.Router();

router.post('/', authMiddleware, userLimiter, createSwipe);
router.get('/matches', authMiddleware, userLimiter, getMatches);

export default router;
