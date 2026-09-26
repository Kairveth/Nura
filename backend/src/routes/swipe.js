import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createSwipe, getMatches } from '../controllers/swipeController.js';

const router = express.Router();

router.post('/', authMiddleware, createSwipe);
router.get('/matches', authMiddleware, getMatches);

export default router;
