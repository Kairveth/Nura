# Nura

MVP de una app de citas para personas neurodivergentes y neurotípicas. Pocos perfiles, más intención, poca carga sensorial.

## Estructura

```
backend/         API Express + JWT + PostgreSQL
  src/           controllers, routes, middleware, utils
frontend/        Vite + React + Tailwind
  src/           pages, components, store, api
scripts/         utilidades de desarrollo
Especificacion/  alcance MVP, personas, user stories, features
Arquitectura/    stack y guías de integración
Seguridad/       checklist de 10 puntos
```

## Puesta en marcha

```bash
# 1. Variables de entorno (copiar y rellenar; los .env nunca se suben)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 2. Base de datos: el esquema (migraciones SQL) se mantiene fuera del repo;
#    pídelo al equipo y ejecútalo en tu instancia de PostgreSQL

# 3. Backend (http://localhost:3001)
cd backend && npm install && npm run dev

# 4. Frontend (http://localhost:3000)
cd frontend && npm install && npm run dev
```

En Windows, `scripts/start-frontend.bat` arranca el frontend.
