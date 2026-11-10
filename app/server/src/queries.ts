import type { DB } from './schema.js';
import type { Muscle, Pattern } from './domain/exercises.seed.js';
import type { CatalogExercise } from './domain/generator.js';
import { e1rm, round1, suggestNext } from './domain/metrics.js';
import { HttpError } from './http.js';

/** Série de travail validée (hors échauffement) d'une séance terminée, enrichie de son exercice. */
export interface WorkSet {
  date: string; workoutId: number; exerciseId: number; slug: string | null; name: string;
  muscle: Muscle; secondary: Muscle[]; pattern: Pattern; compound: boolean;
  weight: number; reps: number; rpe: number | null;
  cardio: boolean; // pour le cardio : weight = distance (km), reps = durée (min)
}

/** Par défaut, seules les séries de musculation sont renvoyées ; `kind: 'all'` ajoute le cardio. */
export function workSets(db: DB, uid: number, f: { from?: string; exerciseId?: number; kind?: 'strength' | 'all' } = {}): WorkSet[] {
  const rows = db.prepare(`
    SELECT w.date, w.id AS workoutId, e.id AS exerciseId, e.slug, e.name, e.muscle, e.secondary, e.pattern,
           e.compound, s.weight, s.reps, s.rpe
    FROM sets s
    JOIN workout_exercises we ON we.id = s.workout_exercise_id
    JOIN workouts w ON w.id = we.workout_id
    JOIN exercises e ON e.id = we.exercise_id
    WHERE w.user_id = @uid AND w.status = 'done' AND s.done = 1 AND s.warmup = 0 AND s.reps > 0
      AND (@from IS NULL OR w.date >= @from)
      AND (@exerciseId IS NULL OR e.id = @exerciseId)
      AND (@all = 1 OR e.muscle != 'cardio')
    ORDER BY w.date, w.id, we.position, s.position
  `).all({ uid, from: f.from ?? null, exerciseId: f.exerciseId ?? null, all: f.kind === 'all' ? 1 : 0 }) as any[];
  return rows.map(r => ({ ...r, secondary: JSON.parse(r.secondary), compound: !!r.compound, cardio: r.muscle === 'cardio' }));
}

export interface PrEvent {
  date: string; workoutId: number; exerciseId: number; name: string;
  type: 'e1rm' | 'weight' | 'reps'; value: number; previous: number; weight: number; reps: number;
}

/**
 * Rejoue l'historique dans l'ordre chronologique et relève chaque record battu.
 * Le premier passage sur un exercice sert de référence et ne compte pas comme record.
 * Les séries d'une même séance sont comparées à l'état d'AVANT la séance (un seul record par type et par séance).
 */
export function prEvents(sets: WorkSet[]): PrEvent[] {
  const best = new Map<number, { e1rm: number; weight: number; reps: number }>();
  const events: PrEvent[] = [];
  let i = 0;
  while (i < sets.length) {
    let j = i;
    while (j < sets.length && sets[j].workoutId === sets[i].workoutId) j++;
    const byEx = new Map<number, WorkSet[]>();
    for (const s of sets.slice(i, j)) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s]);
    for (const [exId, group] of byEx) {
      const prev = best.get(exId);
      const top = (score: (s: WorkSet) => number) => group.reduce((a, b) => (score(b) > score(a) ? b : a));
      const loaded = group.some(s => s.weight > 0);
      const bE = top(s => e1rm(s.weight, s.reps)), bW = top(s => s.weight), bR = top(s => s.reps);
      const cur = { e1rm: e1rm(bE.weight, bE.reps), weight: bW.weight, reps: bR.reps };
      if (prev) {
        const base = { date: bE.date, workoutId: bE.workoutId, exerciseId: exId, name: bE.name };
        if (loaded && cur.weight > prev.weight) {
          events.push({ ...base, type: 'weight', value: cur.weight, previous: prev.weight, weight: bW.weight, reps: bW.reps });
        } else if (loaded && cur.e1rm > prev.e1rm + 0.05) {
          events.push({ ...base, type: 'e1rm', value: round1(cur.e1rm), previous: round1(prev.e1rm), weight: bE.weight, reps: bE.reps });
        } else if (!loaded && prev.weight === 0 && cur.reps > prev.reps) {
          events.push({ ...base, type: 'reps', value: cur.reps, previous: prev.reps, weight: 0, reps: bR.reps });
        }
      }
      best.set(exId, {
        e1rm: Math.max(prev?.e1rm ?? 0, cur.e1rm), weight: Math.max(prev?.weight ?? 0, cur.weight),
        reps: Math.max(prev?.reps ?? 0, cur.reps),
      });
    }
    i = j;
  }
  return events;
}

