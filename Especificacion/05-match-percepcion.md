# 05 — Rediseño del Match por percepción

> Rama: `feature/match-percepcion`. Diseño cerrado 2026-10-28 (fase brainstorming).
> Fuente de verdad del producto para `make-plan`/`do`. Sustituye al match actual (swipe por foto).

## Por qué

El match actual empareja como Tinder: por foto y por lo que tenéis en común. Para los usuarios de Nura
(neurodivergentes y neurotípicos buscando conexión real) eso falla: la cara no dice si vais a conectar, y
"gustos en común" es ruido. Nura empareja por **cómo percibís la vida** — cómo pensáis, sentís, os
comunicáis y necesitáis vivir. La hipótesis: la compatibilidad real está ahí, no en el aspecto.

## Decisiones cerradas

1. **El neurotipo deja de puntuar.** Solo se muestra y se usa como filtro. No suma ni resta en el match.
2. **La foto es un avatar.** No se da "me gusta" por aspecto. La foto real solo se ve **después** del match
   (va con bucket privado + URLs firmadas; ver `PENDIENTES.local.md`). En el feed se muestra el avatar.
3. **Match por percepción, híbrido por dimensión** (cada dimensión empareja por similitud o por complemento).
4. **Cuestionario progresivo:** 6 dimensiones al registrarse (basta para el primer match), más con el uso.
5. **Match cualitativo, sin porcentaje.** Se muestra el *porqué*, no un número.
6. **La acción es "Quiero conocerte"** (no like/pass por foto), decidida sobre la tarjeta de percepción +
   avatar + manual de conexión. El match sigue siendo **mutuo**.
7. **Manual de conexión** en el perfil: "cómo conectar conmigo".

## Las 6 dimensiones (día 1)

Cada una es un espectro; la persona se sitúa en una escala. La columna "empareja por" define la puntuación.

| # | Dimensión | Un extremo | Otro extremo | Empareja por |
|---|---|---|---|---|
| 1 | Ritmo mental | salto entre muchas ideas | voy profundo en una | **complemento** |
| 2 | Estructura del día | fluyo sin plan | necesito rutina y previsibilidad | **complemento** |
| 3 | Energía sensorial | busco estímulo e intensidad | necesito calma y poco ruido | **similitud** |
| 4 | Comunicación | literal y directa | leo entre líneas y tono | **similitud** |
| 5 | Mundo emocional | lo siento todo muy intenso | regulado y contenido | **similitud** |
| 6 | Energía social | me recargo con gente | me recargo a solas | **similitud** |

- **1 y 2 = la chispa** (cómo se mueven vuestras mentes; encajan los opuestos, el "TDAH busca a su TEA").
- **3-6 = la base común** (cómo necesitáis vivir, comunicaros y sentir; el desajuste aquí es fricción).

**Dimensiones del modo progresivo (se piden más adelante, con el uso):** enfoque de interés, gestión del
cambio, toma de decisiones (impulso ↔ análisis = complemento), necesidad de cercanía.

El copy exacto de cada extremo se pule en implementación (voz Nura: literal, en español, frases cortas).

## Modelo de puntuación: base × chispa

Cada dimensión se responde en una escala (p. ej. 1–5). Para dos personas A y B, por dimensión *d* con
distancia normalizada `dist ∈ [0,1]`:

- Dimensión de **similitud**: `s_d = 1 − dist` (respuestas cercanas → alto).
- Dimensión de **complemento**: `s_d = dist` (respuestas en lados opuestos → alto).

Dos sub-puntuaciones:
- **Base** = media de las dimensiones de similitud respondidas por ambos (3, 4, 5, 6).
- **Chispa** = media de las dimensiones de complemento respondidas por ambos (1, 2).

**Match = Base × Chispa** (multiplicativo): una base pobre no se rescata con chispa. Dos personas que
chocan en lo sensorial y comunicativo no encajan aunque sus mentes se complementen.

Solo cuentan las dimensiones que **ambas** han respondido (progresivo → no todos han contestado todo). Con
pocas dimensiones el match es preliminar; se puede indicar ("afina tu perfil para mejores matches").

## Cómo se muestra (cualitativo, sin %)

En la tarjeta de un match / candidato, en lenguaje Nura:

> **Base común:** calma, comunicación directa.
> **Os complementáis en:** el ritmo (tú profundo, él salta entre ideas).

El detalle de "en qué os complementáis / qué os puede costar" se enseña **dentro del chat** tras el match,
no en el feed (reduce el juicio por adelantado; da de qué hablar).

## Manual de conexión (perfil)

Campo nuevo del perfil: cómo prefiere la persona que conecten con ella. Formato a decidir en el plan
(texto libre corto con tope de caracteres, o 2-3 opciones predefinidas + libre). Ejemplos:
"respondo mejor a mensajes directos", "necesito un rato para contestar, no es desinterés", "los audios me agobian".

## Hoja de ruta por fases (decidido 2026-10-28)

Se construye por fases, subiendo la apuesta solo cuando la anterior funciona:

- **Fase A — coste bajo (esta rama).** Núcleo del match por percepción: 6 dimensiones, `Base × Chispa`,
  cuestionario progresivo, neurotipo solo muestra/filtra, foto como avatar, **manual de conexión**,
  **match cualitativo (sin %) + acción "Quiero conocerte"**. Es lo que entra ahora en `make-plan`.
- **Fase B — coste medio (cuando A esté OK).** **Abridores de conversación** generados del match.
- **Fase C — 2ª iteración.** **"Lo innegociable"** (peso personalizado por dimensión) y **preguntas por
  escenario** (en vez de autoevaluación).

## Decisiones abiertas (defaults propuestos; confirmables en implementación)

1. **Energía social (#6):** por defecto **similitud**; revisable a complemento si los datos lo piden.
2. **Escala de respuesta:** 1–5 por dimensión (deslizador o 5 opciones). A fijar en el plan.
3. **Reformulación del copy** de los extremos de cada dimensión.

## Impacto técnico (lo detalla `make-plan`)

- Nuevo almacén de respuestas de percepción por usuario (tabla/columnas) con RLS (ver
  [[supabase-new-tables-rls]]).
- Recalcular el feed/orden por `Base × Chispa` en vez de por afinidad de neurotipo.
- La acción de swipe pasa a "Quiero conocerte"; revisar `swipeController`/`matches`.
- Campo manual de conexión en `profiles`.
- Foto: feed sirve avatar; foto real solo tras match (bucket privado + URL firmada).
- Migraciones nuevas: toda `CREATE TABLE` en public lleva `ENABLE ROW LEVEL SECURITY`.
- La suite de seguridad diaria debe cubrir los endpoints nuevos.
