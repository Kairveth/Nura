import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'dotenv/config';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import swipeRoutes from './routes/swipe.js';

for (const name of ['JWT_SECRET', 'DATABASE_URL']) {
  if (!process.env[name]) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

const app = express();

// Detrás del proxy (Render) req.ip sería el del proxy y el rate limit compartiría contador entre todos
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));
app.use(apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/swipes', swipeRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
