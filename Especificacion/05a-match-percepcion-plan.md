# 05a — Plan de implementación: Match por percepción (Fase A)

> Rama: `feature/match-percepcion`. Diseño: `Especificacion/05-match-percepcion.md` (leer primero).
> Plan generado con `make-plan` 2026-10-28, simplificado en revisión punto por punto (misma funcionalidad,
> sin infraestructura nueva). Ejecutar con `do`, fase a fase, en contextos nuevos. Cada fase es
> autocontenida: cita los ficheros a copiar y su verificación.
>
> **Principio rector:** sin complejidad innecesaria. La percepción vive como **columnas en `profiles`**
> (no tabla, controlador, rutas ni RLS nuevas) y se usa lo que ya existe.
>
> **Escrito para:** el agente que implemente cada fase sin más contexto que este fichero, el diseño y el
> código citado.

## Fase 0 — Descubrimiento (hecho; NO reimplementar, solo leer)

**Patrones a copiar (no inventar):**

| Qué | Dónde | Nota |
|---|---|---|
| Migración de columnas + comentario de esquema | `migrations/009_neurotipo_multiselect.sql`, `010_intention_and_chat_safety.sql` | Carpeta `migrations/` NO se versiona; aplicar en Supabase y registrar aquí. |
| Perfil: validación + create/update parcial | `backend/src/controllers/profileController.js` (`validateProfile`, `createProfile`, `updateProfile`, `getMyProfile`, `COLUMNS`) | `PUT` ya hace guardado parcial → sirve para el cuestionario progresivo. |
| Feed: reserva + reordenado de página | `profileController.js:199-296` (`getFeed`) + `utils/affinity.js` (`sortByAffinity`) | Base×Chispa SUSTITUYE a `sortByAffinity`, mismo patrón. |
| Swipe/match transaccional | `swipeController.js:34-93` | "Quiero conocerte" = relabel; NO se toca. |
| Formulario (UI) | `frontend/src/pages/ProfileCreate.jsx` + `components/Field.jsx` | Etiquetas visibles, errores accionables, tokens Nura. |
| Aura (firma) | `frontend/src/components/AuthLayout.jsx` | Reutilizar la idea para el cuestionario. |

**Anti-patrones (NO hacer):**
- No crear tabla/controlador/rutas de percepción: son columnas de `profiles`.
- No meter el neurotipo en la puntuación (solo muestra/filtra).
- No devolver la foto real en el feed (solo avatar).
- No mostrar un porcentaje de match.
- No añadir lógica de "valor neutro": sin las 6 respondidas, el feed va cronológico (como hoy sin perfil).

---

## Fase 1 — Modelo de datos y motor de puntuación (backend, sin UI)

**Qué implementar:**

1. **Migración `migrations/014_perception.sql`** (aplicar en Supabase; local, no git):
   ```sql
   ALTER TABLE profiles
     ADD COLUMN perc_ritmo        smallint CHECK (perc_ritmo        BETWEEN 1 AND 5),
     ADD COLUMN perc_estructura   smallint CHECK (perc_estructura   BETWEEN 1 AND 5),
     ADD COLUMN perc_sensorial    smallint CHECK (perc_sensorial    BETWEEN 1 AND 5),
     ADD COLUMN perc_comunicacion smallint CHECK (perc_comunicacion BETWEEN 1 AND 5),
     ADD COLUMN perc_emocional    smallint CHECK (perc_emocional    BETWEEN 1 AND 5),
     ADD COLUMN perc_social       smallint CHECK (perc_social       BETWEEN 1 AND 5),
     ADD COLUMN connection_note   varchar(200);
   ```
   `NULL` = sin responder (progresivo). `profiles` ya tiene RLS: nada más que hacer.

2. **`backend/src/utils/perception.js`** (nuevo), estilo `utils/affinity.js`:
   - `DIMENSIONS`: 6 entradas `{ key, column, kind }`:
     ritmo=complemento, estructura=complemento, sensorial=similitud, comunicacion=similitud,
     emocional=similitud, social=similitud.
   - `scoreMatch(mine, other)`: por dimensión respondida por AMBOS, `dist = |a−b|/4`;
     similitud → `1−dist`, complemento → `dist`. `base` = media de similitud respondidas;
     `chispa` = media de complemento respondidas; `match = base * chispa`.
     Si falta la base o la chispa completas (ninguna respondida en esa familia) → devolver `null`
     (= "aún no puntuable"; el feed lo tratará como orden cronológico, sin inventar valores).
   - `matchReason(mine, other)`: texto cualitativo (base común + en qué os complementáis), sin número.

**Verificación:**
- `node --check` de los ficheros.
- Script temporal en scratchpad: idénticos en base → base alta; opuestos en ritmo → chispa alta;
  base mala + chispa buena → match bajo; familia sin responder → `null`.
- `\d profiles` en psql: las 7 columnas nuevas presentes.

**Anti-patrones:** no usar neurotipo en `scoreMatch`; no exponer la fórmula como %.

---

## Fase 2 — API: perfil con percepción + feed por Base×Chispa

**Qué implementar (todo sobre ficheros que ya existen):**

1. **Percepción + manual de conexión en el perfil** (`profileController.js`):
   - `validateProfile`: aceptar `perc_*` (entero 1–5, opcional incluso al crear → progresivo) y
     `connection_note` (string ≤200, `sanitizeText`). NO obligatorias al crear.
   - `createProfile`/`updateProfile`: añadir las 7 columnas al INSERT/UPDATE explícito (sin mass-assignment).
   - `getMyProfile`: añadir las 7 a `COLUMNS`.
   - `accountController.js` export: incluir `perc_*` y `connection_note` en el bloque `profile`.
