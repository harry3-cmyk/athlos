import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DATABASE_PATH ?? path.resolve(here, '../../data/forge.db');
const STATIC_DIR = process.env.STATIC_DIR ?? path.resolve(here, '../../web/dist');

const db = openDb(DB_PATH);
const app = createApp(db, {
  allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
  staticDir: STATIC_DIR,
});

const server = app.listen(PORT, () => {
  console.log(`Forge écoute sur http://localhost:${PORT} — base : ${DB_PATH}`);
});

function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
