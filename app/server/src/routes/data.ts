import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../schema.js';
import { CARDIO, MUSCLES } from '../domain/exercises.seed.js';
import { parse, userId, zDate } from '../http.js';
import { replaceWorkoutContent } from '../queries.js';

/**
 * Export / import JSON : sauvegarde portable des données de l'utilisateur.
 * Les exercices sont référencés par `slug` (catalogue) ou par nom (personnalisés) pour survivre à un changement d'instance.
 * Les programmes ne sont pas exportés : ils se régénèrent à partir de leur configuration.
 */

const zRef = z.object({ slug: z.string().nullable(), name: z.string(), muscle: z.enum([...MUSCLES, CARDIO]), equipment: z.string(), compound: z.boolean() });
const zImport = z.object({
  version: z.literal(1),
  workouts: z.array(z.object({
    name: z.string().min(1).max(100), date: zDate, status: z.enum(['planned', 'in_progress', 'done']),
    startedAt: z.string().nullable(), finishedAt: z.string().nullable(), notes: z.string().max(2000), deload: z.boolean(),
    exercises: z.array(z.object({
      exercise: zRef,
      targetSets: z.number().nullable(), repsMin: z.number().nullable(), repsMax: z.number().nullable(),
      rir: z.number().nullable(), restSec: z.number().nullable(), notes: z.string(),
      sets: z.array(z.object({ weight: z.number(), reps: z.number(), rpe: z.number().nullable(), warmup: z.boolean(), done: z.boolean() })),
    })),
  })).max(20000),
  body: z.array(z.object({
    date: zDate, weightKg: z.number().nullable(), bodyFatPct: z.number().nullable(), waistCm: z.number().nullable(),
    neckCm: z.number().nullable(), hipCm: z.number().nullable(), chestCm: z.number().nullable(), armCm: z.number().nullable(),
    thighCm: z.number().nullable(), notes: z.string(),
  })).max(20000),
});

export function dataRouter(db: DB) {
  const r = Router();

  r.get('/export', (_req, res) => {
    const uid = userId(res);
    const workouts = (db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY date, id').all(uid) as any[]).map(w => ({
      name: w.name, date: w.date, status: w.status, startedAt: w.started_at, finishedAt: w.finished_at, notes: w.notes, deload: !!w.deload,
      exercises: (db.prepare(`SELECT we.*, e.slug, e.name, e.muscle, e.equipment, e.compound FROM workout_exercises we
        JOIN exercises e ON e.id = we.exercise_id WHERE we.workout_id = ? ORDER BY we.position`).all(w.id) as any[]).map(x => ({
        exercise: { slug: x.slug, name: x.name, muscle: x.muscle, equipment: x.equipment, compound: !!x.compound },
        targetSets: x.target_sets, repsMin: x.reps_min, repsMax: x.reps_max, rir: x.rir, restSec: x.rest_sec, notes: x.notes,
        sets: (db.prepare('SELECT weight, reps, rpe, warmup, done FROM sets WHERE workout_exercise_id = ? ORDER BY position')
          .all(x.id) as any[]).map(s => ({ ...s, warmup: !!s.warmup, done: !!s.done })),
      })),
    }));
    const body = (db.prepare('SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date').all(uid) as any[]).map(b => ({
      date: b.date, weightKg: b.weight_kg, bodyFatPct: b.body_fat_pct, waistCm: b.waist_cm, neckCm: b.neck_cm, hipCm: b.hip_cm,
      chestCm: b.chest_cm, armCm: b.arm_cm, thighCm: b.thigh_cm, notes: b.notes,
    }));
    res.setHeader('Content-Disposition', `attachment; filename="forge-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ version: 1, exportedAt: new Date().toISOString(), workouts, body });
  });

  /** Import additif : les séances sont ajoutées, les mesures corporelles fusionnées par date (l'existant est conservé). */
  r.post('/import', (req, res) => {
    const uid = userId(res);
    const data = parse(zImport, req.body);
    const bySlug = db.prepare('SELECT id FROM exercises WHERE slug = ?');
    const byName = db.prepare('SELECT id FROM exercises WHERE name = ? COLLATE NOCASE AND (user_id IS NULL OR user_id = ?)');
    const create = db.prepare(`INSERT INTO exercises (user_id, name, muscle, equipment, pattern, compound) VALUES (?, ?, ?, ?, 'custom', ?)`);
    const resolve = (ref: z.infer<typeof zRef>): number => {
      const found = (ref.slug && bySlug.get(ref.slug)) || byName.get(ref.name, uid);
      if (found) return (found as { id: number }).id;
      const eq = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'].includes(ref.equipment) ? ref.equipment : 'machine';
      return Number(create.run(uid, ref.name, ref.muscle, eq, ref.compound ? 1 : 0).lastInsertRowid);
    };
    let bodyAdded = 0;
    db.transaction(() => {
      const ins = db.prepare(`INSERT INTO workouts (user_id, name, date, status, started_at, finished_at, notes, deload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const w of data.workouts) {
        const id = Number(ins.run(uid, w.name, w.date, w.status, w.startedAt, w.finishedAt, w.notes, w.deload ? 1 : 0).lastInsertRowid);
        replaceWorkoutContent(db, id, w.exercises.map(e => ({ ...e, exerciseId: resolve(e.exercise) })));
      }
      const insBody = db.prepare(`INSERT OR IGNORE INTO body_metrics
        (user_id, date, weight_kg, body_fat_pct, waist_cm, neck_cm, hip_cm, chest_cm, arm_cm, thigh_cm, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const b of data.body) {
        bodyAdded += insBody.run(uid, b.date, b.weightKg, b.bodyFatPct, b.waistCm, b.neckCm, b.hipCm, b.chestCm, b.armCm, b.thighCm, b.notes).changes;
      }
    })();
    res.json({ workouts: data.workouts.length, body: bodyAdded });
  });

  return r;
}
