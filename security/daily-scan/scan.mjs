#!/usr/bin/env node
// Nura — suite de seguridad diaria (red-team AUTORIZADO contra NUESTRA propia app).
//
// Qué hace: levanta el backend en local, prueba clases de vulnerabilidad conocidas con estrategias que
// ROTAN cada día, escribe un informe fechado y sale con código != 0 si alguna defensa falla.
// Qué NO hace: no es destructivo (crea cuentas scan-* y las borra), no persiste, no evade defensas y
// SOLO ataca Nura. No es una herramienta genérica contra terceros.
//
// Uso (desde la raíz del repo):  node security/daily-scan/scan.mjs
//   SCAN_TARGET=http://host:puerto  → ataca ese destino y NO levanta backend (por defecto: local).
//
// Provisiona las cuentas de prueba por SQL (no por el endpoint de registro) para no chocar con el
// límite de 5 registros/15 min; el propio registro se prueba en su probe dedicado.

import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = process.cwd();
const BACKEND = path.join(ROOT, 'backend');
const require = createRequire(path.join(BACKEND, 'package.json'));
require('dotenv').config({ path: path.join(BACKEND, '.env'), quiet: true });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const storage = await import(pathToFileURL(path.join(BACKEND, 'src/utils/storage.js')).href);

const PORT = Number(process.env.SCAN_PORT || 3998);
const API = process.env.SCAN_TARGET || `http://127.0.0.1:${PORT}`;
const SPAWN = !process.env.SCAN_TARGET;
const RUN_ID = Date.now().toString(36);
const DAY = Math.floor(Date.now() / 864e5); // número de día: rota qué estrategias se activan
const SCAN_EMAIL = (tag) => `scan-${tag}-${RUN_ID}@nura-security.local`;
const SECRET = process.env.JWT_SECRET;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const provisioned = [];
const findings = []; // { cat, name, held, detail } — held=false ⇒ posible vulnerabilidad
const rec = (cat, name, held, detail = '') => findings.push({ cat, name, held: !!held, detail: String(detail).slice(0, 140) });

// --- utilidades HTTP ---
const req = async (method, p, { token, body, raw, headers = {} } = {}) => {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  let payload = raw;
  if (raw === undefined && body !== undefined) {
    h['content-type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  try {
    const res = await fetch(API + p, { method, headers: h, body: payload, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: res.status, json, text, headers: res.headers };
  } catch (e) {
    return { status: 0, json: null, text: String(e.message), headers: new Headers() };
  }
};

// Baraja determinista por día: cada día prueba los payloads en otro orden y elige otro subconjunto
const rotate = (bank, n) => {
  const out = [];
  for (let i = 0; i < Math.min(n, bank.length); i++) out.push(bank[(DAY + i * 7) % bank.length]);
  return out;
};

// --- provisión de cuentas de prueba (por SQL, no por el endpoint) ---
const provision = async (tag) => {
  const email = SCAN_EMAIL(tag);
  const password = `Scan-${RUN_ID}-${tag}1`;
  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id', [email, hash]);
  const id = rows[0].id;
  const token = jwt.sign({ id, email, tv: 0 }, SECRET, { expiresIn: '1h', algorithm: 'HS256' });
  provisioned.push({ id, email });
  return { id, email, password, token };
};
const withProfile = async (u, over = {}) => {
  await req('POST', '/api/profiles', { token: u.token, body: { description: 'perfil scan', age: 30, location: 'ScanCity', neurotipos: ['Neurotípico'], intention: 'Amistad', ...over } });
  return u;
};
const makeMatch = async (a, b) => {
  await req('POST', '/api/swipes', { token: a.token, body: { swiped_id: b.id, action: 'yes' } });
  const r = await req('POST', '/api/swipes', { token: b.token, body: { swiped_id: a.id, action: 'yes' } });
  return r.json?.match?.id;
};

// Borra todo rastro de cuentas scan-* (al empezar, por si una corrida anterior murió, y al terminar)
const sweep = async () => {
  const { rows } = await pool.query("SELECT id, email FROM users WHERE email LIKE 'scan-%@nura-security.local'");
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await pool.query('DELETE FROM match_reports WHERE reporter_id = ANY($1) OR reported_user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM matches WHERE user_1_id = ANY($1) OR user_2_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM swipes WHERE from_user_id = ANY($1) OR to_user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  }
  for (const r of rows) {
    const h = createHmac('sha256', `${SECRET}:reported-accounts`).update(r.email.trim().toLowerCase()).digest('hex');
    await pool.query('DELETE FROM reported_account_deletions WHERE email_hmac = $1', [h]);
  }
  for (const id of ids) await storage.deleteUserPhotos(id).catch(() => {});
  return ids.length;
};

// ============================ PROBES ============================
// Cada probe registra "la defensa aguantó" (held=true) o "posible vulnerabilidad" (held=false).

async function probeAuth(att) {
  const [h, p, sig] = att.token.split('.');
  const swap = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), id: '00000000-0000-0000-0000-000000000000' })).toString('base64url');
  const cases = [
    ['id cambiado, firma original', `${h}.${swap}.${sig}`],
    ['alg:none', `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${swap}.`],
    ['token caducado', jwt.sign({ id: att.id, tv: 0, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, { algorithm: 'HS256' })],
    ['algoritmo HS512', jwt.sign({ id: att.id, tv: 0 }, SECRET, { algorithm: 'HS512' })],
    ['token_version viejo', jwt.sign({ id: att.id, tv: -1 }, SECRET, { algorithm: 'HS256' })],
    ['firma basura', `${h}.${p}.AAAA`],
    ['sin token', null]
  ];
  for (const [name, tok] of cases) {
    const r = await req('GET', '/api/account/export', tok ? { token: tok } : {});
    rec('Autenticación', `rechaza ${name}`, r.status === 401 || r.status === 403, `status ${r.status}`);
  }
}

