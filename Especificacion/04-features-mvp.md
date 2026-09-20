# Features MVP

## Frontend (Next.js + React)

| Feature | Priority | Effort | Owner | Status |
|---------|----------|--------|-------|--------|
| Auth (signup/login/logout) | P0 | 8h | TBD | - |
| Profile creation/edit | P0 | 6h | TBD | - |
| Profile view | P0 | 4h | TBD | - |
| Swipe interface | P0 | 8h | TBD | - |
| Matches list | P0 | 4h | TBD | - |
| Chat UI | P0 | 10h | TBD | - |
| Landing page | P0 | 6h | TBD | - |
| Responsive design | P0 | 4h | TBD | - |
| Settings (profile delete, data download) | P1 | 4h | TBD | - |

**Total Frontend: ~54h**

## Backend (Node.js / Python)

| Feature | Priority | Effort | Owner | Status |
|---------|----------|--------|-------|--------|
| User auth (JWT) | P0 | 6h | TBD | - |
| Profile CRUD | P0 | 4h | TBD | - |
| Swipe logic (create match if mutual) | P0 | 4h | TBD | - |
| Chat messages (CRUD + realtime) | P0 | 8h | TBD | - |
| Email verification | P0 | 4h | TBD | - |
| Password hashing (bcrypt) | P0 | 2h | TBD | - |
| Rate limiting | P0 | 3h | TBD | - |
| Input sanitization | P0 | 3h | TBD | - |
| Data export (GDPR) | P1 | 4h | TBD | - |
| Account deletion | P1 | 2h | TBD | - |

**Total Backend: ~40h**

## Database (Postgres)

| Table | Columns | Notes |
|-------|---------|-------|
| `users` | id, email, password_hash, created_at | uniqueness: email |
| `profiles` | id, user_id, photo_url, description, age, location, neurotipo, updated_at | profile visible after verify email |
| `swipes` | id, swiper_id, swiped_id, action (yes/no), created_at | log every swipe |
| `matches` | id, user_a, user_b, created_at | created only if mutual yes |
| `messages` | id, match_id, sender_id, content, created_at | deleted when match deleted? NO: keep archive |

**Indexes:** users(email), profiles(user_id), swipes(swiper_id, created_at), matches(user_a, user_b), messages(match_id, created_at)

## Realtime (Chat messages)

**Option A (MVP Lazy):** Polling (frontend every 2s check new messages).
- Pros: sin dependencia extra, simple
- Cons: latencia 2s, higher DB load

**Option B (Better):** WebSocket o Server-Sent Events.
- Pros: realtime
- Cons: need socket.io o Centrifugo

**Decision MVP:** Polling 2s. Upgrade a WebSocket si UX fricciona.

## Deployment

- **Frontend:** Vercel (ya linked)
- **Backend:** Render, Railway, o Supabase (TBD)
- **DB:** Postgres en Render / Supabase
- **Email:** Resend o SendGrid (free tier)

## Testing

**MVP:** No test framework. Manual testing checklist:
1. Sign up → email verify → login
2. Create profile → edit → delete
3. Swipe A + B → match aparece en ambos
4. Chat: A envía msg → B recibe en <2s
5. Logout limpia session

**Post-MVP:** Playwright E2E.

## Total Estimate

- **Dev:** 94h (~2.5 semanas a 40h/week)
- **Design:** 10h
- **Testing:** 6h
- **Deploy + docs:** 4h

**Total: ~6 semanas.** Compresión: paralelizar, skip no-MVP.
