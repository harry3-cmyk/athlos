import { CARDIO, MUSCLES, type Equipment, type ExerciseGroup, type Muscle, type Pattern } from './exercises.seed.js';

/**
 * Générateur de programmes.
 *
 * Parti pris : on n'imite PAS la routine d'un champion (elle dépend de sa génétique, de son ancienneté,
 * de sa récupération). On applique les principes que leurs entraîneurs et la recherche partagent :
 * volume hebdomadaire par muscle, fréquence, intensité relative (RIR), progression, décharge.
 * Chaque règle chiffrée est rattachée à une source dans `PRINCIPLES`.
 */

export const GOALS = ['strength', 'hypertrophy', 'powerbuilding', 'athletic', 'tactical', 'fat_loss', 'general'] as const;
export type Goal = (typeof GOALS)[number];
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentProfile = 'gym' | 'dumbbells' | 'bodyweight';
// power = explosif ; endurance = séries longues ; carry = portés ; cardio = durée en minutes.
export type Role = 'main' | 'secondary' | 'accessory' | 'power' | 'endurance' | 'carry' | 'cardio';
type StrengthRole = 'main' | 'secondary' | 'accessory';

export interface GenConfig {
  goal: Goal;
  days: number; // 2..6
  level: Level;
  equipment: EquipmentProfile;
  minutes: number; // durée cible par séance
  priorities: Muscle[];
}

export interface CatalogExercise {
  id: number;
  name: string;
  muscle: ExerciseGroup;
  secondary: Muscle[];
  equipment: Equipment;
  pattern: Pattern;
  compound: boolean;
}

export interface PlannedExercise {
  exerciseId: number;
  name: string;
  muscle: ExerciseGroup;
  role: Role;
  sets: number;
  repsMin: number;
  repsMax: number;
  rir: number;
  restSec: number;
}
export interface PlannedDay { name: string; focus: string; estMinutes: number; exercises: PlannedExercise[] }
export interface Principle { title: string; text: string; source: string }
export interface GeneratedProgram {
  name: string;
  goal: Goal;
  config: GenConfig;
  days: PlannedDay[];
  weeklySets: { muscle: Muscle; sets: number; frequency: number }[];
  rationale: { summary: string; split: string; principles: Principle[]; warnings: string[] };
}

type Slot = [Pattern, Role, number?]; // [schéma moteur, rôle, variante préférée]
interface DayTemplate { name: string; focus: string; slots: Slot[] }

const FULL_A: DayTemplate = { name: 'Corps entier A', focus: 'Squat · poussée horizontale', slots: [
  ['squat', 'main'], ['h_push', 'main'], ['h_pull', 'secondary'], ['hinge', 'secondary', 1],
  ['lateral_raise', 'accessory'], ['curl', 'accessory'], ['core', 'accessory'] ] };
const FULL_B: DayTemplate = { name: 'Corps entier B', focus: 'Charnière · poussée verticale', slots: [
  ['hinge', 'main'], ['v_push', 'main'], ['v_pull', 'secondary'], ['lunge', 'secondary'],
  ['incline_push', 'secondary'], ['tri_ext', 'accessory'], ['calf', 'accessory'] ] };
const FULL_C: DayTemplate = { name: 'Corps entier C', focus: 'Variantes · chaîne postérieure', slots: [
  ['squat', 'main', 1], ['incline_push', 'main'], ['h_pull', 'secondary', 1], ['hip_thrust', 'secondary'],
  ['v_pull', 'secondary', 1], ['rear_delt', 'accessory'], ['knee_flex', 'accessory'] ] };
const UPPER_A: DayTemplate = { name: 'Haut du corps A', focus: 'Dominante horizontale', slots: [
  ['h_push', 'main'], ['h_pull', 'main'], ['v_push', 'secondary', 1], ['v_pull', 'secondary', 1],
  ['lateral_raise', 'accessory'], ['tri_ext', 'accessory'], ['curl', 'accessory'] ] };
const UPPER_B: DayTemplate = { name: 'Haut du corps B', focus: 'Dominante verticale', slots: [
  ['v_push', 'main'], ['v_pull', 'main'], ['incline_push', 'secondary'], ['h_pull', 'secondary', 1],
  ['chest_fly', 'accessory'], ['rear_delt', 'accessory'], ['curl', 'accessory', 1], ['tri_ext', 'accessory', 1] ] };
