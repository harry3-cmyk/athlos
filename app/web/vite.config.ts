import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// VITE_LOCAL=1 : build autonome pour hébergement statique (GitHub Pages) — voir src/local/.
// VITE_BASE : sous-chemin de publication, p. ex. /forge/ pour https://<compte>.github.io/forge/.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    // Les routes du serveur sont réutilisées dans le navigateur : Express y est remplacé par un routeur minimal.
    alias: { express: fileURLToPath(new URL('./src/local/express-shim.ts', import.meta.url)) },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' }, fs: { allow: ['..'] } },
});
