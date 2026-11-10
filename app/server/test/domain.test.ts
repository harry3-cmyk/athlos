import { describe, expect, it } from 'vitest';
import { analyze, type AnalysisSet } from '../src/domain/analysis.js';
import { EXERCISE_SEED, MUSCLES } from '../src/domain/exercises.seed.js';
import { generateProgram, type CatalogExercise, type GenConfig } from '../src/domain/generator.js';
import { addDays, e1rm, ema, linreg, navyBodyFat, suggestNext, weekStart } from '../src/domain/metrics.js';

const catalog: CatalogExercise[] = EXERCISE_SEED.map((e, i) => ({ id: i + 1, ...e }));
const cfg = (o: Partial<GenConfig> = {}): GenConfig => ({
  goal: 'hypertrophy', days: 4, level: 'intermediate', equipment: 'gym', minutes: 75, priorities: [], ...o,
});

describe('metrics', () => {
  it('estime le 1RM (Epley)', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 1);
    expect(e1rm(0, 10)).toBe(0);
    expect(e1rm(60, 30)).toBe(e1rm(60, 12)); // plafonné à 12 reps
  });
  it('calcule les semaines ISO', () => {
    expect(weekStart('2026-11-10')).toBe('2026-11-09'); // mardi → lundi
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // dimanche
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('régression et moyenne mobile', () => {
    expect(linreg([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]).slope).toBeCloseTo(2);
    expect(linreg([{ x: 0, y: 1 }]).slope).toBe(0);
    expect(ema([10, 20], 0.5)).toEqual([10, 15]);
  });
  it('estime la masse grasse (US Navy) dans une plage plausible', () => {
    const bf = navyBodyFat({ sex: 'male', heightCm: 178, waistCm: 85, neckCm: 38 })!;
    expect(bf).toBeGreaterThan(12); expect(bf).toBeLessThan(22);
    expect(navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 70, neckCm: 32 })).toBeNull(); // hanches requises
    expect(navyBodyFat({ sex: 'male', heightCm: 178, waistCm: 30, neckCm: 38 })).toBeNull();
  });
  it('double progression', () => {
    expect(suggestNext([{ weight: 80, reps: 10 }, { weight: 80, reps: 10 }], 6, 10)).toMatchObject({ weight: 82.5, reps: 6 });
    expect(suggestNext([{ weight: 80, reps: 8 }, { weight: 80, reps: 7 }], 6, 10)).toMatchObject({ weight: 80, reps: 8 });
    expect(suggestNext([{ weight: 100, reps: 5 }], 3, 5, { deload: true })).toMatchObject({ weight: 90, reps: 3 });
    expect(suggestNext([], 6, 10)).toBeNull();
  });
});

describe('générateur', () => {
  it.each([2, 3, 4, 5, 6])('produit %i séances cohérentes', days => {
    const p = generateProgram(cfg({ days }), catalog);
    expect(p.days).toHaveLength(days);
    for (const d of p.days) {
      expect(d.exercises.length).toBeGreaterThanOrEqual(3);
      expect(new Set(d.exercises.map(e => e.exerciseId)).size).toBe(d.exercises.length); // pas de doublon
      expect(d.estMinutes).toBeLessThanOrEqual(85);
      for (const e of d.exercises) expect(e.repsMin).toBeLessThanOrEqual(e.repsMax);
    }
  });
  it('travaille chaque grand groupe au moins 2×/semaine dès 4 jours', () => {
    const p = generateProgram(cfg({ days: 4 }), catalog);
    for (const w of p.weeklySets.filter(w => !['abs', 'calves'].includes(w.muscle))) {
      expect(w.frequency, w.muscle).toBeGreaterThanOrEqual(2);
    }
  });
  it('respecte le matériel disponible', () => {
    const byId = new Map(catalog.map(e => [e.id, e]));
    for (const d of generateProgram(cfg({ equipment: 'bodyweight' }), catalog).days) {
      for (const e of d.exercises) expect(byId.get(e.exerciseId)!.equipment).toBe('bodyweight');
    }
    for (const d of generateProgram(cfg({ equipment: 'dumbbells' }), catalog).days) {
      for (const e of d.exercises) expect(['dumbbell', 'bodyweight']).toContain(byId.get(e.exerciseId)!.equipment);
    }
  });
  it('adapte la prescription à l’objectif et au niveau', () => {
    const s = generateProgram(cfg({ goal: 'strength' }), catalog).days[0].exercises[0];
    expect(s).toMatchObject({ role: 'main', repsMin: 3, repsMax: 5 });
    expect(s.restSec).toBeGreaterThanOrEqual(180);
    const beg = generateProgram(cfg({ level: 'beginner' }), catalog).days[0].exercises[0];
    const adv = generateProgram(cfg({ level: 'advanced' }), catalog).days[0].exercises[0];
    expect(beg.sets).toBeLessThan(adv.sets);
  });
  it('augmente le volume des muscles prioritaires', () => {
    const sets = (p: ReturnType<typeof generateProgram>) => p.weeklySets.find(w => w.muscle === 'shoulders')!.sets;
    expect(sets(generateProgram(cfg({ priorities: ['shoulders'] }), catalog))).toBeGreaterThan(sets(generateProgram(cfg(), catalog)));
  });
  it('tient dans la durée demandée', () => {
    for (const d of generateProgram(cfg({ minutes: 45 }), catalog).days) expect(d.estMinutes).toBeLessThanOrEqual(50);
  });
});