const LOWER_A: DayTemplate = { name: 'Bas du corps A', focus: 'Dominante squat', slots: [
  ['squat', 'main'], ['hinge', 'secondary', 1], ['lunge', 'secondary'], ['knee_flex', 'accessory'],
  ['calf', 'accessory'], ['core', 'accessory'] ] };
const LOWER_B: DayTemplate = { name: 'Bas du corps B', focus: 'Dominante charnière', slots: [
  ['hinge', 'main'], ['squat', 'secondary', 2], ['hip_thrust', 'secondary'], ['knee_ext', 'accessory'],
  ['calf', 'accessory', 1], ['core', 'accessory', 1] ] };
const PUSH_A: DayTemplate = { name: 'Poussée A', focus: 'Pectoraux · épaules · triceps', slots: [
  ['h_push', 'main'], ['v_push', 'secondary', 1], ['incline_push', 'secondary'], ['lateral_raise', 'accessory'],
  ['tri_ext', 'accessory'], ['chest_fly', 'accessory'] ] };
const PUSH_B: DayTemplate = { name: 'Poussée B', focus: 'Épaules · pectoraux · triceps', slots: [
  ['v_push', 'main'], ['incline_push', 'secondary', 1], ['h_push', 'secondary', 2], ['lateral_raise', 'accessory', 1],
  ['tri_ext', 'accessory', 1], ['chest_fly', 'accessory', 1] ] };
const PULL_A: DayTemplate = { name: 'Tirage A', focus: 'Dos · biceps', slots: [
  ['v_pull', 'main'], ['h_pull', 'secondary'], ['v_pull', 'secondary', 1], ['rear_delt', 'accessory'],
  ['curl', 'accessory'], ['curl', 'accessory', 3] ] };
const PULL_B: DayTemplate = { name: 'Tirage B', focus: 'Dos · arrière d’épaules · biceps', slots: [
  ['h_pull', 'main', 1], ['v_pull', 'secondary', 3], ['h_pull', 'secondary', 2], ['rear_delt', 'accessory', 1],
  ['curl', 'accessory', 1], ['core', 'accessory'] ] };
const LEGS_A: DayTemplate = { name: 'Jambes A', focus: 'Quadriceps · ischios · mollets', slots: [
  ['squat', 'main'], ['hinge', 'secondary', 1], ['lunge', 'secondary'], ['knee_flex', 'accessory'],
  ['knee_ext', 'accessory'], ['calf', 'accessory'] ] };
const LEGS_B: DayTemplate = { name: 'Jambes B', focus: 'Chaîne postérieure · fessiers', slots: [
  ['hinge', 'main'], ['squat', 'secondary', 2], ['hip_thrust', 'secondary'], ['knee_flex', 'accessory', 1],
  ['calf', 'accessory', 1], ['core', 'accessory', 1] ] };

// — Athlétique : puissance d'abord (frais), force ensuite, unilatéral, portés, conditionnement.
const FINISHER: Slot = ['short_intervals', 'cardio'];
const ATH_A: DayTemplate = { name: 'Puissance et force — bas du corps', focus: 'Sauts · squat · portés', slots: [
  ['power_lower', 'power'], ['squat', 'main'], ['hinge', 'secondary', 1], ['lunge', 'secondary'],
  ['carry', 'carry'], ['core', 'accessory'] ] };
const ATH_B: DayTemplate = { name: 'Puissance et force — haut du corps', focus: 'Lancers · poussée · tirage', slots: [
  ['power_upper', 'power'], ['h_push', 'main'], ['v_pull', 'main'], ['v_push', 'secondary', 1],
  ['h_pull', 'secondary', 1], ['core', 'accessory', 1] ] };
const ATH_C: DayTemplate = { name: 'Corps entier athlétique', focus: 'Charnière explosive · unilatéral', slots: [
  ['power_lower', 'power', 1], ['hinge', 'main'], ['incline_push', 'secondary'], ['h_pull', 'secondary'],
  ['lunge', 'secondary', 1], ['carry', 'carry', 1] ] };
const COND_INT: DayTemplate = { name: 'Conditionnement — intervalles', focus: 'Puissance aérobie (VO2max)', slots: [
  ['intervals', 'cardio'], ['core', 'accessory'], ['carry', 'carry'] ] };
const COND_Z2: DayTemplate = { name: 'Endurance fondamentale', focus: 'Base aérobie, allure où l’on peut parler', slots: [
  ['zone2', 'cardio'], ['core', 'accessory', 1] ] };

