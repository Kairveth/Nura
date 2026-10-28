# Suite de seguridad diaria de Nura

Red-team **autorizado** contra nuestra propia app. Cada ejecución levanta el backend en local, prueba
clases de vulnerabilidad conocidas con estrategias que **rotan cada día**, escribe un informe fechado y
sale con código `1` si alguna defensa falla (código `0` si todas aguantan).

- **Solo ataca Nura.** No es una herramienta genérica contra terceros.
- **No es destructivo.** Crea cuentas `scan-*@nura-security.local`, las borra al terminar (y barre restos
  de corridas anteriores al empezar). No persiste, no evade defensas, no toca a usuarios reales.
- **Detecta y reporta.** No arregla nada por su cuenta.

## Qué prueba

Autenticación (JWT falsificado, `alg:none`, caducado, `token_version`), control de acceso (IDOR en chat
y perfiles), inyección (SQLi, XSS almacenado, contaminación de prototipo, cursor), asignación masiva,
validación y límites de entrada, subida de fotos (tipo real, tamaño, re-codificación sin metadatos,
`photo_url` de la carpeta propia), exposición de PII (export, listas, bloqueo), lógica de negocio
(swipe/match/tope del feed), superficie HTTP (rutas ocultas, cabeceras, CORS), enumeración por tiempo y
el límite de registros. Cada día rota el orden y el subconjunto de payloads (`Estrategia del día #N`).

## Ejecutar a mano

Desde la raíz del repo:

```
node security/daily-scan/scan.mjs
```

El informe queda en `playwright-artifacts/security-reports/scan-AAAA-MM-DD.md` (ignorado por git).
Variables opcionales: `SCAN_PORT` (puerto local, por defecto 3998), `SCAN_TARGET` (ataca ese destino y
no levanta backend local; úsalo solo contra un entorno que puedas atacar).

## Programarlo cada día (Windows)

Crea una tarea diaria a las 03:00 (ajusta la hora). En PowerShell, **una sola línea**:

```
schtasks /create /tn "Nura security scan" /tr "C:\Users\manol\Nura\security\daily-scan\run-daily.cmd" /sc daily /st 03:00 /f
```

Ver el resultado de la última ejecución (0 = OK, 1 = revisar el informe):

```
schtasks /query /tn "Nura security scan" /v /fo LIST | findstr "Resultado Result"
```

Borrarla: `schtasks /delete /tn "Nura security scan" /f`

La tarea corre aunque no tengas Claude abierto. Si un día sale con código `1`, abre el informe de ese
día: lista las posibles vulnerabilidades arriba del todo.

## Nota sobre la base de datos

El backend local apunta a la misma base de datos de Supabase (no hay una de pruebas aparte). Las cuentas
`scan-*` existen solo unos segundos y se borran; aun así, si montas una base de datos de desarrollo
separada, apunta `backend/.env` a ella antes de programar la tarea para no tocar producción.

## Ampliarlo

Cada clase de ataque es una función `probe*` en `scan.mjs` que registra con `rec(categoría, nombre,
aguantó, detalle)`. Para añadir un vector nuevo: amplía el banco de payloads (`rotate(...)`) o añade un
`probe` y mételo en la lista `probes` de la orquestación.
