export const MUSCLES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';

export type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'hip_thrust'
  | 'h_push' | 'incline_push' | 'v_push' | 'h_pull' | 'v_pull'
  | 'knee_ext' | 'knee_flex' | 'calf' | 'curl' | 'tri_ext'
  | 'lateral_raise' | 'rear_delt' | 'chest_fly' | 'core';

export interface ExerciseSeed {
  slug: string;
  name: string;
  muscle: Muscle;
  secondary: Muscle[];
  equipment: Equipment;
  pattern: Pattern;
  compound: boolean;
}

type Row = [string, string, Muscle, Muscle[], Equipment, Pattern, boolean];

// L'ordre dans chaque schéma moteur = ordre de préférence du générateur (du plus "de base" au plus spécifique).
const ROWS: Row[] = [
  // — Squat
  ['back-squat', 'Squat barre', 'quads', ['glutes', 'hamstrings'], 'barbell', 'squat', true],
  ['front-squat', 'Squat avant', 'quads', ['glutes', 'abs'], 'barbell', 'squat', true],
  ['leg-press', 'Presse à cuisses', 'quads', ['glutes'], 'machine', 'squat', true],
  ['hack-squat', 'Hack squat', 'quads', ['glutes'], 'machine', 'squat', true],
  ['goblet-squat', 'Goblet squat', 'quads', ['glutes'], 'dumbbell', 'squat', true],
  ['bw-squat', 'Squat au poids du corps', 'quads', ['glutes'], 'bodyweight', 'squat', true],
  ['pistol-squat', 'Pistol squat (assisté si besoin)', 'quads', ['glutes'], 'bodyweight', 'squat', true],
  // — Charnière de hanche
  ['deadlift', 'Soulevé de terre', 'hamstrings', ['glutes', 'back'], 'barbell', 'hinge', true],
  ['romanian-deadlift', 'Soulevé de terre roumain', 'hamstrings', ['glutes', 'back'], 'barbell', 'hinge', true],
  ['db-romanian-deadlift', 'Soulevé de terre roumain haltères', 'hamstrings', ['glutes'], 'dumbbell', 'hinge', true],
  ['back-extension', 'Extension lombaire (banc à 45°)', 'hamstrings', ['glutes', 'back'], 'machine', 'hinge', false],
  ['single-leg-rdl', 'Soulevé de terre unilatéral', 'hamstrings', ['glutes'], 'bodyweight', 'hinge', true],
  // — Fentes
  ['bulgarian-split-squat', 'Squat bulgare', 'quads', ['glutes'], 'dumbbell', 'lunge', true],
  ['walking-lunge', 'Fentes marchées', 'quads', ['glutes'], 'dumbbell', 'lunge', true],
  ['bw-split-squat', 'Fentes au poids du corps', 'quads', ['glutes'], 'bodyweight', 'lunge', true],
  // — Extension de hanche
  ['hip-thrust', 'Hip thrust barre', 'glutes', ['hamstrings'], 'barbell', 'hip_thrust', true],
  ['machine-hip-thrust', 'Hip thrust machine', 'glutes', ['hamstrings'], 'machine', 'hip_thrust', true],
  ['db-hip-thrust', 'Hip thrust haltère', 'glutes', ['hamstrings'], 'dumbbell', 'hip_thrust', true],
  ['glute-bridge', 'Pont fessier unilatéral', 'glutes', ['hamstrings'], 'bodyweight', 'hip_thrust', false],
  // — Poussée horizontale
  ['bench-press', 'Développé couché', 'chest', ['triceps', 'shoulders'], 'barbell', 'h_push', true],
  ['db-bench-press', 'Développé couché haltères', 'chest', ['triceps', 'shoulders'], 'dumbbell', 'h_push', true],
  ['machine-chest-press', 'Développé machine', 'chest', ['triceps', 'shoulders'], 'machine', 'h_push', true],
  ['push-up', 'Pompes', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'h_push', true],
  ['dips', 'Dips', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'h_push', true],
  // — Poussée inclinée
  ['incline-db-press', 'Développé incliné haltères', 'chest', ['shoulders', 'triceps'], 'dumbbell', 'incline_push', true],
  ['incline-bench-press', 'Développé incliné barre', 'chest', ['shoulders', 'triceps'], 'barbell', 'incline_push', true],
  ['incline-machine-press', 'Développé incliné machine', 'chest', ['shoulders', 'triceps'], 'machine', 'incline_push', true],
  ['decline-push-up', 'Pompes pieds surélevés', 'chest', ['shoulders', 'triceps'], 'bodyweight', 'incline_push', true],
  // — Poussée verticale
  ['overhead-press', 'Développé militaire', 'shoulders', ['triceps'], 'barbell', 'v_push', true],
  ['db-shoulder-press', 'Développé épaules haltères', 'shoulders', ['triceps'], 'dumbbell', 'v_push', true],
  ['machine-shoulder-press', 'Développé épaules machine', 'shoulders', ['triceps'], 'machine', 'v_push', true],
  ['pike-push-up', 'Pompes piquées', 'shoulders', ['triceps'], 'bodyweight', 'v_push', true],
  // — Tirage horizontal
  ['barbell-row', 'Rowing barre', 'back', ['biceps'], 'barbell', 'h_pull', true],
  ['chest-supported-row', 'Rowing buste appuyé', 'back', ['biceps'], 'machine', 'h_pull', true],
  ['seated-cable-row', 'Tirage horizontal poulie', 'back', ['biceps'], 'cable', 'h_pull', true],
  ['db-row', 'Rowing haltère unilatéral', 'back', ['biceps'], 'dumbbell', 'h_pull', true],
  ['inverted-row', 'Rowing inversé', 'back', ['biceps'], 'bodyweight', 'h_pull', true],
  // — Tirage vertical
  ['pull-up', 'Tractions pronation', 'back', ['biceps'], 'bodyweight', 'v_pull', true],
  ['lat-pulldown', 'Tirage vertical poulie', 'back', ['biceps'], 'cable', 'v_pull', true],
  ['chin-up', 'Tractions supination', 'back', ['biceps'], 'bodyweight', 'v_pull', true],
  ['neutral-pulldown', 'Tirage vertical prise neutre', 'back', ['biceps'], 'cable', 'v_pull', true],
  // — Isolation jambes
  ['leg-extension', 'Leg extension', 'quads', [], 'machine', 'knee_ext', false],
  ['sissy-squat', 'Sissy squat', 'quads', [], 'bodyweight', 'knee_ext', false],
  ['seated-leg-curl', 'Leg curl assis', 'hamstrings', [], 'machine', 'knee_flex', false],
  ['lying-leg-curl', 'Leg curl allongé', 'hamstrings', [], 'machine', 'knee_flex', false],
  ['nordic-curl', 'Nordic curl', 'hamstrings', [], 'bodyweight', 'knee_flex', false],
  ['standing-calf-raise', 'Mollets debout machine', 'calves', [], 'machine', 'calf', false],
  ['seated-calf-raise', 'Mollets assis', 'calves', [], 'machine', 'calf', false],
  ['db-calf-raise', 'Mollets debout haltère', 'calves', [], 'dumbbell', 'calf', false],
  ['single-leg-calf-raise', 'Mollets unilatéral poids du corps', 'calves', [], 'bodyweight', 'calf', false],
  // — Bras
  ['barbell-curl', 'Curl barre', 'biceps', [], 'barbell', 'curl', false],
  ['incline-db-curl', 'Curl incliné haltères', 'biceps', [], 'dumbbell', 'curl', false],
  ['cable-curl', 'Curl poulie', 'biceps', [], 'cable', 'curl', false],
  ['hammer-curl', 'Curl marteau', 'biceps', [], 'dumbbell', 'curl', false],
  ['preacher-curl', 'Curl pupitre', 'biceps', [], 'machine', 'curl', false],
  ['triceps-pushdown', 'Extension triceps poulie', 'triceps', [], 'cable', 'tri_ext', false],
  ['overhead-cable-extension', 'Extension triceps au-dessus de la tête (poulie)', 'triceps', [], 'cable', 'tri_ext', false],
  ['skull-crusher', 'Barre au front', 'triceps', [], 'barbell', 'tri_ext', false],
  ['db-overhead-extension', 'Extension triceps haltère', 'triceps', [], 'dumbbell', 'tri_ext', false],
  ['diamond-push-up', 'Pompes diamant', 'triceps', ['chest'], 'bodyweight', 'tri_ext', true],
  // — Épaules / pectoraux isolation
  ['db-lateral-raise', 'Élévations latérales haltères', 'shoulders', [], 'dumbbell', 'lateral_raise', false],
  ['cable-lateral-raise', 'Élévations latérales poulie', 'shoulders', [], 'cable', 'lateral_raise', false],
  ['machine-lateral-raise', 'Élévations latérales machine', 'shoulders', [], 'machine', 'lateral_raise', false],
  ['face-pull', 'Face pull', 'shoulders', ['back'], 'cable', 'rear_delt', false],
  ['reverse-pec-deck', 'Pec deck inversé', 'shoulders', ['back'], 'machine', 'rear_delt', false],
  ['db-reverse-fly', 'Oiseau haltères', 'shoulders', ['back'], 'dumbbell', 'rear_delt', false],
  ['prone-y-raise', 'Élévations en Y au sol', 'shoulders', ['back'], 'bodyweight', 'rear_delt', false],
  ['cable-fly', 'Écarté poulie', 'chest', [], 'cable', 'chest_fly', false],
  ['pec-deck', 'Pec deck', 'chest', [], 'machine', 'chest_fly', false],
  ['db-fly', 'Écarté haltères', 'chest', [], 'dumbbell', 'chest_fly', false],
  // — Gainage / abdominaux
  ['cable-crunch', 'Crunch poulie', 'abs', [], 'cable', 'core', false],
  ['hanging-leg-raise', 'Relevé de jambes suspendu', 'abs', [], 'bodyweight', 'core', false],
  ['ab-wheel', 'Roulette abdominale', 'abs', [], 'bodyweight', 'core', false],
  ['plank', 'Gainage planche', 'abs', [], 'bodyweight', 'core', false],
];

export const EXERCISE_SEED: ExerciseSeed[] = ROWS.map(
  ([slug, name, muscle, secondary, equipment, pattern, compound]) => ({
    slug, name, muscle, secondary, equipment, pattern, compound,
  }),
);