2. **Feed por Base×Chispa** (`getFeed`):
   - Cargar mis `perc_*` (ya se hace un `SELECT` del perfil propio para la afinidad: reutilizarlo).
   - Sustituir `sortByAffinity(...)` por `sortByPerception(mine, page.data)` (nuevo en `perception.js`,
     mismo contrato: reordena SOLO la página ya paginada; cursor calculado antes; no oculta a nadie).
     Si `scoreMatch` es `null` para una tarjeta, esa tarjeta mantiene el orden cronológico.
   - `FEED_COLUMNS`: **quitar `p.photo_url`** (foto real); añadir `p.perc_*`, `p.connection_note`.
     El avatar se genera en el cliente a partir de `user_id` (ya viene).
   - Cada tarjeta devuelve además `match_reason` (de `matchReason`).
3. **"Quiero conocerte"**: sin cambios en backend (el relabel es solo de UI).
4. **Foto real solo en match**: `getMatches`/`getMatch` ya devuelven `photo_url` real → no tocar.

**Verificación:**
- `PUT /api/profiles` con `perc_ritmo: 9` → 400; con `3` → 200; `GET /api/profiles/me` lo refleja.
- `GET /api/profiles/feed`: tarjetas con `match_reason` y SIN `photo_url` real; con dos cuentas de prueba
  de respuestas opuestas en ritmo + base parecida, suben entre sí.
- `connection_note` se guarda, vuelve en `/me` y sale en el export.
- `node security/daily-scan/scan.mjs` sigue en 0 fallos.

**Anti-patrones:** no reordenar antes de `toPage` (rompe el cursor); no dejar `photo_url` real en el feed.

---

## Fase 3 — Frontend: cuestionario progresivo + manual de conexión

**Qué implementar:**

1. **Página `frontend/src/pages/Percepcion.jsx`** + ruta en `App.jsx` dentro de `AppShell`:
   - 6 dimensiones, escala 1–5 (deslizador o 5 opciones), una pregunta por pantalla o scroll corto;
     mobile-first (cabe en 390×844). Copy literal, extremos nombrados (ver diseño). Reutilizar la idea del
     **aura** como firma; respetar `prefers-reduced-motion`.
   - Guarda con `PUT /api/profiles` (solo los `perc_*`). Progresivo: permite responder pocas y seguir.
2. **Manual de conexión** en `ProfileCreate.jsx`: nuevo `Field` (texto ≤200) "Cómo conectar conmigo", con
   ejemplos en la ayuda (etiqueta visible, no solo placeholder).
3. **Enlace "afina tu match"** desde `Dashboard.jsx` o el feed hacia `/percepcion` (sin widget de progreso
   en Fase A).

**Verificación (`playwright-skill`, Loop 6):** viewports 1440/390/375, capturas, medir scroll; responder
parcial → guardar → recargar → persiste; teclado; contraste/foco.

**Anti-patrones:** no formulario largo de una pantalla; no placeholder como única etiqueta.

---

## Fase 4 — Frontend: feed/match cualitativo + "Quiero conocerte" + avatar

**Qué implementar:**

1. **`frontend/src/components/Avatar.jsx`**: figura determinista del `user_id` (semilla → color/forma), en
   la línea del aura. ~30 líneas, sin dependencias. Se usa en feed y listas donde hoy iría la foto.
2. **`ProfileFeed.jsx`**: tarjeta con `match_reason` cualitativo (sin %), neurotipos (badges),
   `connection_note`, avatar. Botón primario **"Quiero conocerte"** (swipe 'yes'), secundario "Ahora no"
   ('no'). Un solo botón relleno por vista.
3. **`MatchesList.jsx` / `Chat.jsx`**: al haber match mostrar la **foto real** (ya la sirve la API) y, en el
   chat, el bloque "En qué os complementáis" (de `match_reason`).

**Verificación (`playwright-skill`):** feed con avatar y razón sin número; "Quiero conocerte" crea swipe y,
con reciprocidad, match; en el chat aparece foto real + complementariedad. Capturas a 3 viewports.

**Anti-patrones:** foto real en el feed; número de match; segundo botón relleno.

---

## Fase 5 — Seguridad y verificación final

1. **Ampliar `security/daily-scan/scan.mjs`** con probes: `PUT /api/profiles` con `perc_*` fuera de rango
   → 400; feed NO devuelve `photo_url` real; `connection_note` con `<script>` → se guarda escapado.
2. **Ejecutar** `node security/daily-scan/scan.mjs` (0 fallos) + checklist manual de las fases.
3. **Checklist `Seguridad/01-checklist-10-puntos.md`**: toca perfiles/PII → spot-check.
4. **Docs**: marcar lo hecho en `05-match-percepcion.md`; `02-hardening.md` si hay superficie nueva.
   (No hay tabla nueva → no hay RLS nueva que verificar.)

---

## Orden de ejecución y PR

Fases 1→2→3→4→5 consecutivas, commit estrecho por fase (`feat(match): ...`). Al cerrar: `code-review`
(Standards+Spec) + `web-design-guidelines` antes del PR a `main`. Migraciones y `*.local.md` no se commitean.

## Decisiones cerradas (de la revisión 2026-10-28)
1. Energía social #6 = similitud.
2. Escala 1–5.
3. Percepción = columnas en `profiles` (sin tabla/controlador/rutas/RLS nuevas).
4. Sin lógica de valor neutro: sin las 6 respondidas, feed cronológico.
