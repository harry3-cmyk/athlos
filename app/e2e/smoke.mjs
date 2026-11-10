/**
 * Test de bout en bout : démarre le serveur de production sur une base temporaire, puis déroule dans Chromium
 * le parcours complet (inscription → programme → planning → séance → records → corps → analyse).
 * Prérequis : `npm run build`. Lancer avec `npm run e2e`. Captures dans e2e/shots/.
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright n'est pas une dépendance du projet : `npm i -D playwright && npx playwright install chromium` pour lancer ce test.
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'e2e/shots');
fs.mkdirSync(shots, { recursive: true });
const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-e2e-')), 'e2e.db');
const PORT = 3999;
const base = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, PORT: String(PORT), DATABASE_PATH: dbPath };

execFileSync('npx', ['tsx', 'src/seed-demo.ts'], { cwd: path.join(root, 'server'), env, stdio: 'inherit' });
const server = spawn('node', ['dist/index.js'], { cwd: path.join(root, 'server'), env, stdio: 'inherit' });
for (let i = 0; ; i++) {
  try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* pas encore prêt */ }
  if (i > 50) throw new Error('Le serveur ne démarre pas');
  await new Promise(r => setTimeout(r, 200));
}

const errors = [];
let step = 0;
const ok = msg => console.log(`  ✓ ${String(++step).padStart(2)} ${msg}`);
const browser = await chromium.launch();

async function newPage(viewport, colorScheme = 'light') {
  const ctx = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 1, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/status of 40[01]/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('dialog', d => d.accept());
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
const noOverflow = async (page, name) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 1) errors.push(`débordement horizontal (${over}px) : ${name}`);
};

