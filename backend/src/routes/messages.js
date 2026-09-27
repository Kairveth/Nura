import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { userLimiter, messageLimiter } from '../middleware/rateLimiter.js';
import { getMessages, createMessage, markRead } from '../controllers/messageController.js';

const router = express.Router();

router.get('/:matchId/messages', authMiddleware, userLimiter, getMessages);
router.post('/:matchId/messages', authMiddleware, messageLimiter, createMessage);
router.post('/:matchId/read', authMiddleware, userLimiter, markRead);

export default router;
