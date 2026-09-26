import express from 'express';
import { signup, login, logoutAll } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { loginLimiter, userLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/signup', loginLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/logout-all', authMiddleware, userLimiter, logoutAll);

export default router;