async function probeAccessControl(att, vic, third, matchAB) {
  const paths = [
    ['GET', `/api/matches/${matchAB}/messages`],
    ['POST', `/api/matches/${matchAB}/messages`, { content: 'intruso' }],
    ['POST', `/api/matches/${matchAB}/read`],
    ['POST', `/api/matches/${matchAB}/block`],
    ['POST', `/api/matches/${matchAB}/report`, { reason: 'Otro' }],
    ['GET', `/api/swipes/matches/${matchAB}`]
  ];
  for (const [m, pth, body] of paths) {
    const r = await req(m, pth, { token: third.token, body });
    rec('Control de acceso', `tercero en ${m} ${pth.replace(matchAB, ':id')} → 404`, r.status === 404, `status ${r.status}`);
  }
  const other = await req('GET', `/api/profiles/${vic.id}`, { token: att.token });
  rec('Control de acceso', 'perfil de otro por id → 404', other.status === 404 && !other.text.includes('perfil scan'), `status ${other.status}`);
}

async function probeInjection(u) {
  const sqli = ["' OR '1'='1", "'; DROP TABLE users;--", "') OR ('1'='1", "1); DELETE FROM profiles;--", "' UNION SELECT NULL--", "%27%20OR%201=1"];
  for (const v of rotate(sqli, 3)) {
    const r = await req('GET', `/api/profiles/feed?location=${encodeURIComponent(v)}`, { token: u.token });
    rec('Inyección', `SQLi en location (${v.slice(0, 14)}…) sin efecto`, r.status === 200 && (r.json?.data?.length ?? 0) === 0, `status ${r.status}`);
    const r2 = await req('GET', `/api/profiles/feed?age_min=${encodeURIComponent(v)}`, { token: u.token });
    rec('Inyección', `SQLi en age_min (${v.slice(0, 14)}…) → 400`, r2.status === 400, `status ${r2.status}`);
  }
  const usersBefore = Number((await pool.query('SELECT count(*) n FROM users')).rows[0].n);
  rec('Inyección', 'la tabla users sigue intacta', usersBefore > 0, `${usersBefore} filas`);
  const xss = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', "'\"><b>x</b>", '<iframe src=javascript:alert(1)>'];
  for (const v of rotate(xss, 2)) {
    await req('PUT', '/api/profiles', { token: u.token, body: { description: `${v} hola` } });
    const stored = (await pool.query('SELECT description FROM profiles WHERE user_id = $1', [u.id])).rows[0].description;
    // Lo peligroso es un abridor de etiqueta (`<` + letra/`/`/`!`) o un manejador on*=; un `>` suelto es texto inofensivo
    const safe = !/<[a-zA-Z/!]/.test(stored) && !/\bon\w+\s*=/.test(stored) && !/<script/i.test(stored);
    rec('Inyección', `XSS (${v.slice(0, 16)}…) se guarda sin etiquetas`, safe, JSON.stringify(stored).slice(0, 40));
  }
  const proto = await req('PUT', '/api/profiles', { token: u.token, raw: '{"__proto__":{"admin":true},"constructor":{"prototype":{"polluted":true}},"description":"p"}', headers: { 'content-type': 'application/json' } });
  rec('Inyección', 'contaminación de prototipo sin efecto', proto.status === 200 && {}.admin === undefined && {}.polluted === undefined, `status ${proto.status}`);
  const badCursor = Buffer.from(JSON.stringify(["2026-01-01 00:00:00' OR 1=1--", u.id])).toString('base64url');
  rec('Inyección', 'cursor manipulado → 400', (await req('GET', `/api/profiles/feed?cursor=${badCursor}`, { token: u.token })).status === 400);
}

