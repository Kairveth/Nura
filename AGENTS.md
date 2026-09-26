# AGENTS.md — Instrucciones para agentes (Nura)

Guía para cualquier agente de IA (o persona) que trabaje en este repo. **Léela entera antes de tocar código.**

## 1. Qué es Nura

Webapp de citas para personas neurodivergentes y neurotípicas: calma, claridad literal, seguridad psicológica, intención sobre volumen. MVP en 4 semanas (landing + beta).

Lee primero: `README.md`, `PRD.md` (qué y por qué), `Architecture.md` (cómo), `Design_System.md` (aspecto y copy) y `Especificacion/01-mvp-scope.md` (qué SÍ y qué NO).

## 2. Comandos

```bash
# Backend  (http://localhost:3001)
cd backend  && npm install && npm run dev        # node --watch src/index.js
# Frontend (http://localhost:3000, proxy /api → :3001)
cd frontend && npm install && npm run dev
cd frontend && npm run build                     # debe compilar sin errores
```

- Gestor oficial: **npm** (lockfiles `package-lock.json`). Bun está instalado en la máquina pero **no** se usa en el proyecto: no generes `bun.lock` ni mezcles gestores.
- **El esquema real de la BD es la fuente de verdad** (ids UUID; nombres distintos a los de la especificación). Está descrito en `migrations/000_baseline_schema.sql` (local, no versionada); la API mantiene su contrato (`neurotipo`, `action`). Antes de escribir SQL, comprueba las columnas reales. Las migraciones `003` (índices) y `004` (seguridad de `users`) ya están aplicadas; una BD nueva las necesita para que el login funcione.
- Entorno: copia `backend/.env.example` → `backend/.env` y `frontend/.env.example` → `frontend/.env.local`. El backend no arranca sin `JWT_SECRET` y `DATABASE_URL`.

## 3. Estructura y dónde va cada cosa

| Qué | Dónde |
|---|---|
| Rutas HTTP | `backend/src/routes/` |
| Lógica y validación | `backend/src/controllers/` |
| Middlewares (auth, rate limit, errores) | `backend/src/middleware/` |
| Pantallas | `frontend/src/pages/` |
| Componentes reutilizables | `frontend/src/components/` (reutiliza `Field` y `AuthLayout` antes de crear otros) |
| Estado global | `frontend/src/store/` (Zustand) |
| Cliente HTTP | `frontend/src/api/client.js` |
| Especificación / arquitectura / seguridad | `Especificacion/`, `Arquitectura/`, `Seguridad/` |

## 4. Reglas (no se rompen)

1. **El scope del MVP es ley.** Si una feature no está en `Especificacion/04-features-mvp.md`, pregunta antes. **No MVP:** push, video, IA, pagos, dark mode, analytics.
2. **Guiado por la especificación.** El código implementa user stories (`Especificacion/03-user-stories.md`), no ideas propias.
3. **Seguridad primero.** Todo cambio que toque auth, contraseñas, PII o datos de otros usuarios se contrasta con `Seguridad/01-checklist-10-puntos.md`.
4. **Sin sobreingeniería.** Polling de 2 s para el chat (no WebSocket), SQL plano (sin ORM), sin TypeScript/Redux/Docker. La solución más corta que funcione y sea segura.
5. **Commits estrechos.** Una cosa por commit, mensajes Conventional Commits (`feat:`, `fix:`, `chore:`…), asunto ≤ 50 caracteres.
6. **Prueba antes de dar por hecho.** Checklist manual + build + capturas para UI. Nunca declares "listo" sin haberlo verificado.

## 5. Seguridad y datos (obligatorio)

