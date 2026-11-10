import initSqlJs from 'sql.js/dist/sql-wasm.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { seedDemoData } from '../../../server/src/demo-data.js';
import { HttpError } from '../../../server/src/http.js';
import { dataRouter } from '../../../server/src/routes/data.js';
import { insightsRouter } from '../../../server/src/routes/insights.js';
import { programsRouter } from '../../../server/src/routes/programs.js';
import { workoutsRouter } from '../../../server/src/routes/workouts.js';
import { initSchema, type DB } from '../../../server/src/schema.js';
import { match, type LocalRouter } from './express-shim';
import { loadBytes, saveBytes, wrap } from './sqlite';

/**
 * Mode « sur l'appareil » : l'API du serveur tourne dans le navigateur.
 * Mêmes routes, mêmes requêtes SQL, même logique métier que le serveur Node — seuls le transport (appel direct au lieu de HTTP)
 * et le stockage (SQLite WebAssembly persisté dans IndexedDB) changent. Un seul utilisateur, sans mot de passe.
 */
const UID = 1;
const REV_KEY = 'forge-rev';

interface Ctx { db: ReturnType<typeof wrap>; routers: LocalRouter[] }
let ctx: Promise<Ctx> | null = null;
let myRev = '';

async function init(): Promise<Ctx> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const bytes = await loadBytes();
  const db = wrap(bytes ? new SQL.Database(bytes) : new SQL.Database());
  db.pragma('foreign_keys = ON');
  const asDb = db as unknown as DB;
  initSchema(asDb);
  ensureUser(db);
  myRev = readRev();
  // Demande au navigateur de ne pas purger ces données quand l'espace manque (accordé ou non selon le navigateur).
  navigator.storage?.persist?.().catch(() => {});
  // Deux onglets = deux copies en mémoire : si un autre onglet a écrit entre-temps, on recharge pour ne rien écraser.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && readRev() !== myRev) location.reload();
  });
  const routers = [workoutsRouter(asDb), programsRouter(asDb), insightsRouter(asDb), dataRouter(asDb)] as unknown as LocalRouter[];
  return { db, routers };
}

function readRev(): string { try { return localStorage.getItem(REV_KEY) ?? ''; } catch { return ''; } }

function ensureUser(db: Ctx['db']) {
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(UID)) {
    db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, 'local@forge', '-', '')`).run(UID);
  }
}

let saving: Promise<void> = Promise.resolve();
function persist(db: Ctx['db']): Promise<void> {
  // Écritures sérialisées : la dernière image de la base gagne toujours.
  saving = saving.catch(() => {}).then(async () => {
    await saveBytes(db.export());
    myRev = String(Date.now());
    try { localStorage.setItem(REV_KEY, myRev); } catch { /* stockage indisponible */ }
  });
  return saving;
}

const publicUser = (u: any) => ({
  id: u.id, email: u.email, name: u.name, sex: u.sex, heightCm: u.height_cm, birthYear: u.birth_year, goal: u.goal,
});

/** Routes propres au mode local : profil sans authentification, données d'exemple, remise à zéro. */
function localRoutes(db: Ctx['db'], method: string, path: string, body: any): unknown | undefined {
  const me = () => publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(UID));
  if (path === '/auth/me' && method === 'GET') return me();
  if (path === '/auth/me' && method === 'PATCH') {
    const name = String(body?.name ?? '').trim().slice(0, 80);
    const sex = body?.sex === 'male' || body?.sex === 'female' ? body.sex : null;
    const height = Number(body?.heightCm), year = Number(body?.birthYear);
    const goal = ['strength', 'hypertrophy', 'fat_loss', 'general'].includes(body?.goal) ? body.goal : 'hypertrophy';
    if (body?.heightCm != null && !(height >= 100 && height <= 250)) throw new HttpError(400, 'Taille invalide (100 à 250 cm).');
    if (body?.birthYear != null && !(year >= 1900 && year <= 2100)) throw new HttpError(400, 'Année de naissance invalide.');
    db.prepare('UPDATE users SET name = ?, sex = ?, height_cm = ?, birth_year = ?, goal = ? WHERE id = ?')
      .run(name, sex, body?.heightCm != null ? height : null, body?.birthYear != null ? year : null, goal, UID);
    return me();
  }
  if (path === '/auth/config') return { allowRegistration: false };
  if (path === '/auth/logout') return { ok: true };
  if (path === '/local/demo' && method === 'POST') {
    const has = db.prepare('SELECT 1 FROM workouts WHERE user_id = ? LIMIT 1').get(UID);
    if (has) throw new HttpError(409, 'Des séances existent déjà : efface tes données avant de charger l’exemple.');
    seedDemoData(db as unknown as DB, UID, String(body?.today));
    return me();
  }
  if (path === '/local/reset' && method === 'POST') {
    db.transaction(() => { db.prepare('DELETE FROM users').run(); ensureUser(db); })();
    return me();
  }
  return undefined;
}

export class LocalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function localApi(method: string, url: string, body?: unknown): Promise<unknown> {
  const { db, routers } = await (ctx ??= init());
  const [path, search = ''] = url.split('?');
  // Aller-retour JSON : même sérialisation qu'une vraie requête HTTP (undefined retiré, objets copiés).
  const payload = body === undefined ? undefined : JSON.parse(JSON.stringify(body));
  let result: unknown;
  try {
    result = localRoutes(db, method, path, payload);
    if (result === undefined) {
      const found = match(routers, method, path);
      if (!found) throw new HttpError(404, 'Ressource introuvable.');
      const res = {
        locals: { userId: UID }, body: undefined as unknown,
        status() { return res; }, json(b: unknown) { res.body = b; return res; }, setHeader() { return res; },
      };
      found.handler({ params: found.params, query: Object.fromEntries(new URLSearchParams(search)), body: payload ?? {}, get: () => undefined }, res);
      result = res.body;
    }
  } catch (e) {
    if (e instanceof HttpError) throw new LocalError(e.status, e.message);
    console.error(e);
    throw new LocalError(500, 'Erreur interne.');
  }
  if (method !== 'GET') await persist(db);
  return JSON.parse(JSON.stringify(result ?? null));
}