async function probeMassAssignment(u, other) {
  const before = (await pool.query('SELECT created_at FROM profiles WHERE user_id = $1', [u.id])).rows[0].created_at;
  await req('PUT', '/api/profiles', { token: u.token, body: { description: 'ma', user_id: other.id, id: '00000000-0000-0000-0000-000000000000', created_at: '2000-01-01', neurodivergence_types: ['x'] } });
  const victim = (await pool.query('SELECT description FROM profiles WHERE user_id = $1', [other.id])).rows[0];
  const mine = (await pool.query('SELECT description, created_at FROM profiles WHERE user_id = $1', [u.id])).rows[0];
  rec('Asignación masiva', 'user_id/id/created_at del body se ignoran', victim.description === 'perfil scan' && mine.description === 'ma' && String(mine.created_at) === String(before));
}

async function probeInputLimits(u, matchId) {
  rec('Validación', 'cuerpo de 50 KB → 413', (await req('PUT', '/api/profiles', { token: u.token, body: { description: 'x'.repeat(50000) } })).status === 413);
  const bad = await req('PUT', '/api/profiles', { token: u.token, raw: '{"description":', headers: { 'content-type': 'application/json' } });
  rec('Validación', 'JSON roto → 400 sin fugas internas', bad.status === 400 && !/node_modules|\bat \b|stack/.test(bad.text));
  rec('Validación', 'neurotipos ×50 → 400', (await req('PUT', '/api/profiles', { token: u.token, body: { neurotipos: Array(50).fill('TDAH') } })).status === 400);
  rec('Validación', 'edad 10 → 400', (await req('PUT', '/api/profiles', { token: u.token, body: { age: 10 } })).status === 400);
  rec('Validación', 'edad 200 → 400', (await req('PUT', '/api/profiles', { token: u.token, body: { age: 200 } })).status === 400);
  rec('Validación', 'intención inventada → 400', (await req('PUT', '/api/profiles', { token: u.token, body: { intention: 'lo que sea' } })).status === 400);
  rec('Validación', 'motivo de reporte inventado → 400', (await req('POST', `/api/matches/${matchId}/report`, { token: u.token, body: { reason: 'inventado' } })).status === 400);
  rec('Validación', 'limit=100000 → ≤ 20', ((await req('GET', `/api/matches/${matchId}/messages?limit=100000`, { token: u.token })).json?.data?.length ?? 0) <= 20);
}

async function probeFileUpload(u, other) {
  const html = new FormData();
  html.append('photo', new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' }), 'x.png');
  rec('Subida de fotos', 'HTML disfrazado de PNG → 400', (await req('POST', '/api/profiles/photo', { token: u.token, raw: html })).status === 400);
  const big = new FormData();
  big.append('photo', new Blob([Buffer.alloc(7 * 1024 * 1024, 1)], { type: 'image/jpeg' }), 'big.jpg');
  rec('Subida de fotos', 'foto de 7 MB → 400', (await req('POST', '/api/profiles/photo', { token: u.token, raw: big })).status === 400);
  const marker = `SCANMARKER-${RUN_ID}`;
  const png = Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'), Buffer.from(marker)]);
  const fd = new FormData();
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'p.png');
  const up = await req('POST', '/api/profiles/photo', { token: u.token, raw: fd });
  if (up.status < 300 && up.json?.photo_url) {
    rec('Subida de fotos', 'URL subida en la carpeta propia', storage.isOwnPhotoUrl(u.id, up.json.photo_url));
    const served = Buffer.from(await (await fetch(up.json.photo_url, { signal: AbortSignal.timeout(10000) })).arrayBuffer());
    rec('Subida de fotos', 're-codificada: sin datos escondidos', !served.includes(Buffer.from(marker)));
  } else rec('Subida de fotos', 'subida de PNG válido aceptada', false, `status ${up.status}`);
  const ext = await req('PUT', '/api/profiles', { token: u.token, body: { photo_url: 'https://attacker.example/pixel.png' } });
  rec('Subida de fotos', 'photo_url externa (píxel espía) → 400', ext.status === 400, `status ${ext.status}`);
  const ownOfOther = `${process.env.SUPABASE_URL}/storage/v1/object/public/profile-photos/${other.id}/00000000-0000-0000-0000-000000000000.png`;
  rec('Subida de fotos', 'photo_url de otro usuario → 400', (await req('PUT', '/api/profiles', { token: u.token, body: { photo_url: ownOfOther } })).status === 400);
}

