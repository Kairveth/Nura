#!/usr/bin/env node
// Borra fotos HUÉRFANAS del bucket de Supabase: objetos en carpetas `<userId>/` cuyo usuario ya no
// existe en la BD. Nunca toca la foto de un usuario activo. Pueden quedar huérfanas si el borrado de
// Storage falla durante el borrado de una cuenta.
//
// Seguro por defecto: sin argumentos solo LISTA (dry-run). Para borrar de verdad: --apply
//   node security/cleanup-orphan-photos.mjs           (ver qué borraría)
//   node security/cleanup-orphan-photos.mjs --apply    (borrar)

import { createRequire } from 'node:module';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const BACKEND = path.join(process.cwd(), 'backend');
const require = createRequire(path.join(BACKEND, 'package.json'));
require('dotenv').config({ path: path.join(BACKEND, '.env'), quiet: true });
const { Pool } = require('pg');

const U = process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'profile-photos';
const AUTH = { authorization: `Bearer ${K}`, apikey: K };
// list lleva cuerpo JSON (necesita content-type); el DELETE de un objeto NO lleva cuerpo: con
// content-type: application/json y cuerpo vacío, Supabase responde 400.
const H = { ...AUTH, 'content-type': 'application/json' };
const list = async (prefix) =>
  (await (await fetch(`${U}/storage/v1/object/list/${BUCKET}`, { method: 'POST', headers: H, body: JSON.stringify({ prefix, limit: 1000 }) })).json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const users = new Set((await pool.query('SELECT id FROM users')).rows.map((r) => r.id));
  const orphans = [];
  for (const folder of await list('')) {
    if (users.has(folder.name)) continue; // carpeta de un usuario activo: NUNCA se toca
    for (const obj of await list(`${folder.name}/`)) orphans.push(`${folder.name}/${obj.name}`);
  }
  console.log(`Huérfanas encontradas: ${orphans.length}`);
  orphans.forEach((o) => console.log('  ', o.slice(0, 8) + '/…' + o.slice(-12)));

  if (orphans.length && !APPLY) {
    console.log('\nDry-run: no se ha borrado nada. Repite con --apply para borrar.');
  } else if (orphans.length) {
    let ok = 0;
    for (const p of orphans) {
      const r = await fetch(`${U}/storage/v1/object/${BUCKET}/${p}`, { method: 'DELETE', headers: AUTH });
      console.log(`  borrada ${p.slice(0, 8)}/…${p.slice(-8)} → ${r.status}`);
      if (r.ok) ok++;
    }
    console.log(`\nBorradas ${ok}/${orphans.length}.`);
    process.exitCode = ok === orphans.length ? 0 : 1;
  } else {
    console.log('Nada que borrar.');
  }
} finally {
  await pool.end().catch(() => {});
}