// — Opérateur : force sous-maximale + endurance musculaire + base aérobie + marche chargée.
const TAC_S1: DayTemplate = { name: 'Force A', focus: 'Squat · développé · tractions · portés', slots: [
  ['squat', 'main'], ['h_push', 'main'], ['v_pull', 'main'], ['carry', 'carry'], ['core', 'accessory'] ] };
const TAC_S2: DayTemplate = { name: 'Force B', focus: 'Soulevé de terre · poussée verticale · pompes', slots: [
  ['hinge', 'main'], ['v_push', 'main'], ['h_pull', 'secondary'], ['lunge', 'secondary'],
  ['endurance_push', 'endurance'], ['core', 'accessory', 1] ] };
const TAC_S3: DayTemplate = { name: 'Force C — endurance musculaire', focus: 'Tractions · pompes · unilatéral', slots: [
  ['squat', 'secondary', 1], ['v_pull', 'secondary', 2], ['endurance_push', 'endurance'], ['hinge', 'secondary', 1],
  ['carry', 'carry', 1], ['core', 'accessory'] ] };
const TAC_INT: DayTemplate = { name: 'Intervalles', focus: 'Puissance aérobie (VO2max)', slots: [
  ['intervals', 'cardio'], ['endurance_push', 'endurance'], ['core', 'accessory'] ] };
const TAC_RUCK: DayTemplate = { name: 'Marche chargée', focus: 'Portage de charge, allure soutenue', slots: [['ruck', 'cardio']] };
const withFinisher = (t: DayTemplate): DayTemplate => ({ ...t, slots: [...t.slots, FINISHER] });

type Split = { label: string; days: DayTemplate[] };
const SPLITS: Record<number, Split> = {
  2: { label: 'Corps entier 2×/semaine', days: [FULL_A, FULL_B] },
  3: { label: 'Corps entier 3×/semaine', days: [FULL_A, FULL_B, FULL_C] },
  4: { label: 'Haut / Bas 2×/semaine', days: [UPPER_A, LOWER_A, UPPER_B, LOWER_B] },
  5: { label: 'Haut / Bas + Poussée / Tirage / Jambes', days: [UPPER_A, LOWER_A, PUSH_A, PULL_A, LEGS_B] },
  6: { label: 'Poussée / Tirage / Jambes 2×/semaine', days: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B] },
};
const ATHLETIC_SPLITS: Record<number, Split> = {
  2: { label: '2 séances puissance-force avec conditionnement en fin de séance', days: [withFinisher(ATH_A), withFinisher(ATH_B)] },
  3: { label: '3 séances puissance-force, conditionnement intégré', days: [ATH_A, ATH_B, withFinisher(ATH_C)] },
  4: { label: '3 séances puissance-force + 1 conditionnement', days: [ATH_A, ATH_B, COND_INT, ATH_C] },
  5: { label: '3 séances puissance-force + 2 conditionnements', days: [ATH_A, ATH_B, COND_INT, ATH_C, COND_Z2] },
  6: { label: '4 séances puissance-force + 2 conditionnements', days: [ATH_A, ATH_B, COND_INT, ATH_C, UPPER_B, COND_Z2] },
};
const TACTICAL_SPLITS: Record<number, Split> = {
  2: { label: '2 séances de force avec conditionnement en fin de séance', days: [withFinisher(TAC_S1), withFinisher(TAC_S2)] },
  3: { label: '2 séances de force + 1 séance d’intervalles', days: [TAC_S1, TAC_INT, TAC_S2] },
  4: { label: '2 force + endurance fondamentale + intervalles', days: [TAC_S1, COND_Z2, TAC_S2, TAC_INT] },
  5: { label: '2 force + endurance + intervalles + marche chargée', days: [TAC_S1, COND_Z2, TAC_S2, TAC_INT, TAC_RUCK] },
  6: { label: '3 force + endurance + intervalles + marche chargée', days: [TAC_S1, COND_Z2, TAC_S2, TAC_INT, TAC_S3, TAC_RUCK] },
};
const splitFor = (goal: Goal, days: number): Split =>
  (goal === 'athletic' ? ATHLETIC_SPLITS : goal === 'tactical' ? TACTICAL_SPLITS : SPLITS)[days];

// Sans le matériel voulu, on se rabat sur un schéma voisin plutôt que de vider la séance.
const FALLBACK: Partial<Record<Pattern, Pattern>> = { ruck: 'zone2', power_upper: 'h_push', carry: 'core' };

