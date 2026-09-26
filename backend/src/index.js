import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'dotenv/config';
import { apiLimiter } from './middleware/rateLimiter.js';
import { corsOptions, originCheck, noStore } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import swipeRoutes from './routes/swipe.js';

const required = ['JWT_SECRET', 'DATABASE_URL'];
if (process.env.NODE_ENV === 'production') required.push('FRONTEND_URL'); // CORS estricto: sin origen no se arranca
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

const app = express();

app.disable('x-powered-by'); // no anunciar el framework
// Detrás del proxy (Render) req.ip sería el del proxy y el rate limit compartiría contador entre todos
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(helmet({
  // HSTS: 2 años, subdominios y preload. Solo lo respetan los navegadores sobre HTTPS.
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
  frameguard: { action: 'deny' } // la API nunca debe incrustarse en un iframe
}));
app.use(cors(corsOptions));
app.use(originCheck);

app.use(express.json({ limit: '10kb' }));
app.use('/api', noStore);
app.use(apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/swipes', swipeRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Nada más está expuesto: sin archivos estáticos, sin listado de directorios, sin rutas de administración
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
