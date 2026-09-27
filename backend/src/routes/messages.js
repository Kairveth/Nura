import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { userLimiter, messageLimiter } from '../middleware/rateLimiter.js';
import { getMessages, createMessage, markRead, blockMatch, reportMatch } from '../controllers/messageController.js';

const router = express.Router();

router.get('/:matchId/messages', authMiddleware, userLimiter, getMessages);
router.post('/:matchId/messages', authMiddleware, messageLimiter, createMessage);
router.post('/:matchId/read', authMiddleware, userLimiter, markRead);
router.post('/:matchId/block', authMiddleware, userLimiter, blockMatch);
router.post('/:matchId/report', authMiddleware, userLimiter, reportMatch);

export default router;