describe('analyse', () => {
  const today = '2026-11-10';
  const ex = (slug: string) => { const e = catalog.find(c => (c as any).slug === slug)!; return { ...e, exerciseId: e.id, slug }; };
  const mk = (slug: string, date: string, weight: number, reps: number, workoutId: number): AnalysisSet => {
    const e = ex(slug);
    return { date, workoutId, exerciseId: e.id, slug, name: e.name, muscle: e.muscle, secondary: e.secondary,
      pattern: e.pattern, compound: e.compound, weight, reps };
  };

  it('signale le manque de données', () => {
    const r = analyze({ today, goal: 'hypertrophy', sets: [], missedPlanned: 0, weights: [] });
    expect(r.dataQuality.enough).toBe(false);
    expect(r.findings.map(f => f.id)).toEqual(['data']);
    expect(r.muscles).toHaveLength(MUSCLES.length);
  });

  it('détecte déséquilibre, muscles négligés, stagnation et rapport de force', () => {
    const sets: AnalysisSet[] = [];
    // 8 semaines, 2 séances/semaine : beaucoup de développé couché (stagnant), très peu de tirage, squat qui progresse.
    for (let w = 0; w < 8; w++) {
      for (const [k, off] of [[0, 0], [1, 3]] as const) {
        const date = addDays(today, -55 + w * 7 + off);
        const id = w * 2 + k + 1;
        for (let i = 0; i < 5; i++) sets.push(mk('bench-press', date, 60, 8, id));
        for (let i = 0; i < 4; i++) sets.push(mk('back-squat', date, 100 + w * 5, 5, id));
        if (k === 0) sets.push(mk('barbell-row', date, 50, 8, id));
      }
    }
    const r = analyze({ today, goal: 'hypertrophy', sets, missedPlanned: 6, weights: [] });
    const ids = r.findings.map(f => f.id);
    expect(r.dataQuality.enough).toBe(true);
    expect(ids).toContain('bal-pull');
    expect(ids).toContain('vol-back');
    expect(ids).toContain(`trend-${ex('bench-press').id}`);
    expect(ids).toContain('ratio-bench-press-back-squat'); // 76 / 158 ≈ 0,48 < 0,6
    expect(ids).toContain('adherence');
    expect(r.findings.find(f => f.id === `trend-${ex('back-squat').id}`)?.severity).toBe('good');
    expect(r.muscles.find(m => m.muscle === 'chest')!.weeklySets).toBe(10);
    // tri par gravité
    const order = { high: 0, medium: 1, low: 2, good: 3 } as const;
    const sev = r.findings.map(f => order[f.severity]);
    expect([...sev].sort((a, b) => a - b)).toEqual(sev);
  });

  it('évalue le rythme de perte de poids', () => {
    const weights = Array.from({ length: 10 }, (_, i) => ({ date: addDays(today, -27 + i * 3), weight: 90 - i * 0.6 }));
    const r = analyze({ today, goal: 'fat_loss', sets: [], missedPlanned: 0, weights });
    expect(r.weightTrend!.kgPerWeek).toBeCloseTo(-1.4, 1);
    expect(r.findings.find(f => f.id === 'weight')?.title).toMatch(/trop rapide/);
  });
});

