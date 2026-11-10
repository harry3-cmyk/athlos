import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { DEMO, seedDemo } from '../src/seed-demo.js';

/** Tests d'intégration : vraie app Express + SQLite en mémoire, via HTTP. */
const db = openDb(':memory:');
const server = createApp(db, { rateLimit: false }).listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

function client() {
  let cookie = '';
  return async (method: string, url: string, body?: unknown, headers: Record<string, string> = { 'X-Requested-With': 'forge' }) => {
    const res = await fetch(base + url, {
      method, headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() as any };
  };
}

const alice = client();
const bob = client();
const today = new Date().toISOString().slice(0, 10);
let exercises: any[];
const idOf = (name: string) => exercises.find(e => e.name === name).id;

beforeAll(async () => {
  expect((await alice('POST', '/auth/register', { email: 'alice@test.fr', password: 'motdepasse1', name: 'Alice' })).status).toBe(201);
  expect((await bob('POST', '/auth/register', { email: 'bob@test.fr', password: 'motdepasse2', name: 'Bob' })).status).toBe(201);
  exercises = (await alice('GET', '/exercises')).body;
});
afterAll(() => { server.close(); db.close(); });

describe('authentification', () => {
  it('protège l’API et refuse les écritures sans en-tête anti-CSRF', async () => {
    expect((await client()('GET', '/workouts')).status).toBe(401);
    expect((await alice('POST', '/body', { date: today, weightKg: 80 }, {})).status).toBe(403);
  });
  it('refuse doublon, mot de passe court et mauvais identifiants', async () => {
    expect((await client()('POST', '/auth/register', { email: 'ALICE@test.fr', password: 'motdepasse1', name: 'A' })).status).toBe(409);
    expect((await client()('POST', '/auth/register', { email: 'c@test.fr', password: 'court', name: 'C' })).status).toBe(400);
    expect((await client()('POST', '/auth/login', { email: 'alice@test.fr', password: 'faux' })).status).toBe(401);
  });
  it('connexion, profil, déconnexion', async () => {
    const c = client();
    expect((await c('POST', '/auth/login', { email: 'alice@test.fr', password: 'motdepasse1' })).status).toBe(200);
    const me = await c('PATCH', '/auth/me', { name: 'Alice', sex: 'female', heightCm: 168, birthYear: 1995, goal: 'strength' });
    expect(me.body).toMatchObject({ goal: 'strength', heightCm: 168 });
    await c('POST', '/auth/logout');
    expect((await c('GET', '/auth/me')).status).toBe(401);
  });
});

describe('séances', () => {
  let id: number;
  const bench = () => idOf('Développé couché');

  it('crée, sauvegarde et termine une séance ; ne garde que les séries validées', async () => {
    const created = await alice('POST', '/workouts', { name: 'Test', date: '2026-01-05', status: 'in_progress', exercises: [] });
    expect(created.status).toBe(201);
    id = created.body.id;
    expect((await alice('POST', `/workouts/${id}/finish`)).status).toBe(400); // aucune série validée
    const put = await alice('PUT', `/workouts/${id}`, {
      name: 'Pecs', date: '2026-01-05', exercises: [{ exerciseId: bench(), repsMin: 6, repsMax: 8, sets: [
        { weight: 60, reps: 8, done: true }, { weight: 60, reps: 8, done: true }, { weight: 60, reps: 0, done: false },
      ] }],
    });
    expect(put.status).toBe(200);
    const fin = await alice('POST', `/workouts/${id}/finish`);
    expect(fin.body.workout.status).toBe('done');
    expect(fin.body.workout.exercises[0].sets).toHaveLength(2);
    expect(fin.body.records).toEqual([]); // première référence ≠ record
  });

  it('propose la progression et détecte un record', async () => {
    const w2 = await alice('POST', '/workouts', { name: 'Pecs 2', date: '2026-01-08', status: 'planned',
      exercises: [{ exerciseId: bench(), targetSets: 2, repsMin: 6, repsMax: 8 }] });
    const started = await alice('POST', `/workouts/${w2.body.id}/start`, {});
    const e = started.body.exercises[0];
    expect(e.previous.sets).toHaveLength(2);
    expect(e.suggestion).toMatchObject({ weight: 62.5, reps: 6 }); // 2×8 au haut de fourchette → +2,5 kg
    expect(e.sets).toHaveLength(2);
    expect(e.sets[0]).toMatchObject({ weight: 62.5, reps: 6, done: false });
    await alice('PUT', `/workouts/${w2.body.id}`, { name: 'Pecs 2', date: '2026-01-08',
      exercises: [{ exerciseId: bench(), sets: [{ weight: 62.5, reps: 6, done: true }] }] });
    const fin = await alice('POST', `/workouts/${w2.body.id}/finish`);
    expect(fin.body.records).toHaveLength(1);
    expect(fin.body.records[0]).toMatchObject({ type: 'weight', value: 62.5, previous: 60 });
  });

  it('expose historique, records et liste', async () => {
    const h = await alice('GET', `/exercises/${bench()}/history`);
    expect(h.body.sessions).toHaveLength(2);
    expect(h.body.records.weight).toMatchObject({ value: 62.5, reps: 6 });
    expect(h.body.sessions[0].volume).toBe(960);
    const rec = await alice('GET', '/records');
    expect(rec.body[0]).toMatchObject({ name: 'Développé couché', weight: 62.5, sessions: 2 });
    const list = await alice('GET', '/workouts?status=done');
    expect(list.body).toHaveLength(2);
    expect(list.body[1]).toMatchObject({ setCount: 2, volume: 960 });
  });

  it('isole les données entre utilisateurs', async () => {
    expect((await bob('GET', `/workouts/${id}`)).status).toBe(404);
    expect((await bob('DELETE', `/workouts/${id}`)).status).toBe(404);
    expect((await bob('GET', '/workouts')).body).toEqual([]);
    expect((await bob('GET', `/exercises/${bench()}/history`)).body.sessions).toEqual([]);
  });

  it('valide les entrées', async () => {
    expect((await alice('POST', '/workouts', { name: '', date: 'hier', status: 'planned', exercises: [] })).status).toBe(400);
    expect((await alice('POST', '/workouts', { name: 'X', date: today, status: 'planned', exercises: [{ exerciseId: 99999 }] })).status).toBe(400);
  });

  it('gère les exercices personnalisés', async () => {
    const c = await alice('POST', '/exercises', { name: 'Landmine press', muscle: 'shoulders', equipment: 'barbell' });
    expect(c.status).toBe(201);
    expect((await bob('GET', '/exercises')).body.some((e: any) => e.name === 'Landmine press')).toBe(false);
    expect((await alice('DELETE', `/exercises/${c.body.id}`)).status).toBe(200);
    expect((await alice('DELETE', `/exercises/${bench()}`)).status).toBe(404); // catalogue non supprimable
  });
});

describe('programmes et planning', () => {
  const config = { goal: 'hypertrophy', days: 4, level: 'intermediate', equipment: 'gym', minutes: 75, priorities: ['shoulders'] };
  let pid: number;

  it('génère un aperçu puis enregistre', async () => {
    const preview = await bob('POST', '/programs/generate', config);
    expect(preview.body.days).toHaveLength(4);
    expect(preview.body.rationale.principles.length).toBeGreaterThan(2);
    const saved = await bob('POST', '/programs', { config });
    expect(saved.status).toBe(201);
    pid = saved.body.id;
    expect(saved.body.days[0].exercises[0].id).toBeGreaterThan(0);
    expect(saved.body.weeklySets).toEqual(preview.body.weeklySets);
  });

  it('planifie avec semaine de décharge', async () => {
    expect((await bob('POST', `/programs/${pid}/schedule`, { startDate: '2026-03-02', weeks: 4, weekdays: [0, 1] })).status).toBe(400);
    const s = await bob('POST', `/programs/${pid}/schedule`, { startDate: '2026-03-02', weeks: 4, weekdays: [0, 1, 3, 4], deloadEvery: 4 });
    expect(s.body.created).toBe(16);
    const planned = (await bob('GET', '/workouts?status=planned&from=2026-03-01&to=2026-03-31')).body;
    expect(planned).toHaveLength(16);
    expect(planned.filter((w: any) => w.deload)).toHaveLength(4);
    expect(planned[planned.length - 1].date).toBe('2026-03-02');
    // replanifier remplace au lieu de dupliquer
    await bob('POST', `/programs/${pid}/schedule`, { startDate: '2026-03-02', weeks: 2, weekdays: [0, 2, 4, 5] });
    expect((await bob('GET', '/workouts?status=planned')).body).toHaveLength(8);
  });

  it('substitue un exercice, déplace une séance, lance une séance du programme', async () => {
    const p = (await bob('GET', `/programs/${pid}`)).body;
    const first = p.days[0].exercises[0];
    const swap = await bob('PATCH', `/programs/${pid}/exercises/${first.id}`, { exerciseId: idOf('Développé couché haltères'), sets: 5 });
    expect(swap.body.days[0].exercises[0]).toMatchObject({ name: 'Développé couché haltères', sets: 5 });
    const w = (await bob('GET', '/workouts?status=planned')).body[0];
    expect((await bob('PATCH', `/workouts/${w.id}`, { date: '2026-03-20' })).status).toBe(200);
    const created = await bob('POST', `/programs/${pid}/days/${p.days[1].id}/start`, { date: today });
    const started = await bob('POST', `/workouts/${created.body.id}/start`, {});
    expect(started.body.status).toBe('in_progress');
    expect(started.body.exercises[0].sets.length).toBe(started.body.exercises[0].targetSets);
  });

  it('supprime le programme et ses séances planifiées', async () => {
    expect((await alice('DELETE', `/programs/${pid}`)).status).toBe(404);
    expect((await bob('DELETE', `/programs/${pid}`)).status).toBe(200);
    expect((await bob('GET', '/workouts?status=planned')).body).toHaveLength(0);
  });
});

describe('corps', () => {
  it('fusionne par date, calcule tendance et estimation de masse grasse', async () => {
    await bob('PATCH', '/auth/me', { name: 'Bob', sex: 'male', heightCm: 178, birthYear: 1990, goal: 'fat_loss' });
    await bob('POST', '/body', { date: '2026-02-01', weightKg: 82 });
    await bob('POST', '/body', { date: '2026-02-01', weightKg: 81.5, waistCm: 86, neckCm: 38 });
    const rows = (await bob('POST', '/body', { date: '2026-02-08', weightKg: 80.5, bodyFatPct: 17 })).body;
    expect(rows).toHaveLength(2);
    expect(rows[0].weightKg).toBe(81.5);
    expect(rows[0].bodyFatEstimate).toBeGreaterThan(10);
    expect(rows[0].leanMassKg).toBeGreaterThan(55);
    expect(rows[1]).toMatchObject({ bodyFatEstimate: null, leanMassKg: 66.8 });
    expect(rows[1].weightTrend).toBeCloseTo(81.3, 1);
    expect((await bob('POST', '/body', { date: '2026-02-09', weightKg: 5 })).status).toBe(400);
    expect((await bob('DELETE', `/body/${rows[0].id}`)).body).toHaveLength(1);
  });
});

describe('tableau de bord, analyse, export', () => {
  const demo = client();
  beforeAll(async () => {
    seedDemo(db, today);
    expect((await demo('POST', '/auth/login', DEMO)).status).toBe(200);
  });

  it('agrège le tableau de bord', async () => {
    const d = (await demo('GET', `/dashboard?today=${today}`)).body;
    expect(d.weekly).toHaveLength(12);
    expect(d.kpis.totalWorkouts).toBeGreaterThan(35);
    expect(d.kpis.streakWeeks).toBeGreaterThanOrEqual(10);
    expect(d.kpis.weight.value).toBeGreaterThan(70);
    expect(d.planned.length).toBeGreaterThan(0);
    expect(d.records.length).toBeGreaterThan(0);
    expect(d.muscles).toHaveLength(10);
  });

  it('repère la stagnation simulée du développé couché', async () => {
    const a = (await demo('GET', `/analysis?today=${today}`)).body;
    expect(a.dataQuality.enough).toBe(true);
    const bench = a.findings.find((f: any) => f.title.startsWith('Développé couché :'));
    expect(bench?.category).toBe('Progression');
    expect(a.ratios.length).toBeGreaterThan(0);
    expect(a.weightTrend.kgPerWeek).toBeGreaterThan(-0.3);
  });

  it('exporte puis réimporte dans un autre compte', async () => {
    const dump = (await demo('GET', '/export')).body;
    expect(dump.version).toBe(1);
    const carol = client();
    await carol('POST', '/auth/register', { email: 'carol@test.fr', password: 'motdepasse3', name: 'Carol' });
    const imp = await carol('POST', '/import', dump);
    expect(imp.body.workouts).toBe(dump.workouts.length);
    const a = (await demo('GET', '/records')).body, b = (await carol('GET', '/records')).body;
    expect(b.map((r: any) => [r.name, r.e1rm])).toEqual(a.map((r: any) => [r.name, r.e1rm]));
    expect((await carol('POST', '/import', { version: 2 })).status).toBe(400);
  });
});
