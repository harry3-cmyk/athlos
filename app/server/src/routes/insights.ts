import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../schema.js';
import { analyze } from '../domain/analysis.js';
import type { Goal } from '../domain/generator.js';
import { addDays, ema, navyBodyFat, round1, weekStart } from '../domain/metrics.js';
import { parse, todayOr, userId, zDate, zId } from '../http.js';
import { prEvents, workSets } from '../queries.js';

const num = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();
const zBody = z.object({
  date: zDate,
  weightKg: num(20, 400), bodyFatPct: num(2, 70),
  waistCm: num(30, 250), neckCm: num(15, 80), hipCm: num(40, 250),
  chestCm: num(40, 250), armCm: num(10, 80), thighCm: num(20, 120),
  notes: z.string().max(500).optional(),
});

function bodyRows(db: DB, uid: number) {
  const user = db.prepare('SELECT sex, height_cm FROM users WHERE id = ?').get(uid) as any;
  const rows = db.prepare('SELECT * FROM body_metrics WHERE user_id = ? ORDER BY date').all(uid) as any[];
  const withW = rows.filter(r => r.weight_kg != null);
  const trend = ema(withW.map(r => r.weight_kg));
  const trendById = new Map(withW.map((r, i) => [r.id, round1(trend[i])]));
  return rows.map(r => {
    // Estimation par circonférences si aucune mesure directe n'est saisie.
    const estimate = r.body_fat_pct == null && user.sex && user.height_cm && r.waist_cm && r.neck_cm
      ? navyBodyFat({ sex: user.sex, heightCm: user.height_cm, waistCm: r.waist_cm, neckCm: r.neck_cm, hipCm: r.hip_cm })
      : null;
    const bf = r.body_fat_pct ?? estimate;
    return {
      id: r.id, date: r.date, weightKg: r.weight_kg, bodyFatPct: r.body_fat_pct, bodyFatEstimate: estimate,
      waistCm: r.waist_cm, neckCm: r.neck_cm, hipCm: r.hip_cm, chestCm: r.chest_cm, armCm: r.arm_cm, thighCm: r.thigh_cm,
      notes: r.notes,
      weightTrend: trendById.get(r.id) ?? null,
      leanMassKg: r.weight_kg != null && bf != null ? round1(r.weight_kg * (1 - bf / 100)) : null,
      fatMassKg: r.weight_kg != null && bf != null ? round1(r.weight_kg * (bf / 100)) : null,
    };
  });
}