describe('objectifs mixtes', () => {
  const byId = new Map(catalog.map(e => [e.id, e]));
  const goals = ['powerbuilding', 'athletic', 'tactical'] as const;
  const equipments = ['gym', 'dumbbells', 'bodyweight'] as const;

  it('génère un programme cohérent pour chaque objectif, matériel et fréquence', () => {
    for (const goal of goals) for (const equipment of equipments) for (const days of [2, 3, 4, 5, 6]) {
      const p = generateProgram(cfg({ goal, equipment, days, minutes: 60 }), catalog);
      const tag = `${goal}/${equipment}/${days}`;
      expect(p.days, tag).toHaveLength(days);
      for (const d of p.days) {
        expect(d.exercises.length, `${tag} ${d.name}`).toBeGreaterThanOrEqual(1);
        expect(new Set(d.exercises.map(e => e.exerciseId)).size, tag).toBe(d.exercises.length);
        expect(d.estMinutes, `${tag} ${d.name}`).toBeLessThanOrEqual(70);
        for (const e of d.exercises) expect(e.repsMin, tag).toBeLessThanOrEqual(e.repsMax);
      }
      expect(p.rationale.principles.length, tag).toBeGreaterThan(3);
    }
  });

  it('force + hypertrophie : lourd sur les mouvements de base, volume au repère', () => {
    const p = generateProgram(cfg({ goal: 'powerbuilding' }), catalog);
    expect(p.days[0].exercises[0]).toMatchObject({ role: 'main', repsMin: 3, repsMax: 6 });
    expect(p.days[0].exercises.some(e => e.role === 'accessory' && e.repsMax === 15)).toBe(true);
    for (const w of p.weeklySets.filter(w => !['abs', 'calves'].includes(w.muscle))) expect(w.sets, w.muscle).toBeGreaterThanOrEqual(10);
  });

  it('athlétique : chaque séance de force commence par de l’explosif, conditionnement présent', () => {
    const p = generateProgram(cfg({ goal: 'athletic', days: 4, minutes: 60 }), catalog);
    const strength = p.days.filter(d => d.exercises[0].role !== 'cardio');
    expect(strength).toHaveLength(3);
    for (const d of strength) expect(d.exercises[0].role, d.name).toBe('power');
    expect(p.days.some(d => d.exercises.some(e => e.muscle === 'cardio'))).toBe(true);
    expect(p.weeklySets.find(w => w.muscle === 'quads')!.sets).toBeGreaterThan(0);
    expect(generateProgram(cfg({ goal: 'athletic', days: 2, minutes: 45 }), catalog).weeklySets.find(w => w.muscle === 'quads')!.sets).toBeGreaterThan(0);
  });

  it('opérateur : force, endurance fondamentale, intervalles et marche chargée', () => {
    const p = generateProgram(cfg({ goal: 'tactical', days: 5, minutes: 60 }), catalog);
    const patterns = p.days.flatMap(d => d.exercises.map(e => byId.get(e.exerciseId)!.pattern));
    for (const need of ['squat', 'hinge', 'v_pull', 'zone2', 'intervals', 'ruck', 'carry', 'endurance_push']) expect(patterns, need).toContain(need);
    const cardioMinutes = p.days.flatMap(d => d.exercises).filter(e => e.muscle === 'cardio').reduce((s, e) => s + e.sets * e.repsMax, 0);
    expect(cardioMinutes).toBeGreaterThanOrEqual(90);
    // le cardio ne pollue pas le volume musculaire
    expect(p.weeklySets.every(w => Number.isFinite(w.sets))).toBe(true);
    // sans sac lesté : sortie longue à la place, sans séance vide
    const bw = generateProgram(cfg({ goal: 'tactical', days: 5, equipment: 'bodyweight' }), catalog);
    expect(bw.days[4].name).toBe('Sortie longue');
    expect(bw.days[4].exercises).toHaveLength(1);
    expect(generateProgram(cfg({ goal: 'tactical', days: 3 }), catalog).rationale.warnings.join(' ')).toMatch(/4 séances ou plus/);
  });

  it('analyse : signale le manque d’endurance pour un profil opérateur', () => {
    const today = '2026-11-10';
    const e = catalog.find(c => (c as any).slug === 'back-squat')!;
    const sets = Array.from({ length: 8 }, (_, i) => ({
      date: addDays(today, -i * 3), workoutId: i + 1, exerciseId: e.id, slug: 'back-squat', name: e.name, muscle: 'quads' as const,
      secondary: [], pattern: e.pattern, compound: true, weight: 100, reps: 5,
    }));
    const low = analyze({ today, goal: 'tactical', sets, cardio: [{ date: today, workoutId: 50, minutes: 40, km: 7 }], missedPlanned: 0, weights: [] });
    expect(low.cardio).toMatchObject({ minutesPerWeek: 10, kmPerWeek: 1.8 });
    expect(low.findings.find(f => f.id === 'cardio')?.severity).toBe('high');
    const ok = analyze({ today, goal: 'tactical', sets, missedPlanned: 0, weights: [],
      cardio: Array.from({ length: 8 }, (_, i) => ({ date: addDays(today, -i * 3), workoutId: 60 + i, minutes: 50, km: 8 })) });
    expect(ok.findings.find(f => f.id === 'cardio')).toBeUndefined();
    expect(analyze({ today, goal: 'hypertrophy', sets, missedPlanned: 0, weights: [] }).findings.find(f => f.id === 'cardio')).toBeUndefined();
  });
});