- **Nunca** subas al repo: `.env*` (salvo `.env.example`), claves y certificados, dumps o backups de BD, `migrations/`, `backend/logs.txt`, `node_modules`, ni nada de herramientas de agentes (`CLAUDE.md`, `.claude/`, `.agents/`, `skills-lock.json`).
- **Nunca** uses `git add .` ni `git add -A`: añade por rutas (`git add backend`). Hay un hook local `.git/hooks/pre-commit` que bloquea ficheros sensibles y diffs con cadenas de conexión o claves; no lo saltes (`--no-verify`).
- Consultas SQL **siempre parametrizadas** (`$1`, `$2`…); jamás interpolar entrada del usuario.
- **Valida en el servidor** tipo, formato y longitud de toda entrada (el frontend es solo comodidad).
- Las respuestas de la API **no devuelven** `password_hash`, emails de otros usuarios ni campos internos.
- Los logs no incluyen contraseñas, emails, tokens, contenido de mensajes ni PII: solo `user_id`, acción y hora.
- Errores al cliente: genéricos y sin detalles internos. Login: mismo error para "usuario no existe" y "contraseña errónea".
- Rate limiting en endpoints de auth (5 intentos / 15 min por IP) y por usuario en las rutas autenticadas (`userLimiter`).
- **Toda ruta nueva** nace con `authMiddleware` + `userLimiter` salvo que sea intencionadamente pública (y entonces con su propio límite). Sin rutas admin, sin `express.static`.
- Entrada de texto libre: pásala por `sanitizeText` (`utils/sanitize.js`) antes de validar y guardar. Listas blancas para todo valor cerrado (enums, orígenes, campos actualizables).
- Registra eventos de seguridad con `audit(evento, { user_id })`; nunca email, contraseña, token ni contenido.
- Auth: la respuesta a "no existe", "contraseña errónea" y "cuenta bloqueada" es idéntica. Los tokens de enlace (verificación, recuperación) se guardan **hasheados**, caducan (15–60 min) y son de un solo uso.
- Si algún día hay cookies: `HttpOnly; Secure; SameSite` + token CSRF. Si hay pagos, webhooks o IA, leer antes las reglas de `Seguridad/02-hardening.md` (#7–#10).
- Medidas aplicadas y reglas para funciones futuras: `Seguridad/02-hardening.md`.
## 5b. Escalabilidad (regla al escribir código)

- **Toda lista se pagina por cursor** con el contrato `{ data, next_cursor }` y `limit` con tope (`backend/src/utils/pagination.js`). Los ids son **UUID**: ordena por `(created_at DESC, id DESC)`, nunca por `id`. Nunca `OFFSET`, nunca listas sin límite.
- **Un filtro nuevo = un índice nuevo** que combine el filtro con el orden (`(columna, created_at DESC, id DESC)`). Añádelo en una migración local y comprueba con `EXPLAIN ANALYZE`.
- Usa el pool compartido `backend/src/db.js`; **no** crees más `new Pool`.
- Prefiere `NOT EXISTS` a `NOT IN`, selecciona solo las columnas necesarias y evita consultas dentro de bucles (N+1).
- El backend no guarda estado en memoria del proceso (salvo el rate limit, ver `Architecture.md` §9); piensa siempre en varias réplicas.
- En el cliente, no acumules listas sin límite: reemplaza páginas o usa "Ver más" explícito (sin scroll infinito, ver principios de producto).

## 6. UI y copy

Sigue `Design_System.md`. Resumen:

- Tema claro, tokens de `frontend/tailwind.config.js`; tipografía Bricolage Grotesque (titulares, peso normal, tracking `-0.04em`) + Atkinson Hyperlegible Next (cuerpo, nunca pesos finos).
- **Un solo botón relleno por vista.** Sin tarjetas con sombra ni degradados en UI. Los inputs llevan borde y **etiqueta visible**.
- Móvil primero; el formulario debe caber en 390×844 sin scroll.
- Foco visible, teclado completo, contraste AA, `prefers-reduced-motion`, objetivos táctiles ≥ 44 px, inputs de 16 px.
- Copy en español, literal, voz activa. Errores: qué pasó + cómo arreglarlo. Sin urgencia, sin sarcasmo, sin prometer nada fuera del MVP.

## 7. Flujo de trabajo por tipo de tarea

| Tarea | Pasos |
|---|---|
| **Feature nueva** | Leer la user story → revisar el stack → implementar backend + frontend → checklist de seguridad → prueba manual → commit |
| **Pantalla / UI** | Leer personas y `Design_System.md` → reutilizar componentes → diseñar móvil primero → verificar con Playwright a 1440×800, 390×844 y 375×667 (0 px de scroll extra en las dos primeras) → checklist de accesibilidad |
| **Backend / API** | Validar entradas → consulta parametrizada → no filtrar PII → probar con `curl` los casos 400/401/429 → revisar contra el checklist |
| **Cambio de esquema SQL** | Escribir el `.sql` en `migrations/` (local, no se commitea) → comprobar índices, FKs y rollback → probar en local → documentar en `Architecture.md` sin exponer datos |
| **Bug** | Reproducir → causa raíz (no el síntoma) → arreglar donde pasan todos los llamadores → verificar |
| **Revisión** | Spec cumplida · seguridad · sin `console.log` de producción · la API no devuelve `password` · consultas parametrizadas · rate limit en auth · errores sin fugas · GDPR |

## 8. Verificación

- `cd frontend && npm run build` sin errores.
- Backend: probar con `curl` (400 por validación, 401 credenciales, 429 rate limit). Recuerda que el rate limit de auth cuenta también las peticiones inválidas.
- UI: capturas con Playwright. En esta máquina se usa **Brave**: `PW_EXECUTABLE_PATH="C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"` y `headless: true`. Guarda las capturas en `playwright-artifacts/` (ignorado por git).
- Nunca pruebes con credenciales reales; usa emails de ejemplo.

## 9. Definición de hecho

Especificación cumplida ✓ · checklist de seguridad ✓ · build y pruebas manuales ✓ · sin ficheros sensibles en `git status` ✓ · commit estrecho ✓ · documentación actualizada si cambió el comportamiento ✓.

## 10. Estado y próximas tareas

**Hecho:** auth (API + UI rediseñada), API de perfiles y swipe, estructura del repo, protecciones de git.

**Siguiente, por prioridad:**
1. Cerrar la **deuda de seguridad** pendiente (lista local, no versionada: `Seguridad/PENDIENTES.local.md`).
2. UI de perfil (`ProfileCreate`) con foto (1) y descripción (200 caracteres) — US-003/004.
3. UI de feed y swipe (`ProfileFeed`, `MatchesList`) — pocos perfiles por sesión, sin scroll infinito — US-005 a US-008.
4. Chat 1:1 con polling de 2 s y recomendación de quedar — US-009 a US-011.
5. Ajustes: exportar y borrar cuenta (GDPR) — US-012/013; verificación de email.
6. Landing — US-014.

## 11. Cuando dudes

Pregunta. Si algo choca con el scope o con la seguridad, **el bloqueo se escala, no se ignora**.
