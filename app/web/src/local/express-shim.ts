/**
 * Remplaçant minimal d'Express pour le mode navigateur : les fichiers `server/src/routes/*` sont réutilisés tels quels,
 * `import { Router } from 'express'` étant redirigé ici par un alias Vite. Seul le sous-ensemble utilisé est fourni.
 */
type Handler = (req: any, res: any) => void;
interface Route { method: string; parts: string[]; handler: Handler }
export interface LocalRouter {
  routes: Route[];
  get: (path: string, ...h: Handler[]) => LocalRouter;
  post: (path: string, ...h: Handler[]) => LocalRouter;
  put: (path: string, ...h: Handler[]) => LocalRouter;
  patch: (path: string, ...h: Handler[]) => LocalRouter;
  delete: (path: string, ...h: Handler[]) => LocalRouter;
}

export function Router(): LocalRouter {
  const routes: Route[] = [];
  const add = (method: string) => (path: string, ...h: Handler[]) => {
    routes.push({ method, parts: path.split('/').filter(Boolean), handler: h[h.length - 1] });
    return router;
  };
  const router: LocalRouter = { routes, get: add('GET'), post: add('POST'), put: add('PUT'), patch: add('PATCH'), delete: add('DELETE') };
  return router;
}

/** Trouve la route correspondante et extrait les paramètres `:nom`. */
export function match(routers: LocalRouter[], method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
  const parts = path.split('/').filter(Boolean);
  for (const r of routers) {
    for (const route of r.routes) {
      if (route.method !== method || route.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      if (route.parts.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(parts[i])), true) : p === parts[i]))) {
        return { handler: route.handler, params };
      }
    }
  }
  return null;
}

export default { Router };
