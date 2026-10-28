# 05a — Plan de implementación: Match por percepción (Fase A)

> Rama: `feature/match-percepcion`. Diseño: `Especificacion/05-match-percepcion.md` (leer primero).
> Plan generado con `make-plan` 2026-10-28. Ejecutar con `do`, fase a fase, en contextos nuevos.
> Cada fase es autocontenida: cita los ficheros a copiar y su verificación.
>
> **Escrito para:** el agente (posiblemente un modelo más barato) que implemente cada fase sin más
> contexto que este fichero, el diseño y el código citado.

## Fase 0 — Descubrimiento (hecho; NO reimplementar, solo leer)

**APIs/patrones permitidos (copiar de aquí, no inventar):**

| Qué | Dónde copiarlo | Nota |
|---|---|---|
| DDL + RLS de tabla nueva | `migrations/011_lock_down_public_grants.sql`, `migrations/013_keep_reports_after_deletion.sql` | Toda tabla: `ENABLE ROW LEVEL SECURITY`. Carpeta `migrations/` NO se versiona. |
| Controller + ruta | `backend/src/controllers/profileController.js` + `backend/src/routes/profile.js` | Validación server-side, `pool.query` parametrizado, errores JSON. |
| Reserva de feed + reordenado | `profileController.js:199-296` (`reserveFeedQuota`, `getFeed`) + `utils/affinity.js` | Base×Chispa SUSTITUYE a `sortByAffinity`. |
| Swipe/match transaccional | `swipeController.js:34-93` (`createSwipe`) | Advisory lock por pareja; direction `yes`/`no`; match canónico `LEAST/GREATEST`. |
| Constantes compartidas | `backend/src/utils/limits.js` | Topes nuevos van aquí, no repetidos. |
| Formulario (UI) | `frontend/src/pages/ProfileCreate.jsx` + `components/Field.jsx`, `CheckboxGroup.jsx` | Etiquetas visibles, errores accionables, tokens Nura. |
| Layout/aura (firma) | `frontend/src/components/AuthLayout.jsx` | Reutilizar la idea del aura que respira para el cuestionario. |

**Anti-patrones (NO hacer):**
- No tocar `migrations/` como si se commiteara (está en `.gitignore`); aplicar en Supabase y registrar en el plan.
- No exponer `neurodivergence_types` como puntuación: el neurotipo NO puntúa (solo muestra/filtra).
- No devolver la foto real en el feed (solo avatar); la foto real es solo en match.
- No usar un porcentaje de match en la UI.
- No crear tablas sin RLS.

---

## Fase 1 — Modelo de datos y motor de puntuación (backend, sin UI)

**Qué implementar:**

1. **Migración `migrations/014_perception.sql`** (aplicar en Supabase; local, no git):
   - Tabla `perception_answers(user_id uuid PK REFERENCES users ON DELETE CASCADE, dim1..dim6 smallint,
     answered_count smallint GENERATED o calculado, updated_at timestamptz)`. Alternativa normalizada
     `(user_id, dimension smallint, value smallint, UNIQUE(user_id,dimension))` — **decidir**: columnas
     anchas (más simple para 6 fijas) es suficiente para Fase A.
   - Valores `smallint` 1–5, `NULL` = sin responder (progresivo). `CHECK (value BETWEEN 1 AND 5)`.
   - `ALTER TABLE profiles ADD COLUMN connection_note varchar(200)` (manual de conexión).
   - `ALTER TABLE perception_answers ENABLE ROW LEVEL SECURITY;` (sin políticas → solo el rol postgres del backend).
   - Índice si hace falta para el join del feed.

