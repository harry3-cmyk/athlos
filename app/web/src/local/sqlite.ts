import type { Database as SqlJsDatabase } from 'sql.js';

/**
 * Adaptateur sql.js (SQLite compilé en WebAssembly) exposant le sous-ensemble de l'API better-sqlite3
 * utilisé par le serveur : prepare().get/all/run, transaction, pragma, exec.
 * La base vit en mémoire ; `saveBytes` l'écrit dans IndexedDB après chaque modification.
 */
type Params = unknown[];

function bindings(params: Params): any {
  const norm = (v: unknown) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const first = params[0];
  if (params.length === 1 && first !== null && typeof first === 'object' && !(first instanceof Uint8Array)) {
    // Paramètres nommés : better-sqlite3 accepte { uid } pour @uid, sql.js attend la clé préfixée.
    return Object.fromEntries(Object.entries(first as Record<string, unknown>).map(([k, v]) => ['@' + k, norm(v)]));
  }
  return params.map(norm);
}

export function wrap(raw: SqlJsDatabase) {
  let depth = 0;
  const db = {
    raw,
    prepare(sql: string) {
      const rows = (params: Params, limit: number) => {
        const st = raw.prepare(sql);
        try {
          st.bind(bindings(params));
          const out: any[] = [];
          while (out.length < limit && st.step()) out.push(st.getAsObject());
          return out;
        } finally { st.free(); }
      };
      return {
        get: (...params: Params) => rows(params, 1)[0],
        all: (...params: Params) => rows(params, Infinity),
        run: (...params: Params) => {
          raw.run(sql, bindings(params));
          const changes = raw.getRowsModified();
          const lastInsertRowid = raw.exec('SELECT last_insert_rowid()')[0].values[0][0] as number;
          return { changes, lastInsertRowid };
        },
      };
    },
    exec(sql: string) { raw.exec(sql); },
    pragma(source: string, opts?: { simple?: boolean }) {
      const res = raw.exec(`PRAGMA ${source}`);
      return opts?.simple ? res[0]?.values[0]?.[0] : res;
    },
    /** Transactions imbriquées aplaties : seule la plus externe ouvre et valide. */
    transaction<A extends unknown[], R>(fn: (...args: A) => R) {
      return (...args: A): R => {
        if (depth > 0) return fn(...args);
        raw.exec('BEGIN');
        depth++;
        try {
          const result = fn(...args);
          raw.exec('COMMIT');
          return result;
        } catch (e) {
          raw.exec('ROLLBACK');
          throw e;
        } finally { depth--; }
      };
    },
    /** Sérialise la base. sql.js rouvre la connexion à l'export : il faut réactiver les clés étrangères. */
    export(): Uint8Array {
      const bytes = raw.export();
      raw.exec('PRAGMA foreign_keys = ON');
      return bytes;
    },
  };
  return db;
}

// ——— Persistance IndexedDB (une seule entrée : le fichier SQLite) ———
const IDB_NAME = 'forge', STORE = 'kv', KEY = 'sqlite';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadBytes(): Promise<Uint8Array | null> {
  const idb = await open();
  try {
    return await new Promise((resolve, reject) => {
      const req = idb.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally { idb.close(); }
}

export async function saveBytes(bytes: Uint8Array): Promise<void> {
  const idb = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(bytes, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { idb.close(); }
}
