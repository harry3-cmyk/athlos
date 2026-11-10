import { MUSCLES, type Muscle, type Pattern } from './exercises.seed.js';
import { volumeFloor, type Goal, type Level } from './generator.js';
import { addDays, daysBetween, e1rm, linreg, round1 } from './metrics.js';

/**
 * Analyse automatique des points faibles. Fonction pure : toutes les données sont passées en entrée.
 * Les seuils sont des REPÈRES pratiques (heuristiques), pas des normes scientifiques : ils sont regroupés
 * dans `T` pour être ajustés facilement.
 */

export interface AnalysisSet {
  date: string; workoutId: number; exerciseId: number; slug: string | null; name: string;
  muscle: Muscle; secondary: Muscle[]; pattern: Pattern; compound: boolean;
  weight: number; reps: number;
}
export interface AnalysisInput {
  today: string;
  goal: Goal;
  level?: Level;                       // niveau du dernier programme généré, s'il existe
  sets: AnalysisSet[];                 // séries de travail validées, 12 dernières semaines
  cardio?: { date: string; workoutId: number; minutes: number; km: number }[]; // séries d'endurance, 12 dernières semaines
  missedPlanned: number;               // séances planifiées non faites sur 28 jours
  weights: { date: string; weight: number }[];
}

export type Severity = 'high' | 'medium' | 'low' | 'good';
export interface Finding {
  id: string; severity: Severity; category: string; title: string; detail: string; action: string;
}
export interface AnalysisResult {
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

const T = {
  windowDays: 28,          // fenêtre volume / régularité
  trendDays: 56,           // fenêtre tendances de force
  minSessionsForTrend: 4,
  plateauPctPerWeek: 0.15, // en dessous : stagnation
  regressPctPerWeek: -0.5,
  highVolume: 25,
  cardioTactical: 90,      // minutes d'endurance par semaine visées pour le profil opérateur
  cardioHybrid: 60,        // idem pour le profil opérateur + masse
  cardioAthletic: 30,      // idem pour le profil athlétique          // séries/sem au-delà desquelles on alerte sur la récupération
  pullPushMin: 0.8,        // tirage / poussée
  postQuadMin: 0.6,        // chaîne postérieure / quadriceps
  minorMuscles: ['abs', 'calves'] as Muscle[],
};

const fr = (n: number | null) => String(n).replace('.', ',');
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const MUSCLE_FR: Record<Muscle, string> = {
  chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', biceps: 'Biceps', triceps: 'Triceps',
  quads: 'Quadriceps', hamstrings: 'Ischio-jambiers', glutes: 'Fessiers', calves: 'Mollets', abs: 'Abdominaux',
};

const PUSH: Pattern[] = ['h_push', 'incline_push', 'v_push'];
const PULL: Pattern[] = ['h_pull', 'v_pull'];
const QUAD: Pattern[] = ['squat', 'lunge', 'knee_ext'];
const POST: Pattern[] = ['hinge', 'knee_flex', 'hip_thrust'];

// Rapports de force entre mouvements de base : fourchettes empiriques d'entraîneurs, à lire comme indices.
const RATIOS: { label: string; a: string; b: string; low: number; high: number; weakLow: string; weakHigh: string }[] = [
  { label: 'Développé couché / Squat', a: 'bench-press', b: 'back-squat', low: 0.6, high: 0.9,
    weakLow: 'ton développé couché est en retrait par rapport à ton squat', weakHigh: 'ton squat est en retrait par rapport à ton développé couché' },
  { label: 'Soulevé de terre / Squat', a: 'deadlift', b: 'back-squat', low: 1.0, high: 1.45,
    weakLow: 'ton soulevé de terre est en retrait par rapport à ton squat', weakHigh: 'ton squat est en retrait par rapport à ton soulevé de terre' },
  { label: 'Développé militaire / Développé couché', a: 'overhead-press', b: 'bench-press', low: 0.5, high: 0.75,
    weakLow: 'ta poussée verticale est en retrait', weakHigh: 'ton développé couché est en retrait par rapport à ta poussée verticale' },
  { label: 'Rowing barre / Développé couché', a: 'barbell-row', b: 'bench-press', low: 0.7, high: 1.1,
    weakLow: 'ton tirage horizontal est en retrait par rapport à ta poussée', weakHigh: 'ton développé couché est en retrait par rapport à ton tirage' },
];

export function analyze(input: AnalysisInput): AnalysisResult {
  const { today, goal } = input;
  const findings: Finding[] = [];
  const from28 = addDays(today, -T.windowDays + 1);
  const recent = input.sets.filter(s => s.date >= from28 && s.date <= today);
  const weeks = T.windowDays / 7;

  const cardio28 = (input.cardio ?? []).filter(c => c.date >= from28 && c.date <= today);
  const sessions28 = new Set([...recent, ...cardio28].map(s => s.workoutId)).size;
  const enough = sessions28 >= 4;
  if (!enough) {
    findings.push({
      id: 'data', severity: 'low', category: 'Données',
      title: 'Pas encore assez de séances pour une analyse fiable',
      detail: `${sessions28} séance(s) enregistrée(s) sur les 28 derniers jours ; il en faut au moins 4.`,
      action: 'Enregistre tes séances pendant 2 à 3 semaines : l’analyse se précisera automatiquement.',
    });
  }

  // — Volume et fréquence par muscle
  const floor = volumeFloor(goal, input.level);
  const setCount = new Map<Muscle, number>(MUSCLES.map(m => [m, 0]));
  const dayHits = new Map<Muscle, Set<string>>(MUSCLES.map(m => [m, new Set()]));
  for (const s of recent) {
    setCount.set(s.muscle, setCount.get(s.muscle)! + 1);
    dayHits.get(s.muscle)!.add(s.date);
    for (const m of s.secondary) setCount.set(m, setCount.get(m)! + 0.5);
  }
  const muscles = MUSCLES.map(m => ({
    muscle: m,
    weeklySets: round1(setCount.get(m)! / weeks),
    frequency: round1(dayHits.get(m)!.size / weeks),
    floor,
  }));

  if (enough) {
    for (const m of muscles) {
      const minor = T.minorMuscles.includes(m.muscle);
      const name = MUSCLE_FR[m.muscle];
      if (m.weeklySets < floor * 0.4) {
        findings.push({
          id: `vol-${m.muscle}`, severity: minor ? 'low' : 'high', category: 'Volume',
          title: `${name} : presque pas travaillé`,
          detail: `${fr(m.weeklySets)} série/semaine en moyenne, pour un repère de ${floor}.`,
          action: `Ajoute 2 exercices ciblant ${name.toLowerCase()} répartis sur 2 séances.`,
        });
      } else if (m.weeklySets < floor) {
        findings.push({
          // Juste sous le repère (≥ 80 %) : simple point d'attention, pas une alerte.
          id: `vol-${m.muscle}`, severity: minor || m.weeklySets >= floor * 0.8 ? 'low' : 'medium', category: 'Volume',
          title: `${name} : volume ${m.weeklySets >= floor * 0.8 ? 'un peu juste' : 'insuffisant'}`,
          detail: `${fr(m.weeklySets)} séries/semaine en moyenne, sous le repère de ${floor}.`,
          action: `Ajoute ${plural(Math.ceil(floor - m.weeklySets), 'série hebdomadaire', 'séries hebdomadaires')}, de préférence sur une 2ᵉ séance.`,
        });
      } else if (m.weeklySets > T.highVolume) {
        findings.push({
          id: `vol-${m.muscle}`, severity: 'low', category: 'Récupération',
          title: `${name} : volume très élevé`,
          detail: `${fr(m.weeklySets)} séries/semaine. Au-delà de ${T.highVolume}, le gain supplémentaire est incertain et la fatigue augmente.`,
          action: 'Si la progression stagne ou que les articulations tirent, réduis de 20 à 30 % pendant une semaine.',
        });
      }
      if (!minor && m.weeklySets >= floor && m.frequency < 1.5) {
        findings.push({
          id: `freq-${m.muscle}`, severity: 'low', category: 'Fréquence',
          title: `${name} : concentré sur une seule séance`,
          detail: `Sollicité ${fr(m.frequency)} fois/semaine comme muscle principal.`,
          action: 'Répartis le même volume sur 2 séances : la qualité des dernières séries sera meilleure.',
        });
      }
    }
  }

  // — Équilibres agoniste / antagoniste
  const count = (ps: Pattern[]) => recent.filter(s => ps.includes(s.pattern)).length;
  const mkBalance = (label: string, a: string, b: string, aSets: number, bSets: number) => ({
    label, a, b, aSets, bSets, ratio: bSets > 0 ? round1((aSets / bSets) * 100) / 100 : null,
  });
  const balance = [
    mkBalance('Tirage / Poussée', 'Tirage', 'Poussée', count(PULL), count(PUSH)),
    mkBalance('Chaîne postérieure / Quadriceps', 'Chaîne postérieure', 'Quadriceps', count(POST), count(QUAD)),
  ];
  if (enough) {
    const [pp, pq] = balance;
    if (pp.bSets >= 8 && pp.ratio !== null && pp.ratio < T.pullPushMin) {
      findings.push({
        id: 'bal-pull', severity: 'medium', category: 'Équilibre',
        title: 'Trop de poussée par rapport au tirage',
        detail: `${pp.aSets} séries de tirage pour ${pp.bSets} de poussée sur 28 jours (rapport ${fr(pp.ratio)}).`,
        action: 'Vise au moins autant de séries de tirage (rowing, tractions) que de poussée.',
      });
    }
    if (pq.bSets >= 8 && pq.ratio !== null && pq.ratio < T.postQuadMin) {
      findings.push({
        id: 'bal-post', severity: 'medium', category: 'Équilibre',
        title: 'Chaîne postérieure sous-entraînée',
        detail: `${pq.aSets} séries ischios/fessiers pour ${pq.bSets} séries dominantes quadriceps (rapport ${fr(pq.ratio)}).`,
        action: 'Ajoute un soulevé de terre roumain ou un leg curl sur chaque séance jambes.',
      });
    }
  }

  // — Rapports de force (meilleur 1RM estimé sur 12 semaines)
  const bestBySlug = new Map<string, number>();
  for (const s of input.sets) {
    if (!s.slug) continue;
    const v = e1rm(s.weight, s.reps);
    if (v > (bestBySlug.get(s.slug) ?? 0)) bestBySlug.set(s.slug, v);
  }
  const ratios: AnalysisResult['ratios'] = [];
  for (const r of RATIOS) {
    const a = bestBySlug.get(r.a), b = bestBySlug.get(r.b);
    if (!a || !b) continue;
    const value = Math.round((a / b) * 100) / 100;
    ratios.push({ label: r.label, value, low: r.low, high: r.high, a: round1(a), b: round1(b) });
    if (value < r.low || value > r.high) {
      findings.push({
        id: `ratio-${r.a}-${r.b}`, severity: 'medium', category: 'Force relative',
        title: `${r.label} : ${fr(value)}`,
        detail: `Fourchette habituelle ${fr(r.low)}–${fr(r.high)}. Indice : ${value < r.low ? r.weakLow : r.weakHigh}. Repère empirique, la morphologie compte.`,
        action: 'Donne la priorité au mouvement en retrait : place-le en premier dans la séance et ajoute 2 à 3 séries hebdomadaires.',
      });
    }
  }

  // — Tendances de force par exercice (pente du meilleur 1RM estimé par séance)
  const fromTrend = addDays(today, -T.trendDays + 1);
  const perEx = new Map<number, { name: string; compound: boolean; days: Map<string, number> }>();
  for (const s of input.sets) {
    if (s.date < fromTrend || s.weight <= 0) continue;
    if (!perEx.has(s.exerciseId)) perEx.set(s.exerciseId, { name: s.name, compound: s.compound, days: new Map() });
    const d = perEx.get(s.exerciseId)!.days;
    d.set(s.date, Math.max(d.get(s.date) ?? 0, e1rm(s.weight, s.reps)));
  }
  const trends: AnalysisResult['trends'] = [];
  const compoundOf = new Map<number, boolean>();
  for (const [exerciseId, { name, compound, days }] of perEx) {
    if (days.size < T.minSessionsForTrend) continue;
    const pts = [...days].map(([date, y]) => ({ x: daysBetween(fromTrend, date) / 7, y }));
    const mean = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const pct = (linreg(pts).slope / mean) * 100;
    trends.push({ exerciseId, name, sessions: days.size, pctPerWeek: round1(pct), best: round1(Math.max(...days.values())) });
    compoundOf.set(exerciseId, compound);
  }
  trends.sort((a, b) => a.pctPerWeek - b.pctPerWeek);
  for (const t of trends.filter(t => t.pctPerWeek < T.plateauPctPerWeek).slice(0, 5)) {
    const regress = t.pctPerWeek <= T.regressPctPerWeek;
    findings.push({
      id: `trend-${t.exerciseId}`, severity: compoundOf.get(t.exerciseId) ? 'medium' : 'low', category: 'Progression',
      title: `${t.name} : ${regress ? 'en régression' : 'stagnation'}`,
      detail: `1RM estimé ${t.pctPerWeek > 0 ? '+' : ''}${fr(t.pctPerWeek)} %/semaine sur ${t.sessions} séances (8 semaines).`,
      action: regress
        ? 'Vérifie sommeil, apports et fatigue cumulée ; une semaine de décharge est souvent le bon réflexe.'
        : 'Change un paramètre : fourchette de reps, variante du mouvement, ou +1 à 2 séries hebdomadaires.',
    });
  }
  for (const t of [...trends].reverse().filter(t => t.pctPerWeek >= 1).slice(0, 3)) {
    findings.push({
      id: `trend-${t.exerciseId}`, severity: 'good', category: 'Progression',
      title: `${t.name} : belle progression`,
      detail: `1RM estimé +${fr(t.pctPerWeek)} %/semaine sur ${t.sessions} séances.`,
      action: 'Ne change rien tant que ça progresse.',
    });
  }

  // — Endurance (objectifs qui en dépendent) : repères pratiques, pas des normes.
  const cardio = {
    minutesPerWeek: Math.round(cardio28.reduce((s, c) => s + c.minutes, 0) / weeks),
    sessionsPerWeek: round1(new Set(cardio28.map(c => c.workoutId)).size / weeks),
    kmPerWeek: round1(cardio28.reduce((s, c) => s + c.km, 0) / weeks),
  };
  const cardioFloor = goal === 'tactical' ? T.cardioTactical : goal === 'hybrid' ? T.cardioHybrid : goal === 'athletic' ? T.cardioAthletic : 0;
  if (enough && cardioFloor && cardio.minutesPerWeek < cardioFloor) {
    findings.push({
      id: 'cardio', severity: goal === 'tactical' ? (cardio.minutesPerWeek < cardioFloor / 2 ? 'high' : 'medium') : 'low', category: 'Endurance',
      title: 'Endurance insuffisante pour ton objectif',
      detail: `${cardio.minutesPerWeek} min/semaine d’endurance en moyenne, pour un repère de ${cardioFloor} min.`,
      action: goal === 'tactical' || goal === 'hybrid'
        ? 'Ajoute une séance d’endurance fondamentale (30 à 60 min en aisance respiratoire) et garde une séance d’intervalles par semaine.'
        : 'Ajoute un bloc d’intervalles courts en fin de séance ou une séance de conditionnement dédiée.',
    });
  }
  if (enough && goal === 'tactical' && recent.length === 0) {
    findings.push({
      id: 'no-strength', severity: 'high', category: 'Force',
      title: 'Aucune séance de force sur 28 jours',
      detail: 'L’endurance seule ne prépare ni au portage de charge ni aux efforts courts et intenses.',
      action: 'Planifie au moins 2 séances de force par semaine sur les mouvements de base.',
    });
  }

  // — Régularité
  const perWeek = round1(sessions28 / weeks);
  const adherence = sessions28 + input.missedPlanned > 0 && input.missedPlanned > 0
    ? Math.round((sessions28 / (sessions28 + input.missedPlanned)) * 100) : null;
  if (adherence !== null && adherence < 75) {
    findings.push({
      id: 'adherence', severity: adherence < 50 ? 'high' : 'medium', category: 'Régularité',
      title: `${input.missedPlanned} séance(s) planifiée(s) manquée(s)`,
      detail: `Assiduité de ${adherence} % sur 28 jours. La régularité pèse plus que n’importe quel détail de programme.`,
      action: 'Réduis le nombre de séances planifiées à ce que tu tiens réellement, puis remonte progressivement.',
    });
  }

  // — Tendance de poids
  let weightTrend: AnalysisResult['weightTrend'] = null;
  const w = input.weights.filter(x => x.date >= from28 && x.date <= today);
  if (w.length >= 4 && daysBetween(w[0].date, w[w.length - 1].date) >= 10) {
    const pts = w.map(x => ({ x: daysBetween(from28, x.date) / 7, y: x.weight }));
    const mean = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const slope = linreg(pts).slope;
    weightTrend = { kgPerWeek: Math.round(slope * 100) / 100, pctPerWeek: Math.round((slope / mean) * 1000) / 10 };
    const p = weightTrend.pctPerWeek;
    const sign = p > 0 ? '+' : '';
    if (goal === 'fat_loss') {
      if (p < -1) findings.push({ id: 'weight', severity: 'medium', category: 'Poids',
        title: 'Perte de poids trop rapide', detail: `${fr(p)} %/semaine. Au-delà de 1 %/semaine, le risque de perdre du muscle augmente.`,
        action: 'Remonte légèrement les apports pour viser −0,5 à −1 % par semaine.' });
      else if (p > -0.25) findings.push({ id: 'weight', severity: 'medium', category: 'Poids',
        title: 'Le poids ne baisse pas', detail: `${sign}${fr(p)} %/semaine sur 28 jours, pour un objectif de perte de gras.`,
        action: 'Réduis les apports d’environ 10 % ou ajoute de l’activité quotidienne, puis réévalue dans 2 semaines.' });
      else findings.push({ id: 'weight', severity: 'good', category: 'Poids',
        title: 'Rythme de perte adapté', detail: `${fr(p)} %/semaine, dans la zone −0,5 à −1 %.`, action: 'Continue ainsi.' });
    } else if (goal === 'hypertrophy' || goal === 'powerbuilding' || goal === 'hybrid') {
      if (p > 0.5) findings.push({ id: 'weight', severity: 'low', category: 'Poids',
        title: 'Prise de poids rapide', detail: `+${fr(p)} %/semaine. Au-delà de 0,5 %/semaine, une part croissante est du gras (repère pratique).`,
        action: 'Réduis légèrement le surplus calorique.' });
      else if (p < -0.25) findings.push({ id: 'weight', severity: 'medium', category: 'Poids',
        title: 'Tu perds du poids en visant la prise de muscle', detail: `${fr(p)} %/semaine sur 28 jours.`,
        action: 'Augmente les apports : la prise de muscle est plus lente en déficit calorique.' });
    }
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2, good: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { dataQuality: { sessions28, enough }, muscles, balance, ratios, trends, consistency: { perWeek, adherence }, cardio, weightTrend, findings };
}
