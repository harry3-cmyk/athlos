import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../schema.js';
import { MUSCLES, type Muscle } from '../domain/exercises.seed.js';
import { GOALS, estimateMinutes, generateProgram, weeklyVolume, type GeneratedProgram } from '../domain/generator.js';
import { addDays, weekStart } from '../domain/metrics.js';
import { HttpError, parse, userId, zDate, zId } from '../http.js';
import { assertExercises, catalog, loadWorkout, replaceWorkoutContent } from '../queries.js';

const zConfig = z.object({
  goal: z.enum(GOALS),
  days: z.number().int().min(2).max(6),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  equipment: z.enum(['gym', 'dumbbells', 'bodyweight']),
  minutes: z.number().int().min(30).max(150),
  priorities: z.array(z.enum(MUSCLES)).max(3).default([]),
});

export function saveProgram(db: DB, uid: number, p: GeneratedProgram, name?: string): number {
  return db.transaction(() => {
    const pid = Number(db.prepare('INSERT INTO programs (user_id, name, goal, config, rationale) VALUES (?, ?, ?, ?, ?)')
      .run(uid, name || p.name, p.goal, JSON.stringify(p.config), JSON.stringify(p.rationale)).lastInsertRowid);
    const insDay = db.prepare('INSERT INTO program_days (program_id, position, name, focus) VALUES (?, ?, ?, ?)');
    const insEx = db.prepare(`INSERT INTO program_day_exercises
      (program_day_id, exercise_id, position, sets, reps_min, reps_max, rir, rest_sec, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    p.days.forEach((d, i) => {
      const did = insDay.run(pid, i, d.name, d.focus).lastInsertRowid;
      d.exercises.forEach((e, j) => insEx.run(did, e.exerciseId, j, e.sets, e.repsMin, e.repsMax, e.rir, e.restSec, e.role));
    });
    return pid;
  })();
}

function loadProgram(db: DB, uid: number, id: number) {
  const p = db.prepare('SELECT * FROM programs WHERE id = ? AND user_id = ?').get(id, uid) as any;
  if (!p) throw new HttpError(404, 'Programme introuvable.');
  const days = db.prepare('SELECT * FROM program_days WHERE program_id = ? ORDER BY position').all(id) as any[];
  const exStmt = db.prepare(`
    SELECT pde.id, pde.exercise_id AS exerciseId, e.name, e.muscle, e.secondary, e.pattern, pde.sets,
           pde.reps_min AS repsMin, pde.reps_max AS repsMax, pde.rir, pde.rest_sec AS restSec, pde.role
    FROM program_day_exercises pde JOIN exercises e ON e.id = pde.exercise_id
    WHERE pde.program_day_id = ? ORDER BY pde.position`);
  const outDays = days.map(d => {
    const exercises = (exStmt.all(d.id) as any[]).map(e => ({ ...e, secondary: JSON.parse(e.secondary) as Muscle[] }));
    return { id: d.id, name: d.name, focus: d.focus, estMinutes: estimateMinutes(exercises), exercises };
  });
  return {
    id: p.id, name: p.name, goal: p.goal, createdAt: p.created_at,
    config: JSON.parse(p.config), rationale: JSON.parse(p.rationale), days: outDays,
    weeklySets: weeklyVolume(outDays),
  };
}

export function programsRouter(db: DB) {
  const r = Router();

  /** Aperçu sans enregistrement. */
  r.post('/programs/generate', (req, res) => {
    res.json(generateProgram(parse(zConfig, req.body), catalog(db, userId(res))));
  });

  /** Enregistre : le programme est régénéré côté serveur à partir de la configuration (source de vérité). */
  r.post('/programs', (req, res) => {
    const b = parse(z.object({ config: zConfig, name: z.string().trim().max(100).optional() }), req.body);
    const uid = userId(res);
    const id = saveProgram(db, uid, generateProgram(b.config, catalog(db, uid)), b.name);
    res.status(201).json(loadProgram(db, uid, id));
  });

  r.get('/programs', (_req, res) => {
    res.json(db.prepare(`
      SELECT p.id, p.name, p.goal, p.created_at AS createdAt,
        (SELECT COUNT(*) FROM program_days d WHERE d.program_id = p.id) AS days,
        (SELECT COUNT(*) FROM workouts w WHERE w.program_id = p.id AND w.status = 'planned') AS planned
      FROM programs p WHERE p.user_id = ? ORDER BY p.id DESC`).all(userId(res)));
  });

  r.get('/programs/:id', (req, res) => res.json(loadProgram(db, userId(res), parse(zId, req.params.id))));

  r.delete('/programs/:id', (req, res) => {
    const id = parse(zId, req.params.id);
    const uid = userId(res);
    loadProgram(db, uid, id);
    db.transaction(() => {
      db.prepare(`DELETE FROM workouts WHERE program_id = ? AND status = 'planned'`).run(id);
      db.prepare('DELETE FROM programs WHERE id = ?').run(id);
    })();
    res.json({ ok: true });
  });

  /** Ajuste un exercice du programme : substitution ou prescription. */
  r.patch('/programs/:id/exercises/:pdeId', (req, res) => {
    const uid = userId(res);
    const id = parse(zId, req.params.id), pdeId = parse(zId, req.params.pdeId);
    const b = parse(z.object({
      exerciseId: zId.optional(),
      sets: z.number().int().min(1).max(10).optional(),
      repsMin: z.number().int().min(1).max(50).optional(),
      repsMax: z.number().int().min(1).max(50).optional(),
    }), req.body);
    loadProgram(db, uid, id);
    const row = db.prepare(`SELECT pde.* FROM program_day_exercises pde JOIN program_days d ON d.id = pde.program_day_id
      WHERE pde.id = ? AND d.program_id = ?`).get(pdeId, id) as any;
    if (!row) throw new HttpError(404, 'Exercice du programme introuvable.');
    if (b.exerciseId) assertExercises(db, uid, [b.exerciseId]);
    const repsMin = b.repsMin ?? row.reps_min, repsMax = b.repsMax ?? row.reps_max;
    if (repsMin > repsMax) throw new HttpError(400, 'La fourchette de répétitions est inversée.');
    db.prepare('UPDATE program_day_exercises SET exercise_id = ?, sets = ?, reps_min = ?, reps_max = ? WHERE id = ?')
      .run(b.exerciseId ?? row.exercise_id, b.sets ?? row.sets, repsMin, repsMax, pdeId);
    res.json(loadProgram(db, uid, id));
  });

  /**
   * Planifie le programme sur le calendrier.
   * weekdays : jours de la semaine (0 = lundi) dans l'ordre des séances du programme.
   * deloadEvery : une semaine de décharge toutes les N semaines (0 = jamais) — volume ≈ −40 %, effort réduit.
   */
  r.post('/programs/:id/schedule', (req, res) => {
    const uid = userId(res);
    const id = parse(zId, req.params.id);
    const b = parse(z.object({
      startDate: zDate,
      weeks: z.number().int().min(1).max(16),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      deloadEvery: z.number().int().min(0).max(8).default(0),
      replace: z.boolean().default(true),
    }), req.body);
    const p = loadProgram(db, uid, id);
    if (new Set(b.weekdays).size !== b.weekdays.length) throw new HttpError(400, 'Chaque jour ne peut être choisi qu’une fois.');
    if (b.weekdays.length !== p.days.length) {
      throw new HttpError(400, `Choisis exactement ${p.days.length} jours (un par séance du programme).`);
    }
    const weekdays = [...b.weekdays].sort((x, y) => x - y);
    const monday = weekStart(b.startDate);
    let created = 0;
    db.transaction(() => {
      if (b.replace) db.prepare(`DELETE FROM workouts WHERE program_id = ? AND status = 'planned' AND date >= ?`).run(id, b.startDate);
      const ins = db.prepare(`INSERT INTO workouts (user_id, name, date, status, program_id, deload) VALUES (?, ?, ?, 'planned', ?, ?)`);
      for (let w = 0; w < b.weeks; w++) {
        const deload = b.deloadEvery > 0 && (w + 1) % b.deloadEvery === 0;
        p.days.forEach((d, i) => {
          const date = addDays(monday, w * 7 + weekdays[i]);
          if (date < b.startDate) return;
          const wid = Number(ins.run(uid, deload ? `${d.name} (décharge)` : d.name, date, id, deload ? 1 : 0).lastInsertRowid);
          replaceWorkoutContent(db, wid, d.exercises.map(e => ({
            exerciseId: e.exerciseId,
            targetSets: deload ? Math.max(1, Math.ceil(e.sets * 0.6)) : e.sets,
            repsMin: e.repsMin, repsMax: e.repsMax,
            rir: deload ? Math.min(5, e.rir + 2) : e.rir,
            restSec: e.restSec,
          })));
          created++;
        });
      }
    })();
    res.status(201).json({ created });
  });

  /** Lance tout de suite une séance du programme, sans passer par le planning. */
  r.post('/programs/:id/days/:dayId/start', (req, res) => {
    const uid = userId(res);
    const id = parse(zId, req.params.id), dayId = parse(zId, req.params.dayId);
    const b = parse(z.object({ date: zDate }), req.body);
    const day = loadProgram(db, uid, id).days.find(d => d.id === dayId);
    if (!day) throw new HttpError(404, 'Séance du programme introuvable.');
    const wid = db.transaction(() => {
      const wid = Number(db.prepare(`INSERT INTO workouts (user_id, name, date, status, program_id) VALUES (?, ?, ?, 'planned', ?)`)
        .run(uid, day.name, b.date, id).lastInsertRowid);
      replaceWorkoutContent(db, wid, day.exercises.map(e => ({
        exerciseId: e.exerciseId, targetSets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax, rir: e.rir, restSec: e.restSec,
      })));
      return wid;
    })();
    res.status(201).json(loadWorkout(db, uid, wid)); // le client enchaîne sur /workouts/:id/start
  });

  return r;
}
