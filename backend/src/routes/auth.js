import express from 'express';
import { signup, login, logoutAll, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { loginLimiter, userLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/signup', loginLimiter, signup);
router.post('/login', loginLimiter, login);
router.post('/logout-all', authMiddleware, userLimiter, logoutAll);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);

export default router;
