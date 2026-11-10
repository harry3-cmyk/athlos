/**
 * Publie la version en ligne à la racine du dépôt parent (GitHub Pages réglé sur « Deploy from a branch : main / root »).
 * Compile avec des chemins relatifs, puis remplace index.html, assets/, icon.svg et manifest à la racine.
 * Usage (depuis app/) : npm run publish:root — puis commit + push.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(app, '..');
const dist = path.join(app, 'web/dist-pages');

execSync('npm run build:pages', { cwd: app, stdio: 'inherit', env: { ...process.env, VITE_BASE: './', VITE_LEGACY_URL: fs.existsSync(path.join(root, 'ancien')) ? 'ancien/' : '' } });
fs.rmSync(path.join(root, 'assets'), { recursive: true, force: true });
fs.cpSync(dist, root, { recursive: true });
console.log(`Site copié dans ${root}`);
