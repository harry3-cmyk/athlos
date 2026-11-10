import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../schema.js';
import { CARDIO, MUSCLES } from '../domain/exercises.seed.js';
import { e1rm, round1 } from '../domain/metrics.js';
import { HttpError, parse, userId, zDate, zId } from '../http.js';
import {
  assertExercises, loadWorkout, ownWorkout, prEvents, previousPerformance, replaceWorkoutContent, workSets,
} from '../queries.js';

const zSet = z.object({
  weight: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(500),
  rpe: z.number().min(1).max(10).nullable().optional(),
  warmup: z.boolean().optional(),
  done: z.boolean().optional(),
});
const zExercise = z.object({
  exerciseId: zId,
  targetSets: z.number().int().min(1).max(20).nullable().optional(),
  repsMin: z.number().int().min(1).max(100).nullable().optional(),
  repsMax: z.number().int().min(1).max(100).nullable().optional(),
  rir: z.number().int().min(0).max(10).nullable().optional(),
  restSec: z.number().int().min(0).max(900).nullable().optional(),
  notes: z.string().max(500).optional(),
  sets: z.array(zSet).max(50).optional(),
});
const zContent = z.object({
  name: z.string().trim().min(1).max(100),
  date: zDate,
  notes: z.string().max(2000).optional(),
  exercises: z.array(zExercise).max(40),
});