2. **`backend/src/utils/perception.js`** (nuevo), copiando el estilo de `utils/affinity.js`:
   - `DIMENSIONS`: array de 6 con `{ key, kind: 'similitud'|'complemento' }` según la tabla del diseño
     (1 ritmo=complemento, 2 estructura=complemento, 3 sensorial, 4 comunicación, 5 emocional, 6 social=similitud).
   - `scoreMatch(mine, other)`: por dimensión respondida por AMBOS, `dist = |a−b| / 4`;
     similitud → `1−dist`, complemento → `dist`. `base` = media de las de similitud; `chispa` = media de
     complemento; `match = base * chispa`. Si falta base o chispa (nadie respondió esa familia aún),
     usar neutro documentado (p. ej. tratar familia vacía como 1 para no anular, y marcar `preliminary`).
   - `matchReason(mine, other)`: devuelve texto cualitativo (base común + en qué os complementáis), sin número.

**Verificación:**
- `node --check` de los ficheros nuevos.
- Script de prueba temporal en scratchpad: casos (dos idénticos en base → base alta; opuestos en ritmo →
  chispa alta; base mala + chispa buena → match bajo). Confirmar `base*chispa` y el texto.
- `\d perception_answers` en psql: columnas y RLS activo.

**Anti-patrones:** no meter el neurotipo en `scoreMatch`; no exponer la fórmula como % en ningún sitio.

---

## Fase 2 — API: cuestionario + feed/match recableados

**Qué implementar:**

1. **Endpoints de percepción** (nuevo `controllers/perceptionController.js` + `routes/perception.js`, montar
   en `index.js` como `/api/perception`, con `authMiddleware` + `userLimiter`):
   - `GET /api/perception/me` → mis respuestas + `answered_count` + qué dimensiones faltan.
   - `PUT /api/perception` → guarda/actualiza respuestas (parcial, progresivo). Validar 1–5 y dimensión válida.
2. **Manual de conexión** en `profileController.js`: añadir `connection_note` a `validateProfile`
   (string ≤200, `sanitizeText`), a `createProfile`/`updateProfile` (columna explícita, sin mass-assignment),
   a `getMyProfile` (`COLUMNS`) y al export de `accountController.js`.
3. **Feed por Base×Chispa** en `getFeed` (`profileController.js`):
   - Cargar mis respuestas de percepción una vez.
   - Sustituir `sortByAffinity(...)` por un reordenado con `scoreMatch` (mismo patrón: reordena SOLO la
     página ya paginada; el cursor se calcula antes; nunca oculta a nadie).
   - En cada tarjeta del feed devolver: avatar (NO `photo_url` real), `match_reason` cualitativo,
     `neurotipos` (mostrar/filtrar), `connection_note`. Quitar `photo_url` real del `FEED_COLUMNS`.
4. **Acción "Quiero conocerte"**: mantener el motor de `swipes` (`direction 'yes'/'no'`, match mutuo) — es
   solo relabel de producto. Verificar que nada en backend asume semántica de "like por foto". (Sin cambio
   de esquema.)
5. **Foto real solo en match**: en `getMatches`/`getMatch` (`swipeController.js`) seguir devolviendo
   `photo_url` real (ya lo hacen). En el feed, no. *(La protección fuerte —bucket privado + URL firmada— se
   deja como hardening en `PENDIENTES.local.md`; en Fase A basta con que la API no sirva la foto real en el feed.)*

**Verificación:**
- `GET /api/perception/me` sin responder → vacío; `PUT` con valor 9 → 400; con 3 → 200; `GET` lo refleja.
- `GET /api/profiles/feed` → las tarjetas traen `match_reason` y avatar, NO `photo_url` real; orden cambia
  según percepción (dos cuentas de prueba con respuestas opuestas en ritmo suben entre sí).
- `connection_note` se guarda, vuelve en `/me` y sale en el export.
- Batería existente sigue verde (`node security/daily-scan/scan.mjs`).

**Anti-patrones:** no romper el cursor del feed (reordenar después de `toPage`); no filtrar foto real en el feed.

---

## Fase 3 — Frontend: cuestionario progresivo + manual de conexión

**Qué implementar:**

