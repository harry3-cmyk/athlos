import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { authRouter, requireAuth } from './auth.js';
import type { DB } from './db.js';
import { HttpError } from './http.js';
import { dataRouter } from './routes/data.js';
import { insightsRouter } from './routes/insights.js';
import { programsRouter } from './routes/programs.js';
import { workoutsRouter } from './routes/workouts.js';

export interface AppOptions {
  allowRegistration?: boolean;
  rateLimit?: boolean;
  staticDir?: string; // build du front (production)
}

export function createApp(db: DB, opts: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // un reverse proxy (Caddy, nginx, PaaS) devant l'app
  app.use(express.json({ limit: '20mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));

  // Anti-CSRF : toute écriture doit porter un en-tête qu'un formulaire d'un autre site ne peut pas envoyer.
  api.use((req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Requested-With') !== 'forge') {
      return next(new HttpError(403, 'Requête refusée.'));
    }
    next();
  });

  api.use('/auth', authRouter(db, {
    allowRegistration: opts.allowRegistration ?? true,
    rateLimit: opts.rateLimit ?? true,
  }));
  api.use(requireAuth(db));
  api.use(workoutsRouter(db));
  api.use(programsRouter(db));
  api.use(insightsRouter(db));
  api.use(dataRouter(db));
  api.use((_req, _res, next) => next(new HttpError(404, 'Ressource introuvable.')));

  app.use('/api', api);

  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(opts.staticDir!, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if ((err as any)?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide.' });
    if ((err as any)?.type === 'entity.too.large') return res.status(413).json({ error: 'Fichier trop volumineux.' });
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  });

  return app;
}