type Rx = { sets: number; repsMin: number; repsMax: number; rir: number; restSec: number };
const PRESCRIPTIONS: Record<Goal, Record<StrengthRole, Rx>> = {
  strength: {
    main: { sets: 4, repsMin: 3, repsMax: 5, rir: 2, restSec: 210 },
    secondary: { sets: 3, repsMin: 5, repsMax: 8, rir: 2, restSec: 150 },
    accessory: { sets: 3, repsMin: 8, repsMax: 12, rir: 1, restSec: 90 },
  },
  hypertrophy: {
    main: { sets: 3, repsMin: 6, repsMax: 10, rir: 2, restSec: 150 },
    secondary: { sets: 3, repsMin: 8, repsMax: 12, rir: 1, restSec: 120 },
    accessory: { sets: 3, repsMin: 10, repsMax: 15, rir: 1, restSec: 75 },
  },
  fat_loss: {
    main: { sets: 3, repsMin: 5, repsMax: 8, rir: 2, restSec: 150 },
    secondary: { sets: 2, repsMin: 8, repsMax: 12, rir: 2, restSec: 120 },
    accessory: { sets: 2, repsMin: 10, repsMax: 15, rir: 1, restSec: 75 },
  },
  powerbuilding: {
    main: { sets: 4, repsMin: 3, repsMax: 6, rir: 2, restSec: 180 },
    secondary: { sets: 3, repsMin: 6, repsMax: 10, rir: 2, restSec: 120 },
    accessory: { sets: 3, repsMin: 10, repsMax: 15, rir: 1, restSec: 75 },
  },
  athletic: {
    main: { sets: 4, repsMin: 3, repsMax: 6, rir: 2, restSec: 180 },
    secondary: { sets: 3, repsMin: 6, repsMax: 10, rir: 2, restSec: 120 },
    accessory: { sets: 2, repsMin: 10, repsMax: 15, rir: 2, restSec: 60 },
  },
  tactical: {
    main: { sets: 4, repsMin: 3, repsMax: 5, rir: 3, restSec: 180 },
    secondary: { sets: 3, repsMin: 6, repsMax: 10, rir: 2, restSec: 120 },
    accessory: { sets: 2, repsMin: 10, repsMax: 15, rir: 2, restSec: 60 },
  },
  general: {
    main: { sets: 3, repsMin: 6, repsMax: 10, rir: 3, restSec: 120 },
    secondary: { sets: 2, repsMin: 8, repsMax: 12, rir: 2, restSec: 90 },
    accessory: { sets: 2, repsMin: 10, repsMax: 15, rir: 2, restSec: 60 },
  },
};

const ALLOWED: Record<EquipmentProfile, Equipment[]> = {
  gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'],
  dumbbells: ['dumbbell', 'bodyweight', 'other'],
  bodyweight: ['bodyweight'],
};

export const GOAL_LABEL: Record<Goal, string> = {
  strength: 'Force', hypertrophy: 'Hypertrophie', powerbuilding: 'Force + hypertrophie', athletic: 'Athlétique',
  tactical: 'Opérateur', fat_loss: 'Perte de gras', general: 'Forme générale',
};

/** Repère de volume hebdomadaire (séries/muscle) en dessous duquel on signale un déficit. */
export function volumeFloor(goal: Goal, level?: Level): number {
  // Les débutants progressent avec nettement moins de volume : repère abaissé.
  return (goal === 'hypertrophy' || goal === 'powerbuilding') && level !== 'beginner' ? 10 : 6;
}

const SEC_PER_SET = 45; // temps d'exécution moyen d'une série
const WARMUP_MIN = 8;

/** Durée estimée : échauffement + séries (exécution + repos) ; pour le cardio, les répétitions sont des minutes. */
export function estimateMinutes(exs: { sets: number; restSec: number; repsMax: number; muscle: string }[]): number {
  const sec = exs.reduce((s, e) => s + e.sets * (e.restSec + (e.muscle === CARDIO ? e.repsMax * 60 : SEC_PER_SET)), 0);
  return Math.round(WARMUP_MIN + sec / 60);
}

const MINOR: Muscle[] = ['abs', 'calves'];
const MAX_SETS = 5; // au-delà, mieux vaut un second exercice qu'une 6ᵉ série

