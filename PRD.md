# Nura — Product Requirements Document (PRD)

> Versión MVP · Última actualización: 2026-09-26
> Detalle complementario: `Especificacion/` (scope, personas, user stories, features) y `Seguridad/01-checklist-10-puntos.md`.

## 1. Resumen

Nura es una webapp de citas para personas neurodivergentes y neurotípicas que quieren una conexión real, sin la sobrecarga sensorial y social de las apps de citas convencionales. Menos perfiles, más intención; interfaz calmada, lenguaje literal y ritmo propio.

**Objetivo del MVP:** validar mercado y viabilidad técnica con una landing y una beta funcional en 4 semanas.

## 2. Problema

Las apps de citas actuales generan rechazo en este público por:

- **Sobrecarga:** swipe infinito, fotos y estímulos constantes.
- **Ambigüedad social:** señales implícitas, sarcasmo, juegos de matching.
- **Presión de imagen:** fotos perfectas, "venderse".
- **Inseguridad:** ghosting y exposición de personas vulnerables a explotación.

## 3. Usuarios

| Persona | Perfil | Necesita |
|---|---|---|
| **Alejandra**, 28 (TDAH + ansiedad social) | Introvertida, cansada del swipe infinito | Interfaz limpia, sesiones de ~5 min, chat directo |
| **Carlos**, 32 (autismo nivel 1) | Literal, busca conexión real | Descripciones claras, intención explícita, sin sarcasmo en la UX |
| **Sofía**, 26 (neurotípica) | Psicóloga, empática | Gente sensible y transparente, pocas conexiones pero intencionales, seguridad |

Detalle en `Especificacion/02-user-personas.md`.

## 4. Principios de producto

1. **Sobrecarga = rechazo.** Menos opciones, más foco: 3–5 acciones visibles como máximo.
2. **Claridad literal.** Cada botón dice qué hace; ningún mensaje implícito.
3. **Seguridad psicológica.** Sin presión, sin urgencia falsa, sin dark patterns.
4. **Intención sobre volumen.** Pocos perfiles por sesión, sin scroll infinito.
5. **Autonomía.** El usuario marca su ritmo.

## 5. Alcance del MVP

### Entra

| Área | Requisito |
|---|---|
| Auth | Registro y login con email + contraseña; verificación de email |
| Perfil | 1 foto obligatoria, descripción de máx. 200 caracteres, edad (18–120), ubicación, tipo de neurodivergencia |
| Matching | Filtros simples (edad, ubicación, tipo) y swipe sí/no; match solo si es mutuo |
| Chat | 1:1 de texto (emoji y enlaces), historial básico, recomendación de "quedar tras 5–10 mensajes" |
| Privacidad | Descargar y borrar los propios datos (GDPR) |
| Landing | Explica qué es Nura en 30 segundos, con CTA de registro |

### No entra

Notificaciones push, video chat, verificación facial, pagos, IA de recomendación, features sociales (grupos, posts), panel de administración, A/B testing, analytics, dark mode, internacionalización.

> Regla: si una feature no está en `Especificacion/04-features-mvp.md`, se pregunta antes de construirla.

## 6. Requisitos funcionales

Ids según `Especificacion/03-user-stories.md`.

| Id | Historia | Criterio de aceptación clave | Estado |
|---|---|---|---|
| US-001 | Registrarme con email + contraseña | Validación en servidor, error claro, sesión creada | Hecho (falta verificación de email) |
| US-002 | Iniciar sesión | JWT 1 h, logout limpia sesión | Hecho (sesión en memoria, no persiste al recargar) |
| US-003 | Crear perfil | 1 foto + 200 caracteres, vista previa | Hecho (foto en Supabase Storage) |
| US-004 | Editar perfil | Cambios visibles al momento | Hecho (misma pantalla que US-003, detecta perfil existente) |
| US-005 | Ver otros perfiles | Foto, descripción, edad y tipo legibles | API hecha; UI sin rediseñar |
| US-006 | Filtrar | Edad, ubicación, tipo; sin filtro = todos | API hecha; UI pendiente |
| US-007 | Swipe sí/no | Botones grandes, confirmación silenciosa | API hecha; UI sin rediseñar |
| US-008 | Ver matches | Lista; clic abre el chat | API hecha; UI sin rediseñar |
| US-009 | Chat 1:1 | Historial, mensajes en 0–3 s (polling 2 s) | Pendiente |
| US-010 | Recomendación de quedar | Banner discreto, una sola vez, se puede cerrar | Pendiente |
| US-011 | Indicador de mensajes nuevos | Badge que desaparece al leer | Pendiente |
| US-012 | Borrar mi cuenta | Doble confirmación, borrado en cascada | Pendiente |
| — | Olvidé mi contraseña | Email con enlace de un solo uso, caduca en 30 min | Hecho (Resend, dominio de pruebas) |
| US-013 | Descargar mis datos | JSON con perfil, chats y matches | Pendiente |
| US-014 | Landing | Hero + 3 puntos, responsive | Pendiente |

## 7. Requisitos no funcionales

- **Seguridad (innegociable):** contraseñas con bcrypt, JWT, HTTPS/HSTS, rate limiting en auth, consultas parametrizadas, validación y sanitización de entradas, CORS restringido, logs sin PII. Checklist completo en `Seguridad/01-checklist-10-puntos.md`.
- **Accesibilidad:** WCAG 2.2 AA, foco visible, navegación por teclado, `prefers-reduced-motion`, objetivos táctiles ≥ 44 px.
- **Rendimiento y escala:** sin cargas lentas de perfiles; chat con latencia ≤ 3 s. Listas paginadas por cursor (máx. 20 por petición), consultas filtradas por índice y backend sin estado para poder replicarlo. Detalle en `Architecture.md` §9.
- **Responsive:** mobile-first; login y registro caben en una pantalla en 390×844.
- **Privacidad:** los datos son del usuario: exportables y borrables. Sin analytics.

## 8. Métricas de éxito

- **Landing:** 100 registros en el primer mes.
- **Beta:** 10 matches reales y 0 caídas en 48 h de uso.

## 9. Plan

| Semana | Foco | Estado |
|---|---|---|
| 1 | Infraestructura + auth | Hecho |
| 2 | Perfiles + swipe | API hecha; UI en curso |
| 3 | Chat (polling 2 s) | Pendiente |
| 4 | Landing + polish + pruebas | Pendiente |

## 10. Riesgos y decisiones abiertas

- **Estimación vs. plazo:** `04-features-mvp.md` suma ~94 h de desarrollo (~6 semanas con testing y despliegue) frente a 4 semanas de plazo. Recortar o paralelizar.
- **Sesión persistente (US-002):** guardar el token en `localStorage` mejora la experiencia pero lo expone a XSS; alternativa: cookie `httpOnly`. Decidir antes de la beta.
- **Verificación de email:** proveedor pendiente (Resend o SendGrid).
- **Población vulnerable:** definir política de moderación y reporte antes de abrir la beta.