1. **Página del cuestionario** `frontend/src/pages/Percepcion.jsx` + ruta en `App.jsx` dentro de `AppShell`:
   - 6 dimensiones como deslizadores o 5 opciones (reutilizar/estilar `Field`/`CheckboxGroup`), una
     pregunta por pantalla o scroll corto; mobile-first (cabe en 390×844).
   - Copy literal en español, extremos nombrados (ver diseño). Reutilizar la idea del **aura** (`AuthLayout`)
     como firma: una por pantalla, movimiento lento, respeta `prefers-reduced-motion`.
   - Guarda con `PUT /api/perception`. Progresivo: permite responder pocas y seguir; estado "afina tu match".
2. **Manual de conexión** en `ProfileCreate.jsx`: nuevo `Field` (texto ≤200) "Cómo conectar conmigo", con
   ejemplos como placeholder+ayuda (etiqueta visible).
3. **Onboarding**: tras crear perfil, invitar (sin obligar) a responder el cuestionario; `Dashboard.jsx`
   muestra el progreso ("Has respondido 3 de 6 — afina tu match").

**Verificación (`playwright-skill`, ver Loop 6):** viewports 1440/390/375, capturas, medir scroll; flujo:
responder parcial → guardar → recargar → persiste; teclado; contraste/foco.

**Anti-patrones:** no formulario largo de una sola pantalla; no placeholder como única etiqueta.

---

## Fase 4 — Frontend: feed/match cualitativo + "Quiero conocerte" + avatar

**Qué implementar:**

1. **Avatar procedural** (componente `Avatar.jsx`): figura determinista a partir del `user_id` (semilla →
   color/forma), en la línea del aura de Nura. Sin subir nada. Se usa en feed y listas.
2. **`ProfileFeed.jsx`**: tarjeta de percepción con `match_reason` cualitativo (sin %), neurotipos (badges),
   `connection_note`, avatar. Botón primario **"Quiero conocerte"** (relabel del swipe 'yes'), secundario
   "Ahora no" ('no'). Un solo botón relleno por vista (identidad).
3. **`MatchesList.jsx` / `Chat.jsx`**: al haber match, mostrar la **foto real** (ya la sirve la API) y, dentro
   del chat, el bloque "En qué os complementáis / qué os puede costar" (de `match_reason` extendido).

**Verificación (`playwright-skill`):** feed muestra avatar y razón sin número; "Quiero conocerte" crea swipe
y, con reciprocidad, match; en el chat aparece foto real + complementariedad. Capturas a 3 viewports.

**Anti-patrones:** no mostrar foto real en el feed; no número de match; no segundo botón relleno.

---

## Fase 5 — Seguridad y verificación final

1. **RLS**: confirmar `perception_answers` con RLS activo; el backend (rol postgres) la usa, PostgREST anon no.
2. **Ampliar la suite** `security/daily-scan/scan.mjs`: probes nuevos — `PUT /api/perception` con valor fuera
   de rango → 400; IDOR (leer percepción de otro) → no se puede; feed NO filtra foto real; `connection_note`
   con `<script>` → se guarda escapado.
3. **Ejecutar**: `node security/daily-scan/scan.mjs` (debe seguir 0 fallos) + checklist manual de las fases.
4. **Checklist `Seguridad/01-checklist-10-puntos.md`**: toca perfiles/PII → spot-check.
5. **Docs**: actualizar `02-hardening.md` si hay superficie nueva; marcar en `05-match-percepcion.md` lo hecho.

---

## Orden de ejecución y PR

Fases 1→2→3→4→5 consecutivas, commit estrecho por fase (`feat(match): ...`). Al cerrar: `code-review`
(Standards+Spec) + `web-design-guidelines` (hay UI) antes del PR a `main`. Migraciones y `*.local.md` no se
commitean.

## Decisiones abiertas heredadas del diseño (resolver en Fase 1)
1. Energía social #6: default similitud.
2. Escala 1–5 por dimensión.
3. Columnas anchas vs tabla normalizada para `perception_answers` (default: anchas, 6 fijas).
