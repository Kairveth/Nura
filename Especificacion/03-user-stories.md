# User Stories - MVP

## Auth

**US-001:** Como nuevo usuario, puedo registrarme con email + password para crear perfil.
- Aceptación: email verification link, login funciona, session persiste

**US-002:** Como usuario, puedo logearme para acceder mi perfil y matches.
- Aceptación: JWT token en localStorage, refresh si expira, logout limpia sesión
- Seguridad (decisión 2026-10-28): además, "cerrar sesión en todos los dispositivos" en Ajustes invalida todos los tokens vigentes (`token_version` en el JWT). Usuarios con PII sensible: poder revocar sesiones robadas es parte del MVP.

## Perfil

**US-003:** Como nuevo usuario, puedo crear perfil con 1 foto + descripción (200 chars).
- Aceptación: foto sube, descripción no permite párrafos largos, preview antes de guardar

**US-004:** Como usuario, puedo editar mi perfil (foto, descripción, edad, ubicación).
- Aceptación: cambios guardan, cambios aparecen en otros perfiles inmediatamente

**US-005:** Como usuario, puedo ver otros perfiles (foto + descripción + edad + tipo).
- Aceptación: foto visible, text legible, bot info clara, sin cargas lentas

## Matching

**US-006:** Como usuario, puedo filtrar por edad, ubicación, tipo neurodivergencia.
- Aceptación: filtros aplican, resultado actualiza, sin lag, default: todos (sin filtro = todos)
- Seguridad (decisión 2026-10-28): "todos" tiene un tope de 150 perfiles servidos al día por usuario (anti-scraping/enumeración). No afecta al uso normal (sesiones de ~5 min); corta la descarga masiva del directorio.

**US-007:** Como usuario, puedo hacer swipe sí/no en perfiles.
- Aceptación: botones grandes, visual claro (verde=sí, rojo=no), confirmación silent

**US-008:** Como usuario, veo matches (ambos dijeron sí).
- Aceptación: lista de matches aparece, click en match abre chat

## Chat

**US-009:** Como usuario, puedo chatear 1:1 con un match.
- Aceptación: historial visible, mensajes llegan en tiempo real (0-3 segundos), no desaparecen

**US-010:** Como usuario, veo recomendación "considera quedar tras 5-10 mensajes" en chat.
- Aceptación: banner pequeño (no molesto), aparece 1 vez, puede cerrar

**US-011:** Como usuario, puedo ver si hay nuevos mensajes (badge, ej: "+3").
- Aceptación: badge aparece, desaparece cuando leo chat

## Seguridad (User perspective)

**US-012:** Como usuario, puedo borrar mi cuenta y todos mis datos.
- Aceptación: botón en Ajustes, doble confirmación (lista de lo que se borra + contraseña), borrado inmediato y definitivo. Se borran también los matches y las conversaciones completas, incluidos los mensajes de la otra persona.

**US-013:** Como usuario, puedo descargar mis datos (GDPR).
- Aceptación: descarga directa de un JSON con cuenta, perfil, swipes, matches, mensajes enviados y reportes propios. Sin datos de otras personas y sin envío por email.

## Landing

**US-014:** Como visitante, veo landing que explica qué es Nura en 30 segundos.
- Aceptación: hero + 3 puntos, sign up CTA, mobile responsive
