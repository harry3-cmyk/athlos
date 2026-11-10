/** Calculs purs (sans accès base) : 1RM estimé, tendances, composition corporelle. */

/** Au-delà de 12 reps, les formules de 1RM deviennent trop imprécises pour comparer des performances. */
export const E1RM_MAX_REPS = 12;

/** 1RM estimé — formule d'Epley : poids × (1 + reps/30). Une rep = le poids lui-même. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, E1RM_MAX_REPS) / 30);
}

export function round(n: number, step = 0.1): number {
  return Math.round(n / step) * step;
}
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Arrondi à la charge réellement chargeable (2,5 kg par défaut). */
export function roundLoad(kg: number, step = 2.5): number {
  return Math.max(0, Math.round(kg / step) * step);
}

/** Régression linéaire simple. Retourne pente et ordonnée ; pente = 0 si moins de 2 points. */
export function linreg(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
/** Lundi de la semaine ISO contenant `date`. */
export function weekStart(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lundi
  return addDays(date, -dow);
}

/**
 * % de masse grasse — méthode des circonférences de l'US Navy (Hodgdon & Beckett, 1984).
 * Estimation de terrain : erreur typique de l'ordre de 3 à 4 points. Mesures en cm.
 */
export function navyBodyFat(p: {
  sex: 'male' | 'female'; heightCm: number; waistCm: number; neckCm: number; hipCm?: number | null;
}): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = p;
  if (!(heightCm > 0 && waistCm > 0 && neckCm > 0)) return null;
  let bf: number;
  if (sex === 'male') {
    if (waistCm - neckCm <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  }
  if (!Number.isFinite(bf) || bf < 2 || bf > 60) return null;
  return round1(bf);
}

/** Tendance de poids : moyenne mobile exponentielle (lisse les variations d'eau quotidiennes). */
export function ema(values: number[], alpha = 0.25): number[] {
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : alpha * v + (1 - alpha) * out[i - 1]));
  return out;
}

export interface SetLike { weight: number; reps: number }

/**
 * Double progression : on monte les reps dans la fourchette, puis la charge.
 * Si toutes les séries de la dernière séance atteignent le haut de fourchette → charge +2,5 % (min. un palier).
 */
export function suggestNext(
  last: SetLike[], repsMin: number, repsMax: number, opts: { step?: number; deload?: boolean } = {},
): { weight: number; reps: number; reason: string } | null {
  const work = last.filter(s => s.reps > 0);
  if (!work.length) return null;
  const step = opts.step ?? 2.5;
  const top = work.reduce((a, b) => (b.weight > a.weight ? b : a));
  if (opts.deload) {
    return { weight: roundLoad(top.weight * 0.9, step), reps: repsMin, reason: 'Semaine de décharge : charge −10 %, loin de l’échec.' };
  }
  const atTop = work.filter(s => s.weight >= top.weight);
  if (top.weight > 0 && atTop.every(s => s.reps >= repsMax)) {
    const next = Math.max(top.weight + step, roundLoad(top.weight * 1.025, step));
    return { weight: next, reps: repsMin, reason: `Haut de fourchette atteint partout : +${round1(next - top.weight)} kg.` };
  }
  const minReps = Math.min(...atTop.map(s => s.reps));
  return {
    weight: top.weight,
    reps: Math.min(repsMax, Math.max(repsMin, minReps + 1)),
    reason: 'Même charge, vise une répétition de plus.',
  };
}