/** Volume hebdomadaire : muscle principal = 1 série, secondaire = 0,5 série. Le cardio n'entre pas dans ce décompte. */
export function weeklyVolume(days: { exercises: { muscle: string; secondary: Muscle[]; sets: number }[] }[]) {
  const sets = new Map<Muscle, number>(MUSCLES.map(m => [m, 0]));
  const freq = new Map<Muscle, number>(MUSCLES.map(m => [m, 0]));
  for (const d of days) {
    const hit = new Set<Muscle>();
    for (const e of d.exercises) {
      if (e.muscle === CARDIO) continue;
      const m = e.muscle as Muscle;
      sets.set(m, sets.get(m)! + e.sets);
      hit.add(m);
      for (const s of e.secondary) { sets.set(s, sets.get(s)! + e.sets * 0.5); hit.add(s); }
    }
    hit.forEach(m => freq.set(m, freq.get(m)! + 1));
  }
  return MUSCLES.map(m => ({ muscle: m, sets: sets.get(m)!, frequency: freq.get(m)! }));
}

function prescribe(cfg: GenConfig, role: Role, ex: CatalogExercise): Rx {
  const beginner = cfg.level === 'beginner';
  if (role === 'cardio') {
    switch (ex.pattern) {
      case 'intervals': return { sets: beginner ? 3 : 4, repsMin: 4, repsMax: 4, rir: 0, restSec: 180 };
      case 'short_intervals': return { sets: beginner || cfg.minutes <= 45 ? 5 : 8, repsMin: 1, repsMax: 1, rir: 0, restSec: 60 };
      case 'ruck': { const d = cfg.minutes >= 60 ? 60 : 45; return { sets: 1, repsMin: d - 15, repsMax: d, rir: 0, restSec: 0 }; }
      default: { const d = Math.max(20, Math.min(60, cfg.minutes - 15)); return { sets: 1, repsMin: Math.max(20, d - 10), repsMax: d, rir: 0, restSec: 0 }; }
    }
  }
  if (role === 'power') return { sets: beginner ? 3 : 4, repsMin: 3, repsMax: 5, rir: 3, restSec: 120 };
  if (role === 'carry') return { sets: 3, repsMin: 30, repsMax: 40, rir: 2, restSec: 90 };
  if (role === 'endurance') return { sets: 3, repsMin: 12, repsMax: 20, rir: 2, restSec: 60 };
  const rx = { ...PRESCRIPTIONS[cfg.goal][role] };
  if (beginner) {
    rx.sets = Math.max(2, rx.sets - 1);
    rx.rir = Math.min(4, rx.rir + 1);
  } else if (cfg.level === 'advanced' && role !== 'accessory') {
    rx.sets += 1;
  }
  // Charge non réglable au poids du corps : on progresse par les répétitions, fourchettes plus larges.
  if (ex.equipment === 'bodyweight' && cfg.equipment !== 'gym') {
    rx.repsMin = Math.max(rx.repsMin, role === 'accessory' ? 10 : 6);
    rx.repsMax = role === 'accessory' ? 20 : 15;
  }
  if (ex.muscle !== CARDIO && cfg.priorities.includes(ex.muscle)) rx.sets += 1;
  return rx;
}

