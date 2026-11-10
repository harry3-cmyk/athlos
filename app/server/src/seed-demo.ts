import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.js';
import { openDb, type DB } from './db.js';
import { seedDemoData } from './demo-data.js';

export const DEMO = { email: 'demo@forge.local', password: 'demo1234' };

/** (Re)crée le compte de démonstration. */
export function seedDemo(db: DB, today = new Date().toISOString().slice(0, 10)): number {
  db.prepare('DELETE FROM users WHERE email = ?').run(DEMO.email);
  const uid = Number(db.prepare(`INSERT INTO users (email, password_hash, name) VALUES (?, ?, 'Démo')`)
    .run(DEMO.email, hashPassword(DEMO.password)).lastInsertRowid);
  seedDemoData(db, uid, today);
  return uid;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const db = openDb(process.env.DATABASE_PATH ?? path.resolve(here, '../../data/forge.db'));
  seedDemo(db);
  console.log(`Compte de démonstration prêt : ${DEMO.email} / ${DEMO.password}`);
  db.close();
}