async function probePiiExposure(u, other, matchId) {
  const ex = await req('GET', '/api/account/export', { token: u.token });
  const forbidden = ['password_hash', 'token_version', 'failed_logins', 'locked_until', 'reset_token'];
  rec('Exposición de PII', 'export sin campos de seguridad', ex.status === 200 && !forbidden.some((f) => ex.text.includes(f)));
  rec('Exposición de PII', 'export sin email de terceros', !ex.text.includes(other.email));
  const matches = await req('GET', '/api/swipes/matches', { token: u.token });
  rec('Exposición de PII', 'lista de matches sin email', matches.status === 200 && !matches.text.includes('@'));
  await req('POST', `/api/matches/${matchId}/block`, { token: other.token });
  const afterBlock = (await req('GET', `/api/swipes/matches/${matchId}`, { token: u.token })).json;
  rec('Exposición de PII', 'bloqueado no ve el perfil del que bloqueó', afterBlock?.profile_hidden === true && afterBlock.location === null && afterBlock.photo_url === null && afterBlock.matched_user_id === null);
}

async function probeBusinessLogic(u, other) {
  rec('Lógica de negocio', 'swipe a uno mismo → 400', (await req('POST', '/api/swipes', { token: u.token, body: { swiped_id: u.id, action: 'yes' } })).status === 400);
  rec('Lógica de negocio', 'acción de swipe inválida → 400', (await req('POST', '/api/swipes', { token: u.token, body: { swiped_id: other.id, action: 'maybe' } })).status === 400);
  await req('POST', '/api/swipes', { token: u.token, body: { swiped_id: other.id, action: 'no' } });
  rec('Lógica de negocio', 'swipe duplicado → 409', (await req('POST', '/api/swipes', { token: u.token, body: { swiped_id: other.id, action: 'yes' } })).status === 409);
  // Tope diario del feed: se fuerza el contador y se espera página vacía
  const solo = await withProfile(await provision('cap'));
  await pool.query('UPDATE users SET feed_served_count = 100000, feed_served_on = CURRENT_DATE WHERE id = $1', [solo.id]);
  const capped = await req('GET', '/api/profiles/feed', { token: solo.token });
  rec('Lógica de negocio', 'tope diario del feed aplicado', capped.json?.feed_limit_reached === true && capped.json.data.length === 0);
}

async function probeSurface() {
  for (const p of ['/admin', '/.env', '/backend/.env', '/logs.txt', '/node_modules/', '/api/users', '/.git/config']) {
    rec('Superficie', `${p} → 404`, (await req('GET', p)).status === 404);
  }
  const hdr = (await req('GET', '/health')).headers;
  rec('Superficie', 'HSTS presente', Boolean(hdr.get('strict-transport-security')));
  rec('Superficie', 'X-Content-Type-Options: nosniff', hdr.get('x-content-type-options') === 'nosniff');
  rec('Superficie', 'sin X-Powered-By', !hdr.get('x-powered-by'));
  const foreign = await req('POST', '/api/auth/login', { body: { email: 'x@x.com', password: 'y' }, headers: { origin: 'https://evil.example' } });
  rec('Superficie', 'escritura con Origin ajeno → 403', foreign.status === 403, `status ${foreign.status}`);
}

async function probeTiming(u) {
  const t = async (email) => { const s = performance.now(); await req('POST', '/api/auth/forgot-password', { body: { email } }); return performance.now() - s; };
  const exists = await t(u.email);
  const missing = await t(`no-existe-${RUN_ID}@nura-security.local`);
  rec('Enumeración', 'forgot-password: existe vs no existe < 150 ms', Math.abs(exists - missing) < 150, `${exists.toFixed(0)} vs ${missing.toFixed(0)} ms`);
}

