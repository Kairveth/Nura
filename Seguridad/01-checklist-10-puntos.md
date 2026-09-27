# Checklist Seguridad - 10 Puntos Críticos

## 1. Autenticación fuerte

- [ ] Passwords: hash con bcryptjs (salt rounds: 10)
- [ ] JWT tokens: expira en 1h (refresh token: 7 días)
- [ ] No guardes password en logs, never
- [ ] Email verification before profile visible
- [ ] Rate limiting: máx 5 intentos login / 15 min (IP)

**Test:** Intentar login 10x rápido = bloqueado

## 2. HTTPS + TLS

- [ ] Todos endpoints HTTPS (Vercel + Render enforcer)
- [ ] HSTS header (max-age: 31536000)
- [ ] Secure cookies: httpOnly + sameSite

**Test:** curl -I https://api.nura.com — header "Strict-Transport-Security"

## 3. Sanitización de inputs

- [ ] XSS: escapar/sanitize en frontend + backend
- [ ] SQL Injection: parametrized queries (pg.query con placeholders)
- [ ] No interpolate user input en queries

**Test:** profile description = `<script>alert('xss')</script>` — no ejecuta

## 4. CORS y CSRF

- [ ] CORS: Allow origin solo Vercel domain (frontend)
- [ ] CSRF token en forms (o SameSite cookie)
- [ ] Helmet.js para headers (X-Frame-Options, X-Content-Type-Options)

**Test:** curl POST desde otro origin = bloqueado

## 5. Rate Limiting

- [ ] Auth endpoints: 5 req / 15 min per IP
- [ ] API general: 100 req / min per user
- [x] Chat: 10 msgs / min per user (`messageLimiter`, backend/src/middleware/rateLimiter.js)

**Test:** enviar 200 requests en 1s = 429 Too Many Requests

## 6. Datos Sensibles (PII)

- [ ] Passwords: NEVER log, never return en API
- [ ] Emails: hashear para matching (opcional)
- [ ] Fotos: stored en S3/CDN con access control, not public
- [ ] Chat messages: encrypted at rest (opcional MVP, priority post-MVP)
- [ ] Borrar datos cuando user deletes account (cascade)

**Test:** GET /user/:id — response no incluye password field

## 7. Validación de datos

- [ ] Email: valid format + exists check
- [ ] Age: 18-120
- [ ] Descripción: max 200 chars, no scripts
- [ ] Foto: max 5MB, allow only jpg/png
- [ ] Ubicación: valid coordinates o dropdown

**Test:** POST profile age: 10 = 400 Bad Request

## 8. Logging sin revelar secrets

- [ ] Log: "user login attempt" (NO email)
- [ ] Log: "message sent" (NO content)
- [ ] Log: "profile deleted" (NO PII)
- [ ] Log only: user_id, action, timestamp

**Test:** grep password logs.txt — zero matches

## 9. GDPR + Compliance

- [ ] Privacy policy en landing (EU requirement)
- [ ] Terms of service (cover: neurodivergent protection, ghosting policy)
- [ ] Data export (US-013): JSON descargable
- [ ] Account deletion (US-012): 30-day grace, then permanent

**Test:** DELETE /user/:id → data gone 24h

## 10. Monitoring + Alerting (MVP minimal)

- [ ] Error tracking: Sentry free tier o Vercel logs
- [ ] Alert on: 500 errors, rate limit exceeded, spike en auth fails
- [ ] Uptime check: simple ping /health endpoint
- [ ] Logs: structured (JSON, not plain text)

**Test:** Backend down — alert email en 5 min (post-MVP: Slack)

---

## Implementation Priority

**Week 1 (must-have):**
- [ ] 1, 2, 3, 4, 5, 7

**Week 2-3 (should-have):**
- [ ] 6, 8, 9

**Post-MVP:**
- [ ] Encryption at rest (6)
- [ ] Advanced monitoring (10)

## Red Flags (Stop if true)

- Storing passwords in plain text → STOP, fix immediately
- API returns `password` field → STOP
- No HTTPS in production → STOP
- User data publicly accessible → STOP
- No input validation → STOP