export function generateProgram(cfg: GenConfig, catalog: CatalogExercise[]): GeneratedProgram {
  const days = Math.min(6, Math.max(2, Math.round(cfg.days)));
  const split = splitFor(cfg.goal, days);
  const allowed = new Set(ALLOWED[cfg.equipment]);
  const byPattern = new Map<Pattern, CatalogExercise[]>();
  for (const e of catalog) {
    if (!allowed.has(e.equipment)) continue;
    if (!byPattern.has(e.pattern)) byPattern.set(e.pattern, []);
    byPattern.get(e.pattern)!.push(e);
  }
  const warnings: string[] = [];
  const missing = new Set<Pattern>();

  const planned: PlannedDay[] = split.days.map(tpl => {
    const used = new Set<number>();
    let exercises: PlannedExercise[] = [];
    let name = tpl.name, focus = tpl.focus;
    for (const [pattern, role, variant = 0] of tpl.slots) {
      let candidates = byPattern.get(pattern) ?? [];
      if (!candidates.length) {
        missing.add(pattern);
        if (pattern === 'ruck') { name = 'Sortie longue'; focus = 'Endurance fondamentale, faute de sac lesté'; }
        candidates = byPattern.get(FALLBACK[pattern] ?? pattern) ?? [];
        if (!candidates.length) continue;
      }
      let pick: CatalogExercise | undefined;
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[(variant + i) % candidates.length];
        if (!used.has(c.id)) { pick = c; break; }
      }
      if (!pick) continue;
      used.add(pick.id);
      exercises.push({
        exerciseId: pick.id, name: pick.name, muscle: pick.muscle, role, ...prescribe(cfg, role, pick),
      });
    }
    // Respect de la durée : on retire d'abord les accessoires non prioritaires (en partant de la fin), jamais le cardio.
    const isPriority = (e: PlannedExercise) => e.muscle !== CARDIO && cfg.priorities.includes(e.muscle);
    while (estimateMinutes(exercises) > cfg.minutes + 5 && exercises.filter(e => e.role !== 'cardio').length > (exercises.some(e => e.role === 'cardio') ? 2 : 3)) {
      const removable = (pred: (e: PlannedExercise) => boolean) => exercises.map((e, i) => (pred(e) ? i : -1)).filter(i => i >= 0).pop();
      const idx = removable(e => e.role === 'accessory' && !isPriority(e)) ?? removable(e => e.role !== 'cardio' && e.role !== 'main' && e.role !== 'power')
        ?? removable(e => e.role !== 'cardio');
      if (idx === undefined) break;
      exercises = exercises.filter((_, i) => i !== idx);
    }
    return { name, focus, estMinutes: estimateMinutes(exercises), exercises };
  });

  const byId = new Map(catalog.map(e => [e.id, e]));
  // Équilibrage (hypertrophie, hors débutants) : tant qu'un grand groupe est sous le repère et que la durée le permet,
  // on ajoute une série à son exercice le moins chargé. Les débutants progressent avec moins de volume.
  const floor = volumeFloor(cfg.goal, cfg.level);
  const volumeOf = () => weeklyVolume(planned.map(d => ({
    exercises: d.exercises.map(e => ({ muscle: e.muscle, secondary: byId.get(e.exerciseId)!.secondary, sets: e.sets })),
  })));
  if ((cfg.goal === 'hypertrophy' || cfg.goal === 'powerbuilding') && cfg.level !== 'beginner') {
    const stuck = new Set<Muscle>();
    for (let guard = 0; guard < 60; guard++) {
      const target = volumeOf()
        .filter(v => !MINOR.includes(v.muscle) && !stuck.has(v.muscle) && v.sets < floor)
        .sort((a, b) => a.sets - b.sets)[0];
      if (!target) break;
      let best: PlannedExercise | null = null;
      for (const d of planned) {
        for (const e of d.exercises) {
          const fits = estimateMinutes(d.exercises) + (e.restSec + SEC_PER_SET) / 60 <= cfg.minutes + 5;
          if (e.muscle === target.muscle && e.sets < MAX_SETS && fits && (!best || e.sets < best.sets)) best = e;
        }
      }
      if (best) best.sets++; else stuck.add(target.muscle);
    }
    for (const d of planned) d.estMinutes = estimateMinutes(d.exercises);
  }
  const weeklySets = volumeOf();

  if (missing.size) {
    warnings.push('Certains mouvements n’ont pas d’équivalent avec ton matériel et ont été retirés (isolations surtout).');
  }
  const low = weeklySets.filter(w => w.sets < floor && !MINOR.includes(w.muscle));
  if ((cfg.goal === 'hypertrophy' || cfg.goal === 'powerbuilding') && cfg.level !== 'beginner' && low.length) {
    warnings.push(
      `Volume sous le repère de ${floor} séries/semaine pour certains muscles : ajoute une séance, allonge la durée, ou marque-les comme prioritaires.`);
  }
  if (cfg.equipment === 'bodyweight' && cfg.goal === 'strength') {
    warnings.push('Au poids du corps, la force maximale progresse surtout par des variantes plus difficiles (levier, unilatéral) : la surcharge est limitée.');
  }
  if (cfg.goal === 'tactical') {
    if (days < 4) warnings.push('Pour ce profil, 4 séances ou plus sont nécessaires pour développer à la fois la force et l’endurance : ici l’endurance est réduite au minimum.');
    if (days >= 5 && !missing.has('ruck')) warnings.push('Marche chargée : commence léger (environ 10 % de ton poids de corps) et n’augmente qu’un paramètre à la fois, la charge ou la distance. C’est la première cause de blessure dans ce type de préparation (repère de prudence).');
    warnings.push('Préparation générale : elle ne remplace pas l’entraînement aux épreuves précises d’une sélection (barèmes, distances, charges), à intégrer dans les 8 à 12 dernières semaines.');
  }
  if (cfg.goal === 'athletic' && cfg.equipment === 'bodyweight') {
    warnings.push('Sans charge externe, la force maximale plafonne vite : la puissance (sauts, pompes explosives) reste bien entraînable.');
  }
  if (cfg.level === 'beginner' && (cfg.goal === 'athletic' || cfg.goal === 'tactical')) {
    warnings.push('Débutant : apprends d’abord la réception des sauts et la technique des mouvements de base à charge légère avant de chercher la vitesse.');
  }
  if (cfg.level === 'beginner' && days >= 5) {
    warnings.push('5–6 séances par semaine pour un débutant est rarement nécessaire : 3–4 séances bien exécutées suffisent pour progresser.');
  }

  return {
    name: `${GOAL_LABEL[cfg.goal]} · ${days} j/sem`,
    goal: cfg.goal,
    config: { ...cfg, days },
    days: planned,
    weeklySets,
    rationale: {
      summary: summary(cfg, days),
      split: split.label,
      principles: principlesFor(cfg),
      warnings,
    },
  };
}

