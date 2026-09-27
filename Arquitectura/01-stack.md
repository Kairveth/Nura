# Stack Técnico

## Frontend
- **Vite 5 + React 18** (desplegable en Vercel como SPA)
- **react-router-dom 7** (rutas)
- **React 18**
- **TailwindCSS** (accessible, built-in dark mode prep)
- **axios** (HTTP client)
- **zustand** (state, lightweight)

## Backend
- **Node.js + Express** (rápido, sencillo)
  - O: **Python + FastAPI** (si prefieres)
- **JWT (jsonwebtoken)** para auth
- **bcryptjs** para passwords
- **pg (node-postgres)** driver
- **cors** + **helmet** (security)
- **dotenv** (env vars)
- **resend** o **sendgrid** (email)

## Database
- **PostgreSQL** (Render free tier o Supabase)

## Hosting
- **Frontend:** Vercel (ya configured)
- **Backend:** Render, Railway, o Fly.io (free tier first month)
- **DB:** Render Postgres (100MB free) o Supabase (500MB free)

## Realtime (Chat)
- **Polling MVP:** fetch every 2s (sin deps)
- **Upgrade path:** socket.io si needed

## Monitoring
- **Logs:** console.log a Vercel/Render (built-in)
- **Errors:** Sentry (free tier) - optional post-MVP

## Development
- **Git:** GitHub (link repos)
- **Package managers:** npm (both frontend + backend)
- **Database migrations:** simple SQL scripts (no Prisma/Sequelize MVP)

## Secrets
- .env.local (frontend, public OK: VITE_API_URL)
- .env (backend, private: DB_URL, JWT_SECRET, EMAIL_API_KEY)
- Never commit .env files

## Total Dependencies (MVP strict)

**Frontend:**
```json
{
  "vite": "^5",
  "react-router-dom": "^7",
  "react": "^18",
  "tailwindcss": "^3",
  "axios": "^1",
  "zustand": "^4"
}
```

**Backend:**
```json
{
  "express": "^4",
  "jsonwebtoken": "^9",
  "bcryptjs": "^2",
  "pg": "^8",
  "cors": "^2",
  "helmet": "^7",
  "dotenv": "^16"
}
```

**No:** Prisma, TypeScript, Redux, Material-UI, Webpack tweaks, Docker MVP.

## Why minimal stack?

Less dependencies = less surface area for bugs.
Easier to debug, faster to ship, less "magic".
