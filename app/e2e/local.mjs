/**
 * Test de bout en bout du mode « sur l'appareil » (build GitHub Pages) : sert web/dist-pages sous /forge/ comme le ferait
 * GitHub Pages, puis vérifie dans Chromium que tout fonctionne sans serveur et que les données survivent à un rechargement.
 * Prérequis : `VITE_BASE=/forge/ npm run build:pages`. Lancer avec `npm run e2e:pages`.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web/dist-pages');
const shots = path.join(root, 'e2e/shots');
fs.mkdirSync(shots, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x').pathname;
  if (!url.startsWith('/forge/')) { res.writeHead(404).end('hors du sous-chemin'); return; }
  let file = path.join(dist, url.slice('/forge/'.length) || 'index.html');
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
}).listen(4999);
const base = 'http://127.0.0.1:4999/forge/';

const errors = [];
let step = 0;
const ok = msg => console.log(`  ✓ ${String(++step).padStart(2)} ${msg}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('requestfailed', r => errors.push(`requête échouée: ${r.url()}`));
page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
page.on('dialog', d => d.accept());
const shot = name => page.screenshot({ path: path.join(shots, `local-${name}.png`), fullPage: true });
const noOverflow = async name => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 1) errors.push(`débordement horizontal (${over}px) : ${name}`);
};

try {
  await page.goto(base);
  await page.getByText('Bienvenue sur Forge').waitFor();
  await shot('01-accueil'); ok('ouverture directe, sans compte ni serveur');

  // Programme → séance → record
  await page.getByRole('link', { name: 'Créer mon programme' }).click();
  await page.getByRole('group', { name: 'Séances par semaine' }).getByRole('button', { name: '3' }).click();
  await page.getByRole('button', { name: 'Générer l’aperçu' }).click();
  await page.getByText('Corps entier A').first().waitFor();
  await page.getByRole('button', { name: 'Enregistrer ce programme' }).first().click();
  await page.getByRole('heading', { name: 'Planifier sur le calendrier' }).waitFor();
  ok('génération et enregistrement d’un programme');

  for (const [weight, expectRecord] of [['60', false], [null, true]]) {
    await page.goto(base + '#/programmes');
    await page.locator('a.list-item').first().click();
    await page.getByRole('button', { name: 'Démarrer' }).first().click();
    await page.locator('.ex-card').first().waitFor();
    const rows = page.locator('.ex-card').first().locator('tbody tr');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      if (weight) { await rows.nth(i).locator('input').nth(0).fill(weight); await rows.nth(i).locator('input').nth(1).fill('10'); }
      await rows.nth(i).locator('button.check').click();
    }
    await page.getByRole('button', { name: 'Passer' }).click();
    if (!weight) {
      const v = await rows.first().locator('input').first().inputValue();
      if (v !== '62.5') errors.push(`progression attendue 62.5, obtenu ${v}`);
    }
    await page.getByRole('button', { name: 'Terminer' }).click();
    await page.getByRole('dialog', { name: 'Séance terminée' }).waitFor();
    if (expectRecord) await page.getByRole('dialog').getByText('charge record').waitFor();
    await page.getByRole('button', { name: 'Voir la séance' }).click();
  }
  ok('deux séances saisies : progression conseillée (60 → 62,5 kg) et record détecté');

  // Persistance : rechargement complet, puis nouvel onglet du même navigateur
  await page.reload();
  await page.locator('.ex-card').first().waitFor();
  const p2 = await ctx.newPage();
  await p2.goto(base + '#/seances');
  await p2.getByRole('heading', { name: 'Historique' }).waitFor();
  await p2.locator('.card:has(h2:text("Historique")) a.list-item').first().waitFor();
  const done = await p2.locator('.card:has(h2:text("Historique")) a.list-item').count();
  if (done !== 2) errors.push(`persistance : ${done} séances retrouvées au lieu de 2`);
  await p2.close();
  ok('données conservées après rechargement et dans un nouvel onglet');

  // Lien profond rechargé (cas qui casse sur GitHub Pages sans routage par ancre)
  await page.goto(base + '#/corps');
  await page.reload();
  await page.getByLabel('Poids (kg)').fill('81,2');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('cell', { name: '81,2' }).first().waitFor();
  ok('lien profond rechargé + saisie d’une pesée');

  // Export → remise à zéro → import
  await page.goto(base + '#/reglages');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter (JSON)' }).click()]);
  const exportPath = path.join(shots, 'export-test.json');
  await download.saveAs(exportPath);
  const dump = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  if (dump.workouts.length !== 2 || dump.body.length !== 1) errors.push(`export : ${dump.workouts.length} séances, ${dump.body.length} mesures`);
  await page.getByRole('button', { name: 'Effacer toutes mes données' }).click();
  await page.getByText('Bienvenue sur Forge').waitFor();
  await page.goto(base + '#/reglages');
  await page.locator('input[type=file]').setInputFiles(exportPath);
  await page.getByText('2 séances et 1 mesures importées').waitFor();
  fs.rmSync(exportPath);
  ok('export, effacement complet, puis restauration par import');

  // Objectif « Opérateur » : programme mixte force + endurance, saisie d'une séance d'endurance
  await page.goto(base + '#/programmes');
  await page.getByRole('button', { name: 'Opérateur', exact: true }).click();
  await page.getByText('Préparation physique d’opérateur').waitFor();
  await page.getByRole('group', { name: 'Séances par semaine' }).getByRole('button', { name: '5' }).click();
  await page.getByRole('button', { name: 'Générer l’aperçu' }).click();
  await page.getByRole('heading', { name: 'Marche chargée' }).waitFor();
  await page.getByText('Le portage de charge s’entraîne en portant').waitFor();
  await noOverflow('aperçu opérateur'); await shot('operateur-apercu');
  await page.getByRole('button', { name: 'Enregistrer ce programme' }).first().click();
  await page.getByRole('heading', { name: 'Planifier sur le calendrier' }).waitFor();
  await page.locator('.card:has(h2:text-is("Endurance fondamentale"))').getByRole('button', { name: 'Démarrer' }).click();
  await page.locator('.ex-card').first().waitFor();
  const cardio = page.locator('.ex-card').first();
  await cardio.getByText('Distance (km)').waitFor();
  await cardio.locator('tbody tr input').nth(0).fill('7,5');
  if (await cardio.locator('tbody tr input').nth(1).inputValue() !== '35') errors.push('durée cible non pré-remplie');
  await cardio.locator('button.check').click();
  if (await page.locator('.rest-bar').count()) errors.push('minuteur de repos affiché après un effort continu');
  await shot('operateur-seance');
  await page.getByRole('button', { name: 'Terminer' }).click();
  await page.getByRole('dialog', { name: 'Séance terminée' }).waitFor();
  await page.getByRole('button', { name: 'Voir la séance' }).click();
  await page.getByRole('link', { name: 'Course — endurance fondamentale' }).click();
  await page.getByText('Durée par séance').waitFor();
  await page.getByRole('cell', { name: '4:40 /km' }).waitFor();
  await page.goto(base + '#/reglages');
  await page.getByRole('button', { name: 'Opérateur', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.goto(base + '#/analyse');
  await page.getByText('min/sem').waitFor();
  ok('objectif Opérateur : programme force + endurance, séance de course saisie en km et minutes, allure calculée');

  await page.goto(base + '#/programmes');
  await page.getByRole('button', { name: 'Opérateur + masse', exact: true }).click();
  await page.getByRole('button', { name: 'Générer l’aperçu' }).click();
  await page.getByText('Masse et endurance sont compatibles').waitFor();
  await page.getByText('Compromis assumé').waitFor();
  await noOverflow('aperçu opérateur + masse');
  ok('objectif Opérateur + masse : aperçu généré avec avertissements et sources');

  // Données d'exemple : toutes les pages
  await page.goto(base + '#/reglages');
  await page.getByRole('button', { name: 'Effacer toutes mes données' }).click();
  await page.getByText('Bienvenue sur Forge').waitFor();
  await page.getByRole('button', { name: 'Voir avec des données d’exemple' }).click();
  await page.getByText('Volume hebdomadaire').waitFor();
  for (const [hash, name, marker] of [['', 'tableau-de-bord', 'Volume hebdomadaire'], ['seances', 'seances', 'Historique'], ['planning', 'planning', 'Terminée'],
    ['progression', 'progression', 'Tous les records'], ['programmes', 'programmes', 'Générer un programme'], ['corps', 'corps', 'Historique'],
    ['analyse', 'analyse', 'À corriger en priorité'], ['reglages', 'reglages', 'Stockage sur l’appareil']]) {
    await page.goto(base + '#/' + hash);
    await page.getByText(marker, { exact: false }).first().waitFor();
    await page.waitForTimeout(250);
    await noOverflow(name);
    await shot(`demo-${name}`);
  }
  ok('données d’exemple : 8 pages rendues sans erreur ni débordement (mobile)');
} catch (e) {
  errors.push(`exception : ${e.message}`);
  await shot('echec').catch(() => {});
} finally {
  await browser.close();
  server.close();
}
if (errors.length) { console.error(`\n${errors.length} problème(s) :\n` + errors.map(e => '  ✗ ' + e).join('\n')); process.exit(1); }
console.log('\nMode « sur l’appareil » : parcours réussi.');
