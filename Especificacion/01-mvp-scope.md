# MVP Scope

## Objetivo
Landing + webapp beta funcional. Validar mercado + viabilidad técnica en 4 semanas.

## ✅ ENTRA en MVP

**Autenticación**
- Sign up / login (email + password)
- Email verification (opcional: OTP después si fricciona)

**Perfiles**
- Foto principal (1 obligatoria, opcional: 1-2 más)
- Descripción corta (máx 200 caracteres, no párrafos largos)
- Edad, ubicación, tipo neurodivergencia (opcional pero destacado)
- No hay "Instagram style showcase"

**Matching**
- Filtros simples: edad, ubicación, tipo (neurodivergente/neurotípica)
- Swipe básico (sí/no)
- No algoritmo de recomendación complejo

**Chat**
- 1:1 texto
- Emoji + links OK
- Recomendación: "Quedar tras 5-10 mensajes" (no obligatorio)
- Historial básico

**Seguridad (non-negotiable)**
- HTTPS + SSL
- Hash passwords (bcrypt)
- JWT auth tokens
- Rate limiting en auth endpoints
- Sanitizar inputs
- GDPR: poder descargar + borrar datos

**Data**
- BD: Postgres (Render o similar)
- Minimalista: users, profiles, matches, messages

## ❌ NO entra en MVP

- Notificaciones push
- Video chat
- Verificación facial
- Pago (freemium = gratis ahora)
- Algoritmo de matching IA
- Features sociales (grupos, posts)
- Admin panel complejo
- A/B testing
- Analytics
- Dark mode (responsive sí, dark después)
- Internacionalización

## Prioridad

1. **Semana 1:** Infraestructura + auth
2. **Semana 2:** Perfiles + matching básico
3. **Semana 3:** Chat
4. **Semana 4:** Polish + testing + landing

## Success Metric

Landing: 100 signups en primer mes.
Beta: 10 matches reales, 0 crashes en 48h uso.