function runAnalysis(db: DB, uid: number, today: string) {
  const user = db.prepare('SELECT goal FROM users WHERE id = ?').get(uid) as { goal: Goal };
  const missed = db.prepare(`SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND status = 'planned' AND date < ? AND date >= ?`)
    .get(uid, today, addDays(today, -27)) as { n: number };
  const weights = db.prepare(`SELECT date, weight_kg AS weight FROM body_metrics
    WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date`).all(uid) as { date: string; weight: number }[];
  const lastProgram = db.prepare('SELECT config FROM programs WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(uid) as { config: string } | undefined;
  return analyze({
    today, goal: user.goal, level: lastProgram ? JSON.parse(lastProgram.config).level : undefined, sets: workSets(db, uid, { from: addDays(today, -83) }), missedPlanned: missed.n, weights,
  });
}

export function insightsRouter(db: DB) {
  const r = Router();

  // — Poids et composition corporelle
  r.get('/body', (_req, res) => res.json(bodyRows(db, userId(res))));

  r.post('/body', (req, res) => {
    const b = parse(zBody, req.body);
    db.prepare(`
      INSERT INTO body_metrics (user_id, date, weight_kg, body_fat_pct, waist_cm, neck_cm, hip_cm, chest_cm, arm_cm, thigh_cm, notes)
      VALUES (@uid, @date, @weightKg, @bodyFatPct, @waistCm, @neckCm, @hipCm, @chestCm, @armCm, @thighCm, @notes)
      ON CONFLICT(user_id, date) DO UPDATE SET
        weight_kg = excluded.weight_kg, body_fat_pct = excluded.body_fat_pct, waist_cm = excluded.waist_cm,
        neck_cm = excluded.neck_cm, hip_cm = excluded.hip_cm, chest_cm = excluded.chest_cm, arm_cm = excluded.arm_cm,
        thigh_cm = excluded.thigh_cm, notes = excluded.notes`).run({
      uid: userId(res), date: b.date, weightKg: b.weightKg ?? null, bodyFatPct: b.bodyFatPct ?? null,
      waistCm: b.waistCm ?? null, neckCm: b.neckCm ?? null, hipCm: b.hipCm ?? null, chestCm: b.chestCm ?? null,
      armCm: b.armCm ?? null, thighCm: b.thighCm ?? null, notes: b.notes ?? '',
    });
    res.status(201).json(bodyRows(db, userId(res)));
  });

  r.delete('/body/:id', (req, res) => {
    db.prepare('DELETE FROM body_metrics WHERE id = ? AND user_id = ?').run(parse(zId, req.params.id), userId(res));
    res.json(bodyRows(db, userId(res)));
  });

  // — Analyse des points faibles
  r.get('/analysis', (req, res) => res.json(runAnalysis(db, userId(res), todayOr(req.query.today))));

  // — Tableau de bord
  r.get('/dashboard', (req, res) => {
    const uid = userId(res);
    const today = todayOr(req.query.today);
    const thisWeek = weekStart(today);
    const all = workSets(db, uid);

    // 12 dernières semaines : volume (kg), séries, séances.
    const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, (i - 11) * 7));
    const agg = new Map(weeks.map(w => [w, { week: w, volume: 0, sets: 0, workouts: new Set<number>() }]));
    for (const s of all) {
      const a = agg.get(weekStart(s.date));
      if (a) { a.volume += s.weight * s.reps; a.sets++; a.workouts.add(s.workoutId); }
    }
    const weekly = [...agg.values()].map(a => ({ week: a.week, volume: Math.round(a.volume), sets: a.sets, sessions: a.workouts.size }));

    // Série de semaines consécutives avec au moins une séance (la semaine en cours ne casse pas la série).
    const activeWeeks = new Set(all.map(s => weekStart(s.date)));
    let streak = 0;
    for (let w = activeWeeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7); activeWeeks.has(w); w = addDays(w, -7)) streak++;

    const body = bodyRows(db, uid).filter(b => b.weightKg != null);
    const last = body[body.length - 1];
    const ref = body.filter(b => b.date <= addDays(today, -28)).pop();
    const analysis = runAnalysis(db, uid, today);
    const planned = db.prepare(`SELECT id, name, date, deload FROM workouts
      WHERE user_id = ? AND status = 'planned' AND date >= ? ORDER BY date, id LIMIT 3`).all(uid, today) as any[];
    const current = db.prepare(`SELECT id, name, date FROM workouts WHERE user_id = ? AND status = 'in_progress'
      ORDER BY date DESC, id DESC LIMIT 1`).get(uid);

    res.json({
      today,
      kpis: {
        sessionsThisWeek: weekly[11].sessions,
        sessions28: analysis.dataQuality.sessions28,
        volumeThisWeek: weekly[11].volume,
        volumeLastWeek: weekly[10].volume,
        streakWeeks: streak,
        weight: last ? { value: last.weightKg, trend: last.weightTrend, date: last.date,
          delta28: ref && last.weightTrend != null && ref.weightTrend != null ? round1(last.weightTrend - ref.weightTrend) : null } : null,
        totalWorkouts: new Set(all.map(s => s.workoutId)).size,
      },
      weekly,
      current: current ?? null,
      planned: planned.map(p => ({ ...p, deload: !!p.deload })),
      records: prEvents(all).filter(e => e.date >= addDays(today, -30)).reverse().slice(0, 6),
      muscles: analysis.muscles,
      findings: analysis.findings.filter(f => f.severity !== 'good').slice(0, 3),
      weightSeries: body.filter(b => b.date >= addDays(today, -90)).map(b => ({ date: b.date, weight: b.weightKg, trend: b.weightTrend })),
    });
  });

  return r;
}
