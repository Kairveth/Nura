# Nura — Design System

> Última actualización: 2026-09-26. Fuente de verdad del código: `frontend/tailwind.config.js` y `frontend/src/index.css`.
> `design.md` (raíz, solo local) es una referencia externa de otra marca (Dala): inspiración, no el look de Nura.

## 1. Idea

Nura se siente **calmada**: poca carga sensorial, lenguaje literal, ritmo propio. El diseño no compite por la atención; la aquieta. Tema **claro** (el dark mode queda fuera del MVP).

**Firma visual — el aura:** una mancha difusa que respira despacio. A medida que la persona completa un paso, se enfoca en un círculo definido y quieto. Es la única imagen firma; no se duplica en cada pantalla.

## 2. Principios

1. **Calma.** Nada parpadea, nada compite. Movimiento lento y con propósito.
2. **Claridad literal.** Cada control dice qué hace. Sin sarcasmo ni "vibes".
3. **Seguridad psicológica.** Sin urgencia falsa, sin dark patterns.
4. **Intención sobre volumen.** 3–5 acciones visibles como máximo; 1–2 elementos por viewport.
5. **Jerarquía por escala, no por peso.** Titulares grandes con tracking negativo; el cuerpo no adelgaza nunca.
6. **Un solo elemento relleno por vista:** el botón de acción principal.

## 3. Color

| Token | Valor | Uso |
|---|---|---|
| `fog` | `#EEF0F5` | Fondo de página |
| `ink` | `#171B2E` | Texto principal, titulares |
| `mute` | `#575D75` | Texto secundario, ayudas |
| `line` | `#D3D8E6` | Bordes de inputs |
| `nura` | `#4F5BFF` | Acción principal, foco, enlace activo |
| `nura-deep` | `#3A45E0` | Hover de la acción principal |
| `dawn` | `#FFC2A8` | Aura (calidez) |
| `sage` | `#9FD8C1` | Aura (calma), estados correctos |
| `alert` | `#B3261E` | Errores |

Reglas: contraste WCAG AA como mínimo (`mute` sobre `fog` ≈ 5.6:1). `nura` es color de acción y acento, **no** de superficies grandes. Sin degradados en componentes de interfaz (solo en el aura, que es imagen).

## 4. Tipografía

| Rol | Familia | Peso | Notas |
|---|---|---|---|
| Display / titulares | Bricolage Grotesque | 400 (normal) | `font-stretch` 85–88 %, tracking `-0.04em` |
| Cuerpo y UI | Atkinson Hyperlegible Next | 400 · 500 · 600 · 700 | Diseñada para legibilidad; **nunca** pesos finos en cuerpo |
| Wordmark | Bricolage Grotesque | 700 | Minúsculas: `nura` |

Escala usada: título de formulario 36 px (móvil) → 44 px (`sm`+); titular de escena 60 → 72 px; cuerpo 16 px; ayudas y etiquetas 14 px. Los inputs son de **16 px** para evitar el zoom automático en iOS.

## 5. Espaciado, forma y elevación

- **Espaciado:** escala de Tailwind, ritmo de 4 px. Formularios: `space-y-4` entre campos. Objetivos táctiles ≥ 44 px (botones e inputs de 48 px en móvil, 56 px desde `sm`).
- **Radio:** `rounded-2xl` (16 px) en inputs y botones; `rounded-full` solo en el aura. Un único radio por familia de componente.
- **Elevación:** ninguna. Sin sombras ni tarjetas: se separa con espacio en blanco. **Excepción:** los inputs llevan borde (`line`) porque necesitan mostrar claramente que se pueden editar.
- **Layout:** móvil primero. Escritorio en dos paneles (escena con aura + formulario). Todo el formulario debe caber en una pantalla de 390×844 sin scroll.

## 6. Movimiento

- **Aura:** `breathe` 9 s y `drift` 13 s, en bucle, muy sutil. Se enfoca con transición de 900 ms al completar el formulario.
- **Entrada del formulario:** `rise` 500 ms (desvanece y sube 8 px), una sola vez.
- **Microinteracciones:** 200 ms (color y `scale(0.98)` al pulsar).
- **`prefers-reduced-motion`:** las animaciones se desactivan por completo y las transiciones pasan a ~0 ms.
- Nada que parpadee o se mueva bruscamente. CSS primero; GSAP solo si el swipe lo requiere.

## 7. Componentes

### Botón principal
Relleno `nura`, texto blanco 600, `rounded-2xl`, 48/56 px de alto, ancho completo en formularios. Hover `nura-deep`, `active:scale-[0.98]`, deshabilitado a 40 % de opacidad con cursor `not-allowed`. Foco: contorno de 2 px `nura` con desplazamiento de 4 px. **Solo uno por vista** en formularios. Excepción: una elección binaria genuina (el swipe "Pasar" / "Me interesa") son dos botones del mismo tamaño, uno con borde y uno relleno — no dos rellenos, y sin código de color rojo/verde (los rótulos ya son literales).

