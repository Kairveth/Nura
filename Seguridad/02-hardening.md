# Endurecimiento de seguridad — Estado

> Última actualización: 2026-09-26. Complementa `01-checklist-10-puntos.md`.
> Leyenda: **Aplicado** (en el código) · **No aplica aún** (la función no existe en el MVP; se deja la regla para cuando llegue).

| # | Medida | Estado | Qué hay / qué hacer |
|---|---|---|---|
| 1 | **HSTS** | Aplicado | API: `helmet` con `max-age` de 2 años, subdominios y preload. Frontend: `frontend/vercel.json` con HSTS, CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. |
| 2 | **Tokens CSRF** | No necesarios hoy | La sesión viaja en `Authorization: Bearer` (no hay cookies), así que el navegador no adjunta credenciales solo. Aun así: CORS estricto y `originCheck` rechazan escrituras con `Origin` ajeno (403). Si se pasa a cookies: `SameSite` + token CSRF (double submit). |
| 3 | **Restablecer sesiones** | Aplicado | `token_version` por usuario dentro del JWT; `POST /api/auth/logout-all` lo incrementa e invalida todos los tokens vigentes. El frontend cierra sesión al recibir 401. |
| 4 | **Caducar enlaces** | No aplica aún | Aún no hay verificación de email ni recuperación. Regla: token aleatorio de 32 bytes, guardado **hasheado**, caduca en 15–60 min, un solo uso y se invalida al usarse o al cambiar la contraseña. El JWT de sesión ya caduca a 1 h. |
| 5 | **Evitar enumeración** | Aplicado | Login: mismo `401` para "no existe", "contraseña errónea" y "cuenta bloqueada", con tiempo constante (siempre compara un hash). Las rutas de perfil exigen sesión. |
| 6 | **Listas blancas** | Aplicado | CORS: orígenes, métodos (`GET/POST/PUT/DELETE`) y cabeceras. `neurotipo` de lista cerrada. Campos actualizables explícitos (sin *mass assignment*). Orden y filtros del feed fijos. |
| 7 | **Verificar webhooks** | No aplica aún | No hay webhooks. Regla: firma HMAC sobre el cuerpo *raw*, comparación en tiempo constante, marca de tiempo con tolerancia corta e idempotencia por id de evento. |
| 8 | **Precios fijados en servidor** | No aplica aún | No hay pagos (fuera del MVP). Regla: importes y planes salen siempre del catálogo del servidor, nunca del cliente. |
| 9 | **Bloquear prompt injection** | No aplica aún | No hay IA en el MVP. Regla: separar instrucciones de datos, tratar la entrada y la salida del modelo como no confiables, sin ejecutar acciones ni herramientas a partir de texto del usuario. |
| 10 | **Limitar uso de IA** | No aplica aún | Regla: cuota por usuario, tope de tokens y de coste, *timeouts* y corte al superar el presupuesto. |
| 11 | **Limitar solicitudes** | Aplicado | 60/min por IP (global), 60/min por usuario autenticado (perfiles, swipes, matches, logout-all), 5 intentos/15 min por IP en registro y login, cuerpo máx. 10 KB, `limit` de listas ≤ 20. |
| 12 | **Limitar recuperaciones** | No aplica aún | No hay recuperación de contraseña. Regla: 3/hora por IP y por cuenta y respuesta idéntica exista o no la cuenta. |
| 13 | **Sanitizar antes de guardar** | Aplicado | `sanitizeText` (caracteres de control y etiquetas HTML) sobre descripción y ubicación, validación de tipo y longitud, consultas parametrizadas. React escapa además al pintar. |
| 14 | **Restringir CORS** | Aplicado | Lista blanca desde `FRONTEND_URL` (varios separados por comas); sin credenciales; en producción el servidor **no arranca** si falta `FRONTEND_URL`. |
| 15 | **Deshabilitar directorios** | Aplicado | Sin `express.static` ni listado de directorios, `X-Powered-By` desactivado y `404` JSON para todo lo demás (`/admin`, `/.env`, `/static/`…). |
| 16 | **Eliminar rutas admin** | Aplicado | No existen; verificado que responden 404. Regla: sin panel de administración en el MVP; si llega, rol comprobado en el servidor y acceso restringido. |
| 17 | **Bloquear intentos fallidos** | Aplicado | 5 fallos seguidos bloquean la cuenta 15 min (`failed_logins`, `locked_until`), además del límite por IP. Se reinicia al acertar o al caducar el bloqueo. |
| 18 | **Registrar eventos** | Aplicado | Eventos `AUDIT`: `login_ok`, `login_failed`, `login_blocked_locked`, `signup_ok`, `signup_duplicate`, `sessions_reset`, `rate_limited`, `origin_rejected`. Solo `user_id` y acción; la IP como huella con sal; nunca email, contraseña, token ni contenido. |
| 19 | **Cookies seguras** | No aplica aún | No se usan cookies. Si se adoptan: `HttpOnly; Secure; SameSite=Lax/Strict`, prefijo `__Host-` y dominio propio *same-site* (`app.` y `api.` del mismo dominio), porque Brave y Safari bloquean cookies de terceros. |

## Otras medidas aplicadas

- JWT firmado y verificado solo con **HS256**; comprobación de sesión contra la BD en cada petición autenticada (falla cerrado).
- `Cache-Control: no-store` en toda la API; `X-Frame-Options: DENY`; `Referrer-Policy: no-referrer`.
- Cuerpo JSON limitado, errores genéricos hacia el cliente y sin *stack traces* en producción.
- Pool de conexiones con `statement_timeout`.

## Migraciones

Las medidas de cuenta (bloqueo por intentos, restablecer sesiones) requieren una migración de la tabla `users`. Las migraciones son locales y **no se versionan**; ver `AGENTS.md`.

## Cómo comprobarlo

```bash
curl -sI https://<api>/health | grep -i -E "strict-transport|x-frame|x-powered"      # HSTS sí, X-Powered-By no
curl -s -o /dev/null -w "%{http_code}\n" https://<api>/admin                          # 404
curl -s -X POST https://<api>/api/auth/login -H "Origin: https://evil.example" ...    # 403
```

Repetir 6 logins fallidos con el mismo email debe devolver siempre `401` (nunca revela el bloqueo); el 6.º intento desde la misma IP recibe `429`.