function summary(cfg: GenConfig, days: number): string {
  const base: Record<Goal, string> = {
    strength: 'Charges lourdes (3–5 reps) sur les mouvements de base, repos longs, accessoires pour corriger les maillons faibles.',
    hypertrophy: 'Volume hebdomadaire suffisant par muscle, séries proches de l’échec (1–2 reps en réserve), fourchettes de 6 à 15 reps.',
    fat_loss: 'On garde des charges lourdes pour conserver le muscle et on réduit le volume, car la récupération baisse en déficit calorique.',
    powerbuilding: 'Les mouvements de base travaillés lourd (3–6 reps) pour la force, puis du volume proche de l’échec (6–15 reps) pour la masse musculaire.',
    athletic: 'Chaque séance commence par un travail explosif à l’état frais, suivi de force lourde, d’unilatéral et de portés ; le conditionnement est placé à part.',
    tactical: 'Force sous-maximale sur les mouvements de base, endurance musculaire au poids du corps, base aérobie, intervalles et marche chargée : être fort ET endurant, sans point faible.',
    general: 'Tous les schémas moteurs chaque semaine, effort modéré, volume raisonnable pour tenir dans la durée.',
  };
  return `${days} séances par semaine. ${base[cfg.goal]}`;
}

const P = {
  volume: {
    title: 'Volume hebdomadaire par muscle',
    text: 'Relation dose-réponse entre séries hebdomadaires et prise de muscle ; 10 séries ou plus par muscle donnent plus de gains que moins de 5. Limite : études surtout sur des débutants, peu de données au-delà de 10 séries.',
    source: 'Schoenfeld, Ogborn & Krieger, J Sports Sci, 2017 (méta-analyse)',
  },
  frequency: {
    title: 'Chaque muscle au moins 2 fois par semaine',
    text: 'Entraîner un muscle 2×/semaine fait mieux qu’1× ; à volume égal l’effet propre de la fréquence est faible. On s’en sert donc pour répartir le volume en séances de qualité.',
    source: 'Schoenfeld, Ogborn & Krieger, Sports Med, 2016 ; Schoenfeld, Grgic & Krieger, J Sports Sci, 2019',
  },
  failure: {
    title: 'Proche de l’échec, pas à l’échec',
    text: 'L’hypertrophie profite de séries menées près de l’échec, sans qu’atteindre l’échec apporte un avantage net. On s’arrête donc 1 à 3 répétitions avant (RIR), ce qui limite la fatigue.',
    source: 'Refalo et al., Sports Med, 2023 (méta-analyse) ; échelle RIR : Zourdos et al., J Strength Cond Res, 2016',
  },
  load: {
    title: 'Charge selon l’objectif',
    text: 'L’hypertrophie est similaire sur une large plage de charges si l’effort est élevé ; la force maximale progresse mieux avec des charges lourdes.',
    source: 'Schoenfeld, Grgic, Ogborn & Krieger, J Strength Cond Res, 2017 (méta-analyse)',
  },
  rest: {
    title: 'Repos longs sur les mouvements lourds',
    text: 'Environ 3 minutes ou plus sur les exercices polyarticulaires lourds, 1 à 2 minutes sur les accessoires.',
    source: 'ACSM Position Stand, Med Sci Sports Exerc, 2009',
  },
  progression: {
    title: 'Progression lente et sous-maximale',
    text: 'Partir de charges maîtrisées et ajouter peu à chaque cycle (méthode 5/3/1 : cycles de 4 semaines dont une de décharge). Ici : double progression — d’abord les reps, puis la charge — et décharge planifiable toutes les 4 semaines.',
    source: 'Jim Wendler, 5/3/1 (méthode d’entraîneur, non évaluée par des pairs)',
  },
  landmarks: {
    title: 'Volume ajusté à ta récupération',
    text: 'Démarrer près du volume minimal efficace et n’augmenter que si la progression stagne et que la récupération suit (repères MEV/MRV).',
    source: 'Mike Israetel, Renaissance Periodization (cadre d’entraîneur, non évalué par des pairs)',
  },
  cut: {
    title: 'En déficit : garder l’intensité, baisser le volume',
    text: 'Maintenir des charges lourdes aide à conserver la masse musculaire ; viser une perte de 0,5 à 1 % du poids par semaine.',
    source: 'Helms, Aragon & Fitschen, J Int Soc Sports Nutr, 2014',
  },
  power: {
    title: 'L’explosif d’abord, frais et loin de l’échec',
    text: 'Sauts, lancers et mouvements olympiques se placent en début de séance : peu de répétitions, vitesse maximale, récupération complète. La fatigue fait chuter la puissance produite.',
    source: 'NSCA, Essentials of Strength Training and Conditioning, 4ᵉ éd., 2016 (manuel de référence)',
  },
  concurrent: {
    title: 'Force et endurance : limiter l’interférence',
    text: 'Combiner endurance et musculation freine un peu les gains de force, de masse et surtout de puissance ; l’effet est net avec la course, pas avec le vélo, et croît avec la fréquence et la durée de l’endurance. D’où des séances séparées et un volume d’endurance dosé.',
    source: 'Wilson et al., J Strength Cond Res, 2012 (méta-analyse, 21 études)',
  },
  hiit: {
    title: 'Intervalles 4 × 4 minutes',
    text: 'Quatre efforts de 4 minutes à haute intensité (90–95 % de la fréquence cardiaque maximale), 3 minutes de récupération active : le VO2max progresse davantage qu’avec un travail continu modéré de même dépense totale.',
    source: 'Helgerud et al., Med Sci Sports Exerc, 2007',
  },
  polarized: {
    title: 'L’essentiel de l’endurance à basse intensité',
    text: 'Les athlètes d’endurance réalisent environ 80 % de leurs séances à faible intensité et 20 % à haute intensité : la base aérobie se construit en aisance respiratoire.',
    source: 'Seiler, Int J Sports Physiol Perform, 2010 (revue)',
  },
  ruck: {
    title: 'Le portage de charge s’entraîne en portant',
    text: 'Les programmes qui combinent musculation, endurance et marche chargée progressive améliorent nettement plus la performance en portage que la musculation ou l’endurance seules.',
    source: 'Knapik, Harman, Steelman & Graham, J Strength Cond Res, 2012 (revue systématique, 10 études)',
  },
  operator: {
    title: 'Force sous-maximale + conditionnement',
    text: 'Peu de mouvements de base, charges à 70–90 % du maximum sans aller à l’échec, pour rester frais pour l’endurance et le terrain.',
    source: 'K. Black, Tactical Barbell (méthode d’entraîneur, non évaluée par des pairs)',
  },
} satisfies Record<string, Principle>;

function principlesFor(cfg: GenConfig): Principle[] {
  switch (cfg.goal) {
    case 'strength': return [P.load, P.rest, P.progression, P.frequency, P.failure];
    case 'hypertrophy': return [P.volume, P.frequency, P.failure, P.load, P.landmarks, P.progression];
    case 'powerbuilding': return [P.load, P.volume, P.frequency, P.failure, P.rest, P.progression];
    case 'athletic': return [P.power, P.load, P.concurrent, P.hiit, P.polarized, P.progression];
    case 'tactical': return [P.ruck, P.concurrent, P.operator, P.hiit, P.polarized, P.progression];
    case 'fat_loss': return [P.cut, P.failure, P.frequency, P.progression];
    default: return [P.frequency, P.failure, P.progression, P.rest];
  }
}
