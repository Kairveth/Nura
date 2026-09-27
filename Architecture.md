# Nura — Architecture

> Última actualización: 2026-09-26. Stack y dependencias: `Arquitectura/01-stack.md`.

## 1. Visión general

```
 Navegador (SPA)                 API                       Base de datos
┌──────────────────┐  HTTPS  ┌──────────────────┐  SQL   ┌──────────────┐
│ Vite + React 18  │ ──────► │ Express 5        │ ─────► │ PostgreSQL   │
│ Tailwind, Zustand│  JSON   │ helmet, cors,    │  (pg,  │ users,       │
│ react-router 7   │ ◄────── │ rate-limit, JWT  │ param.)│ profiles,    │
└──────────────────┘         └──────────────────┘        │ swipes,      │
   Vercel (SPA)                Render / Railway          │ matches,     │
                                                         │ messages     │
                                                         └──────────────┘
```

Monolito simple: un frontend SPA y una API REST. Sin ORM, sin TypeScript, sin Docker en el MVP: menos dependencias, menos superficie de fallo.

## 2. Estructura del repositorio

```
backend/
  src/
    index.js            arranque, middlewares globales, montaje de rutas
    routes/             auth.js, profile.js, swipe.js
    controllers/        authController, profileController, swipeController
    middleware/         auth (JWT), rateLimiter, errorHandler
    db.js               pool único de PostgreSQL (compartido por todos los controladores)
    utils/              logger, pagination (cursor)
frontend/
  src/
    App.jsx             rutas (públicas vs. autenticadas)
    components/         AuthLayout, Field
    pages/              Signup, Login, Dashboard, ProfileCreate, ProfileFeed, MatchesList
    store/              authStore (Zustand)
    api/client.js       axios + token en Authorization
Especificacion/  Arquitectura/  Seguridad/   documentación de producto
```

El esquema SQL vive en migraciones locales, **fuera del repo**.

## 3. Backend

### Middlewares globales (`index.js`)

1. Validación de variables de entorno: sale si faltan `JWT_SECRET` o `DATABASE_URL` (y `FRONTEND_URL` en producción).
2. `x-powered-by` desactivado; `trust proxy` en producción (detrás de Render, para que el rate limit use la IP real).
3. `helmet()` con **HSTS** (2 años, subdominios, preload), `frameguard: deny` y `Referrer-Policy: no-referrer`.
4. **CORS** con lista blanca (`FRONTEND_URL`), métodos y cabeceras explícitos, sin credenciales.
5. `originCheck`: rechaza con 403 escrituras cuyo `Origin` no esté en la lista (defensa CSRF).
6. `express.json({ limit: '10kb' })`.
7. `Cache-Control: no-store` en `/api` y `apiLimiter` (60 peticiones/min por IP).
8. Rutas → 404 JSON → `errorHandler` (en producción no filtra el mensaje interno). Sin archivos estáticos ni rutas admin.

Las rutas autenticadas añaden `authMiddleware` (JWT + `token_version`) y `userLimiter` (60/min por usuario).

### Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/signup` | — (rate limit 5/15 min) | Crea usuario, devuelve `{ user, token }` |
| POST | `/api/auth/login` | — (rate limit 5/15 min) | Devuelve `{ user, token }` |
| POST | `/api/profiles` | JWT | Crea el perfil propio (acepta `photo_url`) |
| PUT | `/api/profiles` | JWT | Edita el perfil propio |
| POST | `/api/profiles/photo` | JWT | Sube una foto (multipart), devuelve `{ photo_url }`; no toca la BD |
| GET | `/api/profiles/feed` | JWT | Perfiles aún no valorados, con filtros. **Paginado por cursor** |
| GET | `/api/profiles/:userId` | JWT | Perfil por id |
| POST | `/api/auth/logout-all` | JWT | Restablece **todas** las sesiones del usuario |
| POST | `/api/auth/forgot-password` | — (rate limit 3/h) | Siempre responde igual; si la cuenta existe, envía email |
| POST | `/api/auth/reset-password` | — (rate limit 3/h) | Token de un solo uso (hash en BD), 30 min |
| POST | `/api/swipes` | JWT | Registra sí/no; el match se crea en BD si es mutuo |
| GET | `/api/swipes/matches` | JWT | Matches del usuario con los datos del otro. **Paginado por cursor** |
| GET | `/health` | — | Comprobación de vida |