export function catalog(db: DB, uid: number): CatalogExercise[] {
  const rows = db.prepare(
    `SELECT id, name, muscle, secondary, equipment, pattern, compound FROM exercises
     WHERE user_id IS NULL OR user_id = ? ORDER BY id`).all(uid) as any[];
  return rows.map(r => ({ ...r, secondary: JSON.parse(r.secondary), compound: !!r.compound }));
}

export function assertExercises(db: DB, uid: number, ids: number[]) {
  const ok = db.prepare('SELECT 1 FROM exercises WHERE id = ? AND (user_id IS NULL OR user_id = ?)');
  for (const id of new Set(ids)) if (!ok.get(id, uid)) throw new HttpError(400, `Exercice inconnu (${id}).`);
}

export function ownWorkout(db: DB, uid: number, id: number): any {
  const w = db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(id, uid);
  if (!w) throw new HttpError(404, 'Séance introuvable.');
  return w;
}

/** Dernière performance sur un exercice avant une séance donnée (séances terminées uniquement). */
export function previousPerformance(db: DB, uid: number, exerciseId: number, excludeWorkoutId: number) {
  const last = db.prepare(`
    SELECT w.id, w.date FROM workouts w JOIN workout_exercises we ON we.workout_id = w.id
    WHERE w.user_id = ? AND w.status = 'done' AND we.exercise_id = ? AND w.id != ?
      AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id AND s.done = 1 AND s.warmup = 0)
    ORDER BY w.date DESC, w.id DESC LIMIT 1`).get(uid, exerciseId, excludeWorkoutId) as any;
  if (!last) return null;
  const sets = db.prepare(`
    SELECT s.weight, s.reps, s.rpe FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
    WHERE we.workout_id = ? AND we.exercise_id = ? AND s.done = 1 AND s.warmup = 0
    ORDER BY we.position, s.position`).all(last.id, exerciseId) as { weight: number; reps: number; rpe: number | null }[];
  return { date: last.date as string, sets };
}

/** Séance complète : exercices, séries, dernière performance et charge conseillée. */
export function loadWorkout(db: DB, uid: number, id: number) {
  const w = ownWorkout(db, uid, id);
  const exs = db.prepare(`
    SELECT we.*, e.name, e.muscle, e.equipment FROM workout_exercises we
    JOIN exercises e ON e.id = we.exercise_id WHERE we.workout_id = ? ORDER BY we.position`).all(id) as any[];
  const setsStmt = db.prepare('SELECT weight, reps, rpe, warmup, done FROM sets WHERE workout_exercise_id = ? ORDER BY position');
  return {
    id: w.id, name: w.name, date: w.date, status: w.status, startedAt: w.started_at, finishedAt: w.finished_at,
    notes: w.notes, programId: w.program_id, deload: !!w.deload,
    exercises: exs.map(x => {
      const previous = previousPerformance(db, uid, x.exercise_id, id);
      const suggestion = previous && x.reps_min && x.reps_max && x.muscle !== 'cardio'
        ? suggestNext(previous.sets, x.reps_min, x.reps_max, { deload: !!w.deload }) : null;
      return {
        exerciseId: x.exercise_id, name: x.name, muscle: x.muscle, equipment: x.equipment,
        targetSets: x.target_sets, repsMin: x.reps_min, repsMax: x.reps_max, rir: x.rir, restSec: x.rest_sec,
        notes: x.notes,
        sets: (setsStmt.all(x.id) as any[]).map(s => ({ ...s, warmup: !!s.warmup, done: !!s.done })),
        previous, suggestion,
      };
    }),
  };
}

export interface ExerciseInput {
  exerciseId: number; targetSets?: number | null; repsMin?: number | null; repsMax?: number | null;
  rir?: number | null; restSec?: number | null; notes?: string;
  sets?: { weight: number; reps: number; rpe?: number | null; warmup?: boolean; done?: boolean }[];
}

/** Remplace tout le contenu d'une séance (appelé dans une transaction). */
export function replaceWorkoutContent(db: DB, workoutId: number, exercises: ExerciseInput[]) {
  db.prepare('DELETE FROM workout_exercises WHERE workout_id = ?').run(workoutId);
  const insEx = db.prepare(`INSERT INTO workout_exercises
    (workout_id, exercise_id, position, target_sets, reps_min, reps_max, rir, rest_sec, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insSet = db.prepare(
    'INSERT INTO sets (workout_exercise_id, position, weight, reps, rpe, warmup, done) VALUES (?, ?, ?, ?, ?, ?, ?)');
  exercises.forEach((e, i) => {
    const weId = insEx.run(workoutId, e.exerciseId, i, e.targetSets ?? null, e.repsMin ?? null, e.repsMax ?? null,
      e.rir ?? null, e.restSec ?? null, e.notes ?? '').lastInsertRowid;
    (e.sets ?? []).forEach((s, j) =>
      insSet.run(weId, j, s.weight, s.reps, s.rpe ?? null, s.warmup ? 1 : 0, s.done ? 1 : 0));
  });
}