### Botón deshabilitado y honesto
Cuando algo no está construido todavía (el chat de un match, por ejemplo), el control existe pero está deshabilitado de verdad (`disabled`, cursor `not-allowed`, borde `line`) y dice cuándo llegará ("disponible pronto"). Nunca un enlace o clic que no lleve a ningún sitio.

### Enlace de texto (acción secundaria)
Sin contenedor. `mute` por defecto, `ink` al pasar el ratón. El activo lleva subrayado de 2 px en `nura`. Zona táctil ≥ 44 px. Ejemplos: selector "Crear cuenta / Entrar", "Mostrar / Ocultar" contraseña.

### `Field` (`components/Field.jsx`)
Etiqueta **siempre visible** encima (nunca solo placeholder), input de borde `line`, fondo blanco translúcido, `rounded-2xl`. Foco: borde `nura` + anillo `nura/20`. Error: borde `alert`. Ayuda opcional debajo (`mute`, 14 px). Si es de contraseña, incluye botón "Mostrar/Ocultar".

### `AuthLayout` (`components/AuthLayout.jsx`)
Escena con aura + formulario. Expone `setProgress(0–1)` por `Outlet context`: las páginas informan el avance y el aura se enfoca. En móvil la escena es una banda superior (`18dvh`, entre 112 y 192 px). El selector "Crear cuenta / Entrar" solo aparece en esas dos rutas; en recuperar/restablecer contraseña se oculta en vez de marcar una pestaña que no aplica.

### `AppShell` (`components/AppShell.jsx`)
Navegación de toda la app autenticada: barra inferior fija, 4 pestañas con etiqueta de texto (nunca solo icono), mismo lenguaje visual de subrayado en `nura` que el selector de `AuthLayout`. Misma barra, en el mismo sitio, en todas las pantallas — nada de menús que aparecen y desaparecen. Excepción: `Chat` no la lleva, por el mismo motivo que `AuthLayout` tiene su propia escena (necesita el alto entero para la conversación).

### Tarjeta de perfil (`ProfileFeed.jsx`)
Un perfil a la vez, nunca una pila. Foto arriba (`aspect-[4/5]`), datos y descripción completa debajo (sin recortar el texto). Sin sombra, borde `line`. Chips de compatibilidad: hechos literales (etiquetas de neurotipo compartidas, misma ciudad, edad parecida), fondo `sage/15` con borde `sage` — nunca un porcentaje ni una puntuación.

### Burbujas de chat (`Chat.jsx`)
Propias a la derecha, relleno `nura` y texto blanco; del otro a la izquierda, borde `line` sobre blanco translúcido. Sin avatares repetidos en cada burbuja (ya está el nombre en la cabecera). El aviso de "considera quedar" (US-010) usa `sage`, igual que el banner de match del feed: mismo tono para "esto es bueno, tranquilo" en toda la app.

### Mensaje de error
Zona `role="alert"` con `aria-live="polite"`, texto `alert` 600. Dice **qué pasó y cómo arreglarlo**, sin disculpas vagas.

## 8. Voz y copy

- Español, voz activa, frases cortas, sentence case.
- Una acción, un nombre en todo el flujo: "Crear cuenta" → "Cuenta creada".
- Errores: qué pasó + qué hacer. Ej.: "Ese email ya tiene una cuenta. Entra con ella".
- Sin urgencia ("¡Solo hoy!"), sin humor ambiguo, sin promesas fuera del MVP (1 foto, 200 caracteres, chat de texto, datos exportables).
- Los titulares son una propuesta de valor literal en una frase. Ej.: "Menos perfiles. Más intención."

## 9. Accesibilidad (mínimos)

WCAG 2.2 AA · foco visible en todo control · navegación completa por teclado · etiquetas asociadas (`htmlFor`) · `aria-invalid`, `aria-describedby`, `aria-current` · `autoComplete` correcto · `prefers-reduced-motion` respetado · `lang="es"`.

## 10. Hacer y no hacer

**Hacer:** reutilizar `Field` y `AuthLayout`; tokens del `tailwind.config.js`; verificar en móvil real o con Playwright a 1440×800, 390×844 y 375×667.
**No hacer:** cuerpo en pesos finos; tarjetas con sombra; más de un botón relleno por vista; degradados en UI; emojis de relleno; contenido que compita con el flujo; colores fuera de los tokens.

## 11. Verificación de UI

1. `npm run build` en `frontend/` sin errores.
2. Capturas con Playwright (Brave: `PW_EXECUTABLE_PATH`) en 1440×800, 390×844 y 375×667.
3. Medir scroll extra: 0 px en las dos primeras; ≤ 40 px aceptable en 375×667.
4. Revisar contraste, foco, teclado y reduced-motion.