try {
  // ——— Parcours 1 : nouvel utilisateur, sur mobile ———
  const m = await newPage({ width: 390, height: 844 });
  await m.goto(base);
  await m.getByRole('link', { name: 'Créer un compte' }).click();
  await m.getByLabel('Prénom').fill('Harry');
  await m.getByLabel('E-mail').fill('e2e@test.fr');
  await m.getByLabel('Mot de passe').fill('motdepasse-e2e');
  await m.getByRole('button', { name: 'Créer mon compte' }).click();
  await m.getByText('Bienvenue sur Forge').waitFor();
  await shot(m, 'm-01-accueil-vide'); ok('inscription et écran d’accueil vide');

  await m.getByRole('link', { name: 'Créer mon programme' }).click();
  await m.getByRole('button', { name: 'Force', exact: true }).click();
  await m.getByRole('group', { name: 'Séances par semaine' }).getByRole('button', { name: '3' }).click();
  await m.getByRole('button', { name: 'Générer l’aperçu' }).click();
  await m.getByText('Corps entier A').first().waitFor();
  await noOverflow(m, 'aperçu programme'); await shot(m, 'm-02-apercu-programme');
  await m.getByRole('button', { name: 'Enregistrer ce programme' }).first().click();
  await m.getByRole('heading', { name: 'Planifier sur le calendrier' }).waitFor();
  ok('génération et enregistrement d’un programme Force 3 j');

  await m.getByRole('button', { name: /Planifier \d+ semaines/ }).click();
  await m.waitForURL('**/planning');
  await m.locator('.cal-ev').first().waitFor();
  const planned = await m.locator('.cal-ev.planned').count();
  if (planned < 3) errors.push(`planning : ${planned} séances planifiées visibles`);
  await noOverflow(m, 'planning'); await shot(m, 'm-03-planning'); ok(`planification (${planned} séances visibles ce mois)`);

  // Séance 1 : depuis le programme, saisie complète
  await m.goto(base + '/programmes');
  await m.locator('a.list-item').first().click();
  await m.getByRole('button', { name: 'Démarrer' }).first().click();
  await m.waitForURL('**/seances/*');
  await m.locator('.ex-card').first().waitFor();
  const cards = await m.locator('.ex-card').count();
  const fillFirst = async (weight, reps) => {
    const rows = m.locator('.ex-card').first().locator('tbody tr');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      await rows.nth(i).locator('input').nth(0).fill(String(weight));
      await rows.nth(i).locator('input').nth(1).fill(String(reps));
      await rows.nth(i).locator('button.check').click();
    }
    return n;
  };
  const nSets = await fillFirst('100', 5);
  await m.locator('.rest-bar').waitFor();
  await shot(m, 'm-04-seance-en-cours');
  await m.getByRole('button', { name: 'Passer' }).click();
  await m.getByText('Enregistré', { exact: false }).first().waitFor();
  await m.reload(); // l'auto-enregistrement doit survivre à un rechargement
  await m.locator('.ex-card').first().waitFor();
  const kept = await m.locator('.ex-card').first().locator('button.check[aria-pressed="true"]').count();
  if (kept !== nSets) errors.push(`auto-enregistrement : ${kept}/${nSets} séries retrouvées après rechargement`);
  ok(`saisie de ${nSets} séries, minuteur de repos, auto-enregistrement (${cards} exercices)`);

  await m.getByRole('button', { name: 'Terminer' }).click();
  await m.getByRole('dialog', { name: 'Séance terminée' }).waitFor();
  await m.getByRole('button', { name: 'Voir la séance' }).click();
  if (await m.locator('.ex-card').count() !== 1) errors.push('fin de séance : les exercices sans série validée devraient être retirés');
  ok('fin de séance : seules les séries validées sont conservées');

  // Séance 2 : même séance → suggestion de progression puis record
  await m.goto(base + '/programmes');
  await m.locator('a.list-item').first().click();
  await m.getByRole('button', { name: 'Démarrer' }).first().click();
  await m.locator('.hint-box').first().waitFor();
  const hint = await m.locator('.hint-box').first().innerText();
  if (!/Dernière fois/.test(hint) || !/102,5/.test(hint)) errors.push(`suggestion inattendue : ${hint}`);
  const prefilled = await m.locator('.ex-card').first().locator('tbody tr input').first().inputValue();
  if (prefilled !== '102.5') errors.push(`charge pré-remplie : ${prefilled}`);
  const rows = m.locator('.ex-card').first().locator('tbody tr');
  await rows.first().locator('button.check').click();
  await m.getByRole('button', { name: 'Passer' }).click();
  await m.getByRole('button', { name: 'Terminer' }).click();
  await m.getByRole('dialog').getByText('charge record').waitFor();
  await shot(m, 'm-05-record'); ok('double progression (100 → 102,5 kg) et détection du record');
  await m.getByRole('link', { name: 'Tableau de bord' }).click();
  await m.getByText('Records récents').waitFor();
  await noOverflow(m, 'tableau de bord mobile');

  // Corps
  await m.goto(base + '/corps');
  await m.getByLabel('Poids (kg)').fill('80,4');
  await m.getByLabel('Tour de taille (cm)').fill('85');
  await m.getByLabel('Tour de cou (cm)').fill('38');
  await m.getByRole('button', { name: 'Enregistrer' }).click();
  await m.getByRole('cell', { name: '80,4' }).first().waitFor();
  ok('saisie d’une mesure corporelle (virgule décimale acceptée)');

  // Séance libre + exercice personnalisé
  await m.goto(base + '/seances');
  await m.getByRole('button', { name: 'Séance libre' }).click();
  await m.getByRole('button', { name: 'Ajouter un exercice' }).click();
  await m.getByLabel('Rechercher un exercice').fill('developpe couche');
  await m.getByRole('button', { name: /^Développé couché\s*Pectoraux/ }).click();
  await m.locator('.ex-card').waitFor();
  await m.getByRole('button', { name: 'Ajouter un exercice' }).click();
  await m.getByLabel('Rechercher un exercice').fill('Landmine press');
  await m.getByRole('button', { name: 'Créer un exercice personnalisé' }).click();
  await m.getByRole('button', { name: 'Créer et ajouter' }).click();
  await m.getByRole('heading', { name: 'Landmine press' }).waitFor();
  await m.getByRole('button', { name: 'Terminer' }).click();
  await m.getByText('Valide au moins une série').waitFor();
  await m.getByRole('button', { name: 'Supprimer la séance' }).click();
  await m.waitForURL('**/seances');
  ok('séance libre, recherche sans accents, exercice personnalisé, garde-fou de fin de séance, suppression');

  // Réglages : déconnexion / reconnexion
  await m.goto(base + '/reglages');
  await m.getByRole('button', { name: 'Se déconnecter' }).click();
  await m.getByRole('button', { name: 'Se connecter' }).waitFor();
  await m.getByLabel('E-mail').fill('e2e@test.fr');
  await m.getByLabel('Mot de passe').fill('mauvais');
  await m.getByRole('button', { name: 'Se connecter' }).click();
  await m.getByText('E-mail ou mot de passe incorrect').waitFor();
  ok('déconnexion et refus d’un mauvais mot de passe');
  await m.context().close();

  // ——— Parcours 2 : compte de démonstration (12 semaines de données), bureau, clair et sombre ———
  for (const scheme of ['light', 'dark']) {
    const d = await newPage({ width: 1360, height: 900 }, scheme);
    await d.goto(base);
    await d.getByLabel('E-mail').fill('demo@forge.local');
    await d.getByLabel('Mot de passe').fill('demo1234');
    await d.getByRole('button', { name: 'Se connecter' }).click();
    const pages = [
      ['/', 'tableau-de-bord', 'Volume hebdomadaire'], ['/seances', 'seances', 'Historique'], ['/planning', 'planning', 'Terminée'],
      ['/progression', 'progression', 'Tous les records'], ['/programmes', 'programmes', 'Générer un programme'],
      ['/corps', 'corps', 'Historique'], ['/analyse', 'analyse', 'À corriger en priorité'], ['/reglages', 'reglages', 'Mes données'],
    ];
    for (const [url, name, marker] of pages) {
      await d.goto(base + url);
      await d.getByText(marker, { exact: false }).first().waitFor();
      await d.waitForTimeout(250);
      await noOverflow(d, `${name} (${scheme})`);
      await shot(d, `d-${scheme}-${name}`);
    }
    if (scheme === 'light') {
      await d.goto(base + '/analyse');
      await d.getByText(/Développé couché : (stagnation|en régression)/).waitFor();
      await d.goto(base + '/');
      await d.locator('.recharts-bar-rectangle').first().waitFor();
      if (await d.locator('.recharts-bar-rectangle').count() < 8) errors.push('graphique de volume : barres manquantes');
      await d.locator('.recharts-wrapper').first().hover({ position: { x: 300, y: 100 } });
      await d.locator('.chart-tip').first().waitFor();
    }
    ok(`8 pages rendues sans erreur ni débordement — bureau, thème ${scheme === 'light' ? 'clair' : 'sombre'}`);
    await d.context().close();
  }

  // Mobile, données de démo
  const md = await newPage({ width: 390, height: 844 }, 'dark');
  await md.goto(base);
  await md.getByLabel('E-mail').fill('demo@forge.local');
  await md.getByLabel('Mot de passe').fill('demo1234');
  await md.getByRole('button', { name: 'Se connecter' }).click();
  for (const [url, name, marker] of [['/', 'tableau-de-bord', 'Volume hebdomadaire'], ['/progression', 'progression', 'Tous les records'],
    ['/analyse', 'analyse', 'À corriger en priorité'], ['/planning', 'planning', 'Terminée'], ['/corps', 'corps', 'Historique']]) {
    await md.goto(base + url);
    await md.getByText(marker, { exact: false }).first().waitFor();
    await md.waitForTimeout(250);
    await noOverflow(md, `${name} (mobile)`);
    await shot(md, `m-demo-${name}`);
  }
  ok('5 pages rendues sans débordement — mobile, thème sombre');
} catch (e) {
  errors.push(`exception : ${e.message}`);
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) {
  console.error(`\n${errors.length} problème(s) :\n` + errors.map(e => '  ✗ ' + e).join('\n'));
  process.exit(1);
}
console.log('\nParcours de bout en bout réussi.');