### Paginación (contrato de las listas)

Toda lista se pagina por **cursor (keyset)**, nunca con `OFFSET`:

```
GET /api/profiles/feed?limit=10&cursor=<id>&age_min=&age_max=&location=&neurotipo=
GET /api/swipes/matches?limit=10&cursor=<id>
→ 200 { "data": [ ... ], "next_cursor": "<id>" | null }
```

- Los ids son **UUID** (sin orden cronológico): el orden fijo es `created_at DESC, id DESC` y el cursor es **opaco** (codifica `created_at` con microsegundos y el `id` de la última fila). `next_cursor: null` = no hay más.
- `limit`: por defecto 10, **máximo 20** (`utils/pagination.js`). Cursor inválido → 400.
- El servidor pide `limit + 1` filas para saber si hay siguiente página sin `COUNT(*)`.
- Filtros validados: edad 18–120, `neurotipo` de una lista cerrada, `location` ≤ 100 caracteres.

**Pendiente:** mensajes (chat con polling), exportación y borrado de cuenta (GDPR), verificación de email.

### Tope diario de swipes (calidad sobre cantidad)

`DAILY_SWIPE_LIMIT = 15` (`swipeController.js`). `createSwipe` cuenta los swipes de hoy del usuario
(`countSwipesToday`, índice `idx_swipes_from_user_created`) **antes** de insertar; al llegar al tope
responde `429 { error: 'Daily swipe limit reached', limit }` y no guarda nada. `getFeed` y la
respuesta de `createSwipe` incluyen `swipes_today` y `daily_limit` para que el frontend muestre el
contador sin pedirlo aparte. Es una decisión de producto (menos, pero con más atención), no un límite
técnico: por eso se aplica en el servidor y no solo en la interfaz, para que no se pueda saltar.

### Autenticación

- Registro: valida tipo, formato de email y contraseña (8–72 bytes); normaliza el email a minúsculas; hash con `bcryptjs` (10 rondas).
- Login: siempre compara contra un hash (real o de relleno) para no filtrar por tiempo qué emails existen; error genérico `Invalid credentials`.
- Bloqueo de cuenta: 5 fallos seguidos → bloqueada 15 min (`failed_logins`, `locked_until`); la respuesta sigue siendo el mismo `401`.
- Token: JWT **solo HS256**, firmado con `JWT_SECRET`, expira en 1 h, se envía como `Authorization: Bearer` e incluye `tv` (`token_version`).
- `authMiddleware` valida el token **y** que `tv` coincida con el de la BD; `POST /api/auth/logout-all` lo incrementa y todos los tokens anteriores dejan de valer. Si no puede comprobarse, falla cerrado.
- Eventos de seguridad `AUDIT` (login, bloqueos, límites, sesiones) sin PII. Detalle y estado de cada medida en `Seguridad/02-hardening.md`.

### Datos

PostgreSQL con `users`, `profiles`, `swipes`, `matches` y `messages` (esta última pendiente). Reglas de negocio en BD: unicidad de swipe por par, borrado en cascada al eliminar usuario y match automático cuando ambos dicen sí. Consultas siempre parametrizadas (`$1`, `$2`…).

**Índices** (migración local `003`, aplicada): el orden base `(created_at DESC, id DESC)` y cada filtro del feed (tipo, ubicación) combinado con ese orden, más edad; en `matches`, por usuario y orden; en `messages`, por match y orden (chat). Se eliminaron los redundantes que ya cubren las restricciones `UNIQUE`. Comprobar con `EXPLAIN ANALYZE`.

**Match mutuo:** no hay trigger en la BD. `POST /api/swipes` lo crea dentro de una **transacción con bloqueo por pareja** (`pg_advisory_xact_lock`): si dos personas se dan "sí" a la vez, la segunda espera a la primera y no se pierde ningún match ni se duplica. La pareja se guarda en orden canónico (id menor primero). La API expone `neurotipo` aunque la columna se llame distinto.

### Variables de entorno

