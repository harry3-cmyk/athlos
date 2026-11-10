/** Client HTTP + types partagés avec l'API. */

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Mode « sur l'appareil » (build GitHub Pages) : l'API tourne dans le navigateur, sans serveur ni compte. */
export const LOCAL = import.meta.env.VITE_LOCAL === '1';

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  if (LOCAL) {
    const { localApi } = await import('../local/backend');
    try { return (await localApi(method, url, body)) as T; }
    catch (e: any) { throw new ApiError(e.status ?? 500, e.message ?? 'Erreur'); }
  }
  let res: Response;
  try {
    res = await fetch('/api' + url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'forge' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Connexion au serveur impossible. Vérifie ton réseau.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event('forge:unauthorized'));
    throw new ApiError(res.status, data.error ?? `Erreur ${res.status}`);
  }
  return data as T;
}

export type Goal = 'strength' | 'hypertrophy' | 'powerbuilding' | 'athletic' | 'tactical' | 'fat_loss' | 'general';
/** Groupe d'un exercice : un muscle, ou « cardio » (distance en km dans weight, durée en minutes dans reps). */
export type Group = Muscle | 'cardio';
export type Muscle = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs';
export type Status = 'planned' | 'in_progress' | 'done';

export interface User { id: number; email: string; name: string; sex: 'male' | 'female' | null; heightCm: number | null; birthYear: number | null; goal: Goal }
export interface Exercise { id: number; name: string; muscle: Group; equipment: string; pattern: string; compound: boolean; custom: boolean }
export interface SetRow { weight: number; reps: number; rpe: number | null; warmup: boolean; done: boolean }
export interface WorkoutExercise {
  exerciseId: number; name: string; muscle: Group; equipment: string;
  targetSets: number | null; repsMin: number | null; repsMax: number | null; rir: number | null; restSec: number | null;
  notes: string; sets: SetRow[];
  previous: { date: string; sets: { weight: number; reps: number; rpe: number | null }[] } | null;
  suggestion: { weight: number; reps: number; reason: string } | null;
}
export interface Workout {
  id: number; name: string; date: string; status: Status; startedAt: string | null; finishedAt: string | null;
  notes: string; programId: number | null; deload: boolean; exercises: WorkoutExercise[];
}
export interface WorkoutSummary {
  id: number; name: string; date: string; status: Status; deload: boolean; programId: number | null;
  exerciseCount: number; setCount: number; volume: number; minutes: number | null;
}
export interface PrEvent { date: string; workoutId: number; exerciseId: number; name: string; type: 'e1rm' | 'weight' | 'reps'; value: number; previous: number; weight: number; reps: number }

export interface GenConfig { goal: Goal; days: number; level: 'beginner' | 'intermediate' | 'advanced'; equipment: 'gym' | 'dumbbells' | 'bodyweight'; minutes: number; priorities: Muscle[] }
export interface ProgramExercise { id?: number; exerciseId: number; name: string; muscle: Group; pattern?: string; role: string; sets: number; repsMin: number; repsMax: number; rir: number; restSec: number }
export interface ProgramDay { id?: number; name: string; focus: string; estMinutes: number; exercises: ProgramExercise[] }
export interface Program {
  id?: number; name: string; goal: Goal; config: GenConfig; days: ProgramDay[];
  weeklySets: { muscle: Muscle; sets: number; frequency: number }[];
  rationale: { summary: string; split: string; principles: { title: string; text: string; source: string }[]; warnings: string[] };
}
export interface ProgramSummary { id: number; name: string; goal: Goal; createdAt: string; days: number; planned: number }

export interface BodyRow {
  id: number; date: string; weightKg: number | null; bodyFatPct: number | null; bodyFatEstimate: number | null;
  waistCm: number | null; neckCm: number | null; hipCm: number | null; chestCm: number | null; armCm: number | null; thighCm: number | null;
  notes: string; weightTrend: number | null; leanMassKg: number | null; fatMassKg: number | null;
}

export interface Finding { id: string; severity: 'high' | 'medium' | 'low' | 'good'; category: string; title: string; detail: string; action: string }
export interface Analysis {
  dataQuality: { sessions28: number; enough: boolean };
  muscles: { muscle: Muscle; weeklySets: number; frequency: number; floor: number }[];
  balance: { label: string; a: string; b: string; aSets: number; bSets: number; ratio: number | null }[];
  ratios: { label: string; value: number; low: number; high: number; a: number; b: number }[];
  trends: { exerciseId: number; name: string; sessions: number; pctPerWeek: number; best: number }[];
  consistency: { perWeek: number; adherence: number | null };
  cardio: { minutesPerWeek: number; sessionsPerWeek: number; kmPerWeek: number };
  weightTrend: { pctPerWeek: number; kgPerWeek: number } | null;
  findings: Finding[];
}
export interface Dashboard {
  today: string;
  kpis: {
    sessionsThisWeek: number; sessions28: number; volumeThisWeek: number; volumeLastWeek: number; streakWeeks: number; totalWorkouts: number;
    weight: { value: number; trend: number | null; date: string; delta28: number | null } | null;
  };
  weekly: { week: string; volume: number; sets: number; sessions: number }[];
  current: { id: number; name: string; date: string } | null;
  planned: { id: number; name: string; date: string; deload: boolean }[];
  records: PrEvent[];
  muscles: Analysis['muscles'];
  findings: Finding[];
  weightSeries: { date: string; weight: number; trend: number | null }[];
}
export interface CardioHistory { cardio: true; sessions: { workoutId: number; date: string; km: number; minutes: number }[] }
export interface ExerciseHistory {
  cardio?: false;
  sessions: { workoutId: number; date: string; e1rm: number; topWeight: number; topReps: number; volume: number; sets: { weight: number; reps: number; rpe: number | null }[] }[];
  records: { e1rm: { value: number; date: string }; weight: { value: number; reps: number; date: string }; volume: { value: number; date: string } } | null;
}
export interface RecordRow { exerciseId: number; name: string; muscle: Muscle; e1rm: number; e1rmDate: string; weight: number; reps: number; weightDate: string; maxReps: number; sessions: number; lastDate: string }
