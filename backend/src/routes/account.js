import express from 'express';
import { exportData, deleteAccount } from '../controllers/accountController.js';
import { authMiddleware } from '../middleware/auth.js';
import { userLimiter, accountDeleteLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Ajustes / GDPR (US-012, US-013). POST para borrar y no DELETE: lleva la contraseña en el body,
// y algunos proxies descartan el body de un DELETE.
router.get('/export', authMiddleware, userLimiter, exportData);
router.post('/delete', authMiddleware, accountDeleteLimiter, deleteAccount);

export default router;