| Backend (`backend/.env`) | Uso |
|---|---|
| `NODE_ENV`, `PORT` | Modo y puerto (3001) |
| `FRONTEND_URL` | Lista blanca de orígenes CORS (varios separados por comas); obligatoria en producción |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` | Firma de tokens (≥ 48 bytes aleatorios) |
| `DB_POOL_MAX` | Conexiones máximas del pool (opcional, 10 por defecto) |

| Frontend (`frontend/.env.local`) | Uso |
|---|---|
| `VITE_API_URL` | URL de la API (solo `VITE_*` llega al navegador: nunca secretos) |

Plantillas en `backend/.env.example` y `frontend/.env.example`. Los `.env` reales nunca se versionan.

### Fotos de perfil (Supabase Storage)

Bucket `profile-photos`: público solo para **lectura** (URL directa, nombre de fichero aleatorio,
sin listado posible con la clave anon — comprobado). Todas las escrituras (subir, reemplazar, borrar)
las hace el backend con la **service key** (`SUPABASE_SERVICE_KEY`, nunca en el frontend, omite RLS).

- `POST /api/profiles/photo` (multipart, campo `photo`): valida tipo real por cabecera de fichero
  (no el `mimetype` que manda el navegador) y tamaño (≤ 5 MB); sube con nombre aleatorio bajo
  `{userId}/...`; borra la foto anterior del usuario si había. Devuelve `{ photo_url }`; el cliente
  la incluye al crear/editar el perfil (este endpoint no toca la base de datos).
- La URL pública pasa por el CDN de Supabase (`cache-control: max-age=300`): tras reemplazar una
  foto, la anterior puede seguir sirviéndose desde caché hasta 5 min aunque el origen ya la borró.
  Nunca se vuelve a devolver esa URL, así que no hay forma de encontrarla salvo tenerla ya guardada.

### Recuperar contraseña

`POST /forgot-password { email }` responde **siempre** el mismo mensaje genérico (exista o no la
cuenta): solo el email delata si funcionó. Si existe, genera un token aleatorio de 32 bytes, guarda
solo su SHA-256 en `users.reset_token_hash` (caduca en 30 min) y lo manda por email (`utils/email.js`,
Resend vía fetch directo, sin SDK). Enfriamiento de 2 min por cuenta para no repetir envíos, además
del límite de 3/hora por IP (compartido entre `forgot-password` y `reset-password`).

`POST /reset-password { token, password }` busca por el hash, comprueba que no haya caducado, cambia
`password_hash`, **limpia el token** (un solo uso) y sube `token_version` (cierra todas las sesiones
activas, no solo la que hizo el cambio). Mismo error genérico (`Invalid or expired token`) para token
inexistente, ya usado o caducado.

## 4. Frontend

- **Rutas:** un único `<BrowserRouter>` con dos ramas protegidas por layout (`RequireAuth`, `RedirectIfAuthed`), no dos árboles de router condicionales. Sin sesión → `/` (registro) y `/login` bajo `AuthLayout`; con sesión → `/dashboard`, `/profile/create`, `/feed`, `/matches`, todas bajo `AppShell`.
- **Navegación autenticada (`AppShell.jsx`):** una barra inferior fija con 4 pestañas (Inicio, Descubrir, Matches, Perfil), igual en las cuatro pantallas y con el mismo lenguaje visual (subrayado en `nura`) que el selector de Crear cuenta/Entrar de `AuthLayout`. Nada de menús que aparecen y desaparecen: "dónde estoy" se ve siempre igual.
- **Señales de compatibilidad (`ProfileFeed.jsx`):** calculadas en el cliente comparando el propio perfil con cada tarjeta (mismo neurotipo, misma ubicación, edad parecida ≤3 años). Se muestran como hechos literales, nunca como una puntuación o un porcentaje; no hay backend ni algoritmo de recomendación detrás.
- **Matches sin chat:** la lista de matches es real, pero el chat (US-009) no existe todavía. El botón dice "Escribir (disponible pronto)" y está deshabilitado a propósito: mejor eso que un enlace que lleve a ningún sitio.
- **A dónde va tras iniciar sesión:** lo decide solo `RedirectIfAuthed` (según `isAuthenticated` + `justSignedUp` del store). Ningún componente llama a `navigate()` justo después de `setAuth(...)`: hacerlo competía con esa redirección reactiva y a veces un registro nuevo acababa en `/dashboard` en vez de `/profile/create` (bug real, corregido; ver comentarios en `App.jsx` y `authStore.js`).
- **Estado:** `authStore` (Zustand) guarda `user`, `token`, `isAuthenticated`, `justSignedUp`. Hoy vive en memoria: recargar la página cierra la sesión.
- **API:** `api/client.js` (axios) añade el token a cada petición; en desarrollo Vite hace proxy de `/api` a `localhost:3001`.
- **UI:** Tailwind con tokens propios (ver `Design_System.md`). `AuthLayout` aloja el aura compartida y expone `setProgress` vía `Outlet context`.

## 5. Flujos clave

**Registro / login**
```
Signup → POST /api/auth/signup → { user, token } → authStore → /profile/create
Login  → POST /api/auth/login  → { user, token } → authStore → /dashboard
```

**Swipe y match**
```
Feed (GET /profiles/feed) → swipe (POST /swipes {swiped_id, action})
  → trigger en BD: si el otro ya dijo sí → crea match
  → respuesta { swipe, match | null } → si match, aparece en /matches