export function workoutsRouter(db: DB) {
  const r = Router();

  // — Catalogue d'exercices
  r.get('/exercises', (_req, res) => {
    const rows = db.prepare(`
      SELECT e.id, e.name, e.muscle, e.equipment, e.pattern, e.compound, e.user_id IS NOT NULL AS custom
      FROM exercises e WHERE e.user_id IS NULL OR e.user_id = ? ORDER BY e.name COLLATE NOCASE`).all(userId(res)) as any[];
    res.json(rows.map(x => ({ ...x, compound: !!x.compound, custom: !!x.custom })));
  });

  r.post('/exercises', (req, res) => {
    const b = parse(z.object({
      name: z.string().trim().min(2).max(80),
      muscle: z.enum([...MUSCLES, CARDIO]),
      equipment: z.enum(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other']),
      compound: z.boolean().default(false),
    }), req.body);
    const info = db.prepare(`INSERT INTO exercises (user_id, name, muscle, equipment, pattern, compound)
      VALUES (?, ?, ?, ?, 'custom', ?)`).run(userId(res), b.name, b.muscle, b.equipment, b.compound ? 1 : 0);
    res.status(201).json({ id: Number(info.lastInsertRowid), ...b, pattern: 'custom', custom: true });
  });

  r.delete('/exercises/:id', (req, res) => {
    const id = parse(zId, req.params.id);
    const ex = db.prepare('SELECT * FROM exercises WHERE id = ? AND user_id = ?').get(id, userId(res));
    if (!ex) throw new HttpError(404, 'Exercice personnalisé introuvable.');
    const used = db.prepare(`SELECT 1 FROM workout_exercises WHERE exercise_id = ?
      UNION SELECT 1 FROM program_day_exercises WHERE exercise_id = ?`).get(id, id);
    if (used) throw new HttpError(409, 'Cet exercice est utilisé dans une séance ou un programme.');
    db.prepare('DELETE FROM exercises WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // — Historique et records d'un exercice
  r.get('/exercises/:id/history', (req, res) => {
    const id = parse(zId, req.params.id);
    const sets = workSets(db, userId(res), { exerciseId: id, kind: 'all' });
    if (sets[0]?.cardio) {
      // Endurance : distance et durée cumulées par séance.
      const by = new Map<number, { workoutId: number; date: string; km: number; minutes: number }>();
      for (const s of sets) {
        const x = by.get(s.workoutId) ?? { workoutId: s.workoutId, date: s.date, km: 0, minutes: 0 };
        x.km = round1(x.km + s.weight); x.minutes += s.reps;
        by.set(s.workoutId, x);
      }
      res.json({ cardio: true, sessions: [...by.values()], records: null });
      return;
    }
    const sessions = new Map<number, any>();
    for (const s of sets) {
      if (!sessions.has(s.workoutId)) {
        sessions.set(s.workoutId, { workoutId: s.workoutId, date: s.date, e1rm: 0, topWeight: 0, topReps: 0, volume: 0, sets: [] });
      }
      const x = sessions.get(s.workoutId);
      x.e1rm = Math.max(x.e1rm, round1(e1rm(s.weight, s.reps)));
      if (s.weight > x.topWeight || (s.weight === x.topWeight && s.reps > x.topReps)) { x.topWeight = s.weight; x.topReps = s.reps; }
      x.volume += s.weight * s.reps;
      x.sets.push({ weight: s.weight, reps: s.reps, rpe: s.rpe });
    }
    const list = [...sessions.values()];
    const best = <K extends string>(k: K) => list.reduce<any>((a, b) => (!a || b[k] > a[k] ? b : a), null);
    res.json({
      sessions: list,
      records: list.length ? {
        e1rm: { value: best('e1rm').e1rm, date: best('e1rm').date },
        weight: { value: best('topWeight').topWeight, reps: best('topWeight').topReps, date: best('topWeight').date },
        volume: { value: Math.round(best('volume').volume), date: best('volume').date },
      } : null,
    });
  });

  /** Tableau des records : meilleur 1RM estimé et charge max par exercice. */
  r.get('/records', (_req, res) => {
    const by = new Map<number, any>();
    for (const s of workSets(db, userId(res))) {
      let x = by.get(s.exerciseId);
      if (!x) by.set(s.exerciseId, x = { exerciseId: s.exerciseId, name: s.name, muscle: s.muscle, e1rm: 0, e1rmDate: s.date,
        weight: 0, reps: 0, weightDate: s.date, maxReps: 0, sessions: new Set<number>(), lastDate: s.date });
      const v = round1(e1rm(s.weight, s.reps));
      if (v > x.e1rm) { x.e1rm = v; x.e1rmDate = s.date; }
      if (s.weight > x.weight || (s.weight === x.weight && s.reps > x.reps)) { x.weight = s.weight; x.reps = s.reps; x.weightDate = s.date; }
      x.maxReps = Math.max(x.maxReps, s.reps);
      x.sessions.add(s.workoutId);
      x.lastDate = s.date;
    }
    res.json([...by.values()].map(x => ({ ...x, sessions: x.sessions.size })).sort((a, b) => b.sessions - a.sessions));
  });

  // — Séances
  r.get('/workouts', (req, res) => {
    const q = parse(z.object({
      from: zDate.optional(), to: zDate.optional(),
      status: z.enum(['planned', 'in_progress', 'done']).optional(),
      limit: z.coerce.number().int().min(1).max(500).default(200),
    }), req.query);
    const rows = db.prepare(`
      SELECT w.id, w.name, w.date, w.status, w.deload, w.program_id AS programId,
        (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exerciseCount,
        (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
          WHERE we.workout_id = w.id AND s.done = 1 AND s.warmup = 0) AS setCount,
        (SELECT COALESCE(SUM(s.weight * s.reps), 0) FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
          JOIN exercises e ON e.id = we.exercise_id
          WHERE we.workout_id = w.id AND s.done = 1 AND s.warmup = 0 AND e.muscle != 'cardio') AS volume,
        CASE WHEN w.started_at IS NOT NULL AND w.finished_at IS NOT NULL
          THEN CAST((julianday(w.finished_at) - julianday(w.started_at)) * 1440 AS INTEGER) END AS minutes
      FROM workouts w
      WHERE w.user_id = @uid AND (@from IS NULL OR w.date >= @from) AND (@to IS NULL OR w.date <= @to)
        AND (@status IS NULL OR w.status = @status)
      ORDER BY w.date DESC, w.id DESC LIMIT @limit`).all({
      uid: userId(res), from: q.from ?? null, to: q.to ?? null, status: q.status ?? null, limit: q.limit,
    }) as any[];
    res.json(rows.map(x => ({ ...x, deload: !!x.deload })));
  });

  r.post('/workouts', (req, res) => {
    const b = parse(zContent.extend({ status: z.enum(['planned', 'in_progress']) }), req.body);
    const uid = userId(res);
    assertExercises(db, uid, b.exercises.map(e => e.exerciseId));
    const id = db.transaction(() => {
      const info = db.prepare(`INSERT INTO workouts (user_id, name, date, status, started_at, notes)
        VALUES (?, ?, ?, ?, ?, ?)`).run(uid, b.name, b.date, b.status,
        b.status === 'in_progress' ? new Date().toISOString() : null, b.notes ?? '');
      replaceWorkoutContent(db, Number(info.lastInsertRowid), b.exercises);
      return Number(info.lastInsertRowid);
    })();
    res.status(201).json(loadWorkout(db, uid, id));
  });

  r.get('/workouts/:id', (req, res) => {
    res.json(loadWorkout(db, userId(res), parse(zId, req.params.id)));
  });

  /** Sauvegarde complète (auto-enregistrement de la saisie en cours, ou correction d'une séance passée). */
  r.put('/workouts/:id', (req, res) => {
    const id = parse(zId, req.params.id);
    const uid = userId(res);
    const b = parse(zContent, req.body);
    ownWorkout(db, uid, id);
    assertExercises(db, uid, b.exercises.map(e => e.exerciseId));
    db.transaction(() => {
      db.prepare('UPDATE workouts SET name = ?, date = ?, notes = ? WHERE id = ?').run(b.name, b.date, b.notes ?? '', id);
      replaceWorkoutContent(db, id, b.exercises);
    })();
    res.json({ ok: true });
  });

  /** Modification légère : déplacer ou renommer (planning). */
  r.patch('/workouts/:id', (req, res) => {
    const id = parse(zId, req.params.id);
    const b = parse(z.object({ date: zDate.optional(), name: z.string().trim().min(1).max(100).optional() }), req.body);
    const w = ownWorkout(db, userId(res), id);
    db.prepare('UPDATE workouts SET date = ?, name = ? WHERE id = ?').run(b.date ?? w.date, b.name ?? w.name, id);
    res.json({ ok: true });
  });

  r.delete('/workouts/:id', (req, res) => {
    const id = parse(zId, req.params.id);
    ownWorkout(db, userId(res), id);
    db.prepare('DELETE FROM workouts WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  /** Démarre une séance planifiée : pré-remplit les séries avec la charge conseillée. */
  r.post('/workouts/:id/start', (req, res) => {
    const id = parse(zId, req.params.id);
    const uid = userId(res);
    const b = parse(z.object({ date: zDate.optional() }), req.body ?? {});
    const w = ownWorkout(db, uid, id);
    if (w.status === 'done') throw new HttpError(409, 'Cette séance est déjà terminée.');
    if (w.status === 'planned') {
      db.transaction(() => {
        db.prepare(`UPDATE workouts SET status = 'in_progress', started_at = ?, date = ? WHERE id = ?`)
          .run(new Date().toISOString(), b.date ?? w.date, id);
        const full = loadWorkout(db, uid, id);
        replaceWorkoutContent(db, id, full.exercises.map(e => ({
          ...e,
          sets: e.sets.length ? e.sets : Array.from({ length: e.targetSets ?? 3 }, (_, i) => {
            const prev = previousPerformance(db, uid, e.exerciseId, id);
            return {
              weight: e.suggestion?.weight ?? prev?.sets[Math.min(i, prev.sets.length - 1)]?.weight ?? 0,
              reps: e.suggestion?.reps ?? e.repsMin ?? 0,
              done: false,
            };
          }),
        })));
      })();
    }
    res.json(loadWorkout(db, uid, id));
  });

  /** Termine la séance : ne garde que les séries validées et renvoie les records battus. */
  r.post('/workouts/:id/finish', (req, res) => {
    const id = parse(zId, req.params.id);
    const uid = userId(res);
    const w = ownWorkout(db, uid, id);
    const done = db.prepare(`SELECT COUNT(*) AS n FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
      WHERE we.workout_id = ? AND s.done = 1`).get(id) as { n: number };
    if (!done.n) throw new HttpError(400, 'Valide au moins une série avant de terminer la séance.');
    db.transaction(() => {
      db.prepare(`DELETE FROM sets WHERE done = 0 AND workout_exercise_id IN
        (SELECT id FROM workout_exercises WHERE workout_id = ?)`).run(id);
      db.prepare(`DELETE FROM workout_exercises WHERE workout_id = ? AND NOT EXISTS
        (SELECT 1 FROM sets s WHERE s.workout_exercise_id = workout_exercises.id)`).run(id);
      db.prepare(`UPDATE workouts SET status = 'done', finished_at = COALESCE(finished_at, ?) WHERE id = ?`)
        .run(new Date().toISOString(), id);
    })();
    const records = prEvents(workSets(db, uid).filter(s => s.date <= w.date)).filter(e => e.workoutId === id);
    res.json({ workout: loadWorkout(db, uid, id), records });
  });

  /** Rouvre une séance terminée pour la corriger. */
  r.post('/workouts/:id/reopen', (req, res) => {
    const id = parse(zId, req.params.id);
    ownWorkout(db, userId(res), id);
    db.prepare(`UPDATE workouts SET status = 'in_progress' WHERE id = ?`).run(id);
    res.json({ ok: true });
  });

  return r;
}