async function probeSignupLimit() {
  let got429 = false;
  const emails = [];
  for (let i = 0; i < 7 && !got429; i++) {
    const e = `scan-lim${i}-${RUN_ID}@nura-security.local`;
    emails.push(e);
    const r = await req('POST', '/api/auth/signup', { body: { email: e, password: `Scan-${RUN_ID}-lim1` } });
    if (r.status === 429) got429 = true;
  }
  rec('Límites', 'registro: se corta con 429 antes de 7 intentos', got429);
  // limpieza de las cuentas que sí se crearon
  const { rows } = await pool.query('SELECT id FROM users WHERE email = ANY($1)', [emails]);
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await pool.query('DELETE FROM swipes WHERE from_user_id = ANY($1) OR to_user_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  }
}

// ============================ ORQUESTACIÓN ============================
async function startBackend() {
  const ready = async () => { try { return (await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } };
  if (await ready()) return null; // ya hay uno escuchando
  if (!SPAWN) throw new Error(`No responde ${API} y SCAN_TARGET impide levantar uno local`);
  const srv = spawn(process.execPath, ['src/index.js'], { cwd: BACKEND, env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' }, stdio: 'ignore' });
  for (let i = 0; i < 30; i++) { if (await ready()) return srv; await new Promise((r) => setTimeout(r, 400)); }
  throw new Error('el backend local no arrancó a tiempo');
}
const stopBackend = (srv) => {
  if (!srv?.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(srv.pid), '/t', '/f'], { stdio: 'ignore' });
  else srv.kill('SIGTERM');
};

const writeReport = () => {
  const date = new Date().toISOString().slice(0, 10);
  const cats = [...new Set(findings.map((f) => f.cat))];
  const vulns = findings.filter((f) => !f.held);
  const dir = path.join(ROOT, 'playwright-artifacts', 'security-reports');
  mkdirSync(dir, { recursive: true });
  const L = [];
  L.push(`# Informe de seguridad — Nura — ${date}`, '');
  L.push(`Destino: ${API}  ·  Estrategia del día (rota): #${DAY % 7}  ·  Comprobaciones: ${findings.length}  ·  Fallos: ${vulns.length}`, '');
  L.push(vulns.length ? `## ⚠️ ${vulns.length} posible(s) vulnerabilidad(es)` : '## ✅ Todas las defensas aguantaron', '');
  for (const v of vulns) L.push(`- **[${v.cat}] ${v.name}** — ${v.detail || 'la defensa no respondió como se esperaba'}`);
  L.push('', '## Detalle por categoría', '');
  for (const c of cats) {
    L.push(`### ${c}`);
    for (const f of findings.filter((x) => x.cat === c)) L.push(`- ${f.held ? '✅' : '⚠️'} ${f.name}${f.detail ? `  (${f.detail})` : ''}`);
    L.push('');
  }
  const file = path.join(dir, `scan-${date}.md`);
  writeFileSync(file, L.join('\n'));
  return { file, vulns: vulns.length };
};

(async () => {
  let srv = null;
  let errored = false;
  try {
    if (!SECRET || !process.env.DATABASE_URL) throw new Error('faltan JWT_SECRET o DATABASE_URL (backend/.env)');
    await sweep(); // limpia restos de corridas anteriores
    srv = await startBackend();

    const att = await withProfile(await provision('att'));
    const vic = await withProfile(await provision('vic'));
    const third = await withProfile(await provision('third'));
    const matchAB = await makeMatch(att, vic);
    if (!matchAB) throw new Error('no se pudo crear el match de prueba');

    const probes = [
      () => probeAuth(att),
      () => probeAccessControl(att, vic, third, matchAB),
      () => probeInjection(att),
      () => probeMassAssignment(att, vic),
      () => probeInputLimits(att, matchAB),
      () => probeFileUpload(att, vic),
      () => probePiiExposure(att, vic, matchAB), // bloquea matchAB al final
      () => probeBusinessLogic(third, att),
      () => probeSurface(),
      () => probeTiming(vic),
      () => probeSignupLimit() // el último: agota el cupo de registros por IP
    ];
    for (const run of probes) {
      try { await run(); } catch (e) { errored = true; rec('Error', run.name || 'probe', false, e.message); }
    }
  } catch (e) {
    errored = true;
    rec('Error', 'orquestación', false, e.message);
  } finally {
    stopBackend(srv);
    const removed = await sweep().catch(() => -1);
    const { file, vulns } = writeReport();
    await pool.end().catch(() => {});
    const held = findings.filter((f) => f.held).length;
    console.log(`\nNura security scan — ${findings.length} comprobaciones, ${held} OK, ${vulns} fallo(s). Limpieza: ${removed} cuentas.`);
    console.log(`Informe: ${file}`);
    process.exit(vulns > 0 || errored ? 1 : 0);
  }
})();
