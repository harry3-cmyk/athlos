import type { DB } from './schema.js';
import { generateProgram } from './domain/generator.js';
import { addDays, roundLoad, weekStart } from './domain/metrics.js';
import { catalog, replaceWorkoutContent } from './queries.js';
import { saveProgram } from './routes/programs.js';

/**
 * Données de démonstration : programme Haut/Bas 4 jours suivi pendant 12 semaines,
 * avec un développé couché volontairement en stagnation pour illustrer l'analyse.
 */
const START_KG: Record<string, number> = {
  squat: 90, hinge: 110, h_push: 70, incline_push: 26, v_push: 42.5, h_pull: 65, v_pull: 60, lunge: 18,
  hip_thrust: 90, knee_flex: 40, knee_ext: 50, calf: 80, curl: 14, tri_ext: 25, lateral_raise: 9,
  rear_delt: 20, chest_fly: 15, core: 30,
};

function prng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/** Remplit le compte `uid` avec 12 semaines d'historique simulé et 4 semaines planifiées. */
export function seedDemoData(db: DB, uid: number, today: string) {
  db.prepare(`UPDATE users SET sex = 'male', height_cm = 178, birth_year = 1994, goal = 'hypertrophy' WHERE id = ?`).run(uid);
  const cat = catalog(db, uid);
  const byId = new Map(cat.map(e => [e.id, e]));
  const program = generateProgram(
    { goal: 'hypertrophy', days: 4, level: 'intermediate', equipment: 'gym', minutes: 75, priorities: [] }, cat);
  const pid = saveProgram(db, uid, program);
  const rand = prng(42);
  const weekdays = [0, 1, 3, 4];
  const first = addDays(weekStart(today), -12 * 7);

  db.transaction(() => {
    const ins = db.prepare(`INSERT INTO workouts (user_id, name, date, status, started_at, finished_at, program_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (let w = 0; w < 16; w++) {
      program.days.forEach((day, i) => {
        const date = addDays(first, w * 7 + weekdays[i]);
        const past = date < today;
        if (past && rand() < 0.08) return; // séance sautée
        const started = `${date}T17:30:00.000Z`;
        const wid = Number(ins.run(uid, day.name, date, past ? 'done' : 'planned', past ? started : null,
          past ? `${date}T18:${35 + Math.floor(rand() * 20)}:00.000Z` : null, pid).lastInsertRowid);
        replaceWorkoutContent(db, wid, day.exercises.map(e => {
          const ex = byId.get(e.exerciseId)!;
          const stalled = ex.pattern === 'h_push' && w > 4; // plateau simulé
          const gain = stalled ? 1 + 0.012 * 4 : 1 + 0.012 * w;
          const weight = ex.equipment === 'bodyweight' ? 0 : roundLoad((START_KG[ex.pattern] ?? 20) * gain, ex.compound ? 2.5 : 1);
          return {
            exerciseId: e.exerciseId, targetSets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax, rir: e.rir, restSec: e.restSec,
            sets: past ? Array.from({ length: e.sets }, (_, k) => ({
              weight,
              reps: Math.max(e.repsMin - 1, Math.min(e.repsMax, e.repsMin + Math.floor(rand() * (e.repsMax - e.repsMin + 1)) - (k > 1 ? 1 : 0))),
              rpe: 7 + Math.round(rand() * 4) / 2, done: true,
            })) : [],
          };
        }));
      });
    }
    const insBody = db.prepare(`INSERT INTO body_metrics (user_id, date, weight_kg, waist_cm, neck_cm) VALUES (?, ?, ?, ?, ?)`);
    for (let d = 0; d < 12 * 7; d += 2) {
      const date = addDays(first, d);
      if (date > today) break;
      const monthly = d % 28 === 0;
      insBody.run(uid, date, Math.round((78 + (d / 7) * 0.15 + (rand() - 0.5) * 0.9) * 10) / 10,
        monthly ? 84 + d / 84 : null, monthly ? 38.5 : null);
    }
  })();
}

