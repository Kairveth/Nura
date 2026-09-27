import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { userLimiter } from '../middleware/rateLimiter.js';
import { createSwipe, getMatches, getMatch } from '../controllers/swipeController.js';

const router = express.Router();

router.post('/', authMiddleware, userLimiter, createSwipe);
router.get('/matches', authMiddleware, userLimiter, getMatches);
router.get('/matches/:matchId', authMiddleware, userLimiter, getMatch);

export default router;