```

**Chat (previsto):** polling cada 2 s a los mensajes del match; upgrade a WebSocket/SSE solo si la UX lo pide.

## 6. Despliegue

| Pieza | Plataforma |
|---|---|
| Frontend | Vercel (SPA) |
| Backend | Render, Railway o Fly.io |
| Base de datos | PostgreSQL en Render o Supabase |
| Email | Resend o SendGrid (pendiente) |

HTTPS obligatorio en producción, con HSTS.

## 7. Herramientas

- **Gestor de paquetes:** npm (lockfiles `package-lock.json`). Bun 1.x está instalado en la máquina de desarrollo como alternativa; no mezclar gestores ni generar `bun.lock` sin acordarlo.
- **Pruebas:** checklist manual en el MVP; Playwright (con Brave vía `PW_EXECUTABLE_PATH`) para verificación visual y E2E puntual.

## 8. Decisiones de arquitectura

| Decisión | Motivo |
|---|---|
| Polling 2 s para el chat | Sin dependencias extra; se cambia solo si hace falta |
| SQL plano, sin ORM | Menos magia, más control y auditabilidad |
| Reglas de match en un trigger | Atómico y a prueba de condiciones de carrera |
| Sin TypeScript / Redux / Docker (MVP) | Velocidad y superficie mínima |
| JWT de 1 h sin refresh (por ahora) | Simplicidad; refresh token de 7 días previsto en el checklist |

## 9. Escalabilidad

**Ya aplicado**

| Medida | Efecto |
|---|---|
| Paginación por cursor con tope de `limit` | Coste constante por página y sin descargas masivas |
| Índices para filtros + orden del feed y de matches | Consultas por índice en lugar de escaneo completo |
| `NOT EXISTS` en el feed (antes `NOT IN`) | Usa el índice único de swipes; correcto con `NULL` |
| Un único pool de PostgreSQL (`db.js`) con `max`, timeouts y `statement_timeout` | Consumo de conexiones predecible; una consulta lenta no bloquea el pool |
| El cliente reemplaza la página del feed en vez de acumular | La memoria del navegador no crece con el uso |
| Backend sin estado (JWT, sin sesiones en servidor) | Se puede replicar horizontalmente |

**Siguientes pasos (cuando haya carga)**

1. **Rate limit compartido:** `express-rate-limit` cuenta en memoria por proceso; con varias réplicas cada una tiene su contador. Pasar a un almacén compartido (Redis) antes de escalar horizontalmente.
2. **Pooler de conexiones:** en Supabase usar la URL del *pooler* (modo transacción) y ajustar `DB_POOL_MAX` al límite de conexiones.
3. **Chat:** índice `messages(match_id, id DESC)` y paginación por cursor del historial desde el primer día.
4. **Fotos:** almacenamiento de objetos (Supabase Storage o S3) con CDN y tamaños derivados; nunca en la BD.
5. **Caché de lectura** (Redis) para perfiles muy consultados, solo si las métricas lo justifican.
6. **Observabilidad:** logs estructurados (JSON) y trazas de consultas lentas (`pg_stat_statements`).
7. **Índices a volumen alto:** crearlos con `CONCURRENTLY` para no bloquear escrituras.

