import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { DB } from './db.js';
import { GOALS } from './domain/generator.js';
import { HttpError, parse, userId } from './http.js';

const COOKIE = 'forge_session';
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function setSessionCookie(req: Request, res: Response, token: string | null) {
  const attrs = [
    `${COOKIE}=${token ?? ''}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
    `Max-Age=${token ? SESSION_DAYS * 86400 : 0}`,
  ];
  if (req.secure) attrs.push('Secure'); // HTTPS détecté (y compris derrière un reverse proxy, cf. trust proxy)
  res.setHeader('Set-Cookie', attrs.join('; '));
}

/** Limiteur en mémoire : suffisant pour une instance unique. */
function rateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++h.n > max) return next(new HttpError(429, 'Trop de tentatives. Réessaie dans quelques minutes.'));
    if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
}

const publicUser = (u: any) => ({
  id: u.id, email: u.email, name: u.name, sex: u.sex, heightCm: u.height_cm, birthYear: u.birth_year, goal: u.goal,
});

export function requireAuth(db: DB) {
  const find = db.prepare(
    `SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')`);
  return (req: Request, res: Response, next: NextFunction) => {
    const token = readCookie(req, COOKIE);
    const row = token ? (find.get(sha256(token)) as { user_id: number } | undefined) : undefined;
    if (!row) return next(new HttpError(401, 'Connexion requise.'));
    res.locals.userId = row.user_id;
    next();
  };
}

export function authRouter(db: DB, opts: { allowRegistration: boolean; rateLimit: boolean }) {
  const r = Router();
  const limit = opts.rateLimit ? rateLimiter(20, 15 * 60 * 1000) : (_q: Request, _s: Response, n: NextFunction) => n();

  const startSession = (req: Request, res: Response, uid: number) => {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
      .run(sha256(token), uid, `+${SESSION_DAYS} days`);
    db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
    setSessionCookie(req, res, token);
  };

  r.get('/config', (_req, res) => res.json({ allowRegistration: opts.allowRegistration }));

  r.post('/register', limit, (req, res) => {
    if (!opts.allowRegistration) throw new HttpError(403, 'Les inscriptions sont fermées sur cette instance.');
    const body = parse(z.object({
      email: z.string().trim().email('e-mail invalide').max(200),
      password: z.string().min(8, '8 caractères minimum').max(200),
      name: z.string().trim().min(1).max(80),
    }), req.body);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(body.email)) {
      throw new HttpError(409, 'Un compte existe déjà avec cet e-mail.');
    }
    const info = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
      .run(body.email, hashPassword(body.password), body.name);
    startSession(req, res, Number(info.lastInsertRowid));
    res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)));
  });

  r.post('/login', limit, (req, res) => {
    const body = parse(z.object({ email: z.string().trim(), password: z.string() }), req.body);
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email) as any;
    if (!u || !verifyPassword(body.password, u.password_hash)) {
      throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
    }
    startSession(req, res, u.id);
    res.json(publicUser(u));
  });

  r.post('/logout', (req, res) => {
    const token = readCookie(req, COOKIE);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    setSessionCookie(req, res, null);
    res.json({ ok: true });
  });

  r.get('/me', requireAuth(db), (_req, res) => {
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId(res))));
  });

  r.patch('/me', requireAuth(db), (req, res) => {
    const b = parse(z.object({
      name: z.string().trim().min(1).max(80),
      sex: z.enum(['male', 'female']).nullable(),
      heightCm: z.number().min(100).max(250).nullable(),
      birthYear: z.number().int().min(1900).max(2100).nullable(),
      goal: z.enum(GOALS),
    }), req.body);
    db.prepare('UPDATE users SET name=?, sex=?, height_cm=?, birth_year=?, goal=? WHERE id=?')
      .run(b.name, b.sex, b.heightCm, b.birthYear, b.goal, userId(res));
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId(res))));
  });

  r.post('/password', requireAuth(db), limit, (req, res) => {
    const b = parse(z.object({ current: z.string(), next: z.string().min(8, '8 caractères minimum').max(200) }), req.body);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId(res)) as any;
    if (!verifyPassword(b.current, u.password_hash)) throw new HttpError(400, 'Mot de passe actuel incorrect.');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(b.next), u.id);
    res.json({ ok: true });
  });

  return r;
}
