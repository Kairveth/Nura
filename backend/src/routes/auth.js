import express from 'express';
import { signup, login } from '../controllers/authController.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/signup', loginLimiter, signup);
router.post('/login', loginLimiter, login);

export default router;
