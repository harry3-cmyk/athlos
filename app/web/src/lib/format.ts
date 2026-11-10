import { useCallback, useEffect, useState } from 'react';
import type { Goal, Group, Muscle } from './api';

export const MUSCLE_FR: Record<Muscle, string> = {
  chest: 'Pectoraux', back: 'Dos', shoulders: 'Épaules', biceps: 'Biceps', triceps: 'Triceps',
  quads: 'Quadriceps', hamstrings: 'Ischio-jambiers', glutes: 'Fessiers', calves: 'Mollets', abs: 'Abdominaux',
};
export const MUSCLES = Object.keys(MUSCLE_FR) as Muscle[];
export const GROUP_FR: Record<Group, string> = { ...MUSCLE_FR, cardio: 'Cardio' };
export const GOAL_FR: Record<Goal, string> = {
  strength: 'Force', hypertrophy: 'Hypertrophie', powerbuilding: 'Force + hypertrophie', athletic: 'Athlétique',
  tactical: 'Opérateur', hybrid: 'Opérateur + masse', fat_loss: 'Perte de gras', general: 'Forme générale',
};
export const GOAL_DESC: Record<Goal, string> = {
  strength: 'Soulever le plus lourd possible sur les mouvements de base.',
  hypertrophy: 'Prendre un maximum de masse musculaire.',
  powerbuilding: 'Être fort ET musclé : mouvements de base lourds, puis volume pour la masse.',
  athletic: 'Explosif, fort et endurant : sauts et lancers, force lourde, unilatéral, portés, conditionnement.',
  tactical: 'Préparation physique d’opérateur : force, endurance musculaire, course, intervalles et marche chargée.',
  hybrid: 'Prendre de la masse et de la force tout en gardant l’endurance d’un opérateur : musculation lourde et volumineuse, course et intervalles à part.',
  fat_loss: 'Perdre du gras en conservant le muscle.',
  general: 'Rester en forme, avec un effort modéré et durable.',
};
export const EQUIPMENT_FR: Record<string, string> = {
  barbell: 'Barre', dumbbell: 'Haltères', machine: 'Machine', cable: 'Poulie', bodyweight: 'Poids du corps', other: 'Petit matériel',
};
export const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Date locale de l'utilisateur au format AAAA-MM-JJ (jamais toISOString : décalage UTC). */
export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}
export function weekStart(date: string): string {
  const dow = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}
const utc = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' });
const F_SHORT = utc({ day: 'numeric', month: 'short' });
const F_LONG = utc({ weekday: 'long', day: 'numeric', month: 'long' });
const F_FULL = utc({ day: 'numeric', month: 'short', year: 'numeric' });
const F_MONTH = utc({ month: 'long', year: 'numeric' });
const asDate = (d: string) => new Date(d + 'T00:00:00Z');
export const fmtShort = (d: string) => F_SHORT.format(asDate(d));
export const fmtLong = (d: string) => F_LONG.format(asDate(d));
export const fmtFull = (d: string) => F_FULL.format(asDate(d));
export const fmtMonth = (d: string) => F_MONTH.format(asDate(d));

export function relDay(date: string, today = todayStr()): string {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return fmtLong(date);
}

const NUM = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
export const fmtNum = (n: number | null | undefined) => (n == null ? '—' : NUM.format(n));
export const fmtKg = (n: number | null | undefined) => (n == null ? '—' : `${NUM.format(n)} kg`);
export function fmtVolume(kg: number): string {
  return kg >= 10000 ? `${NUM.format(kg / 1000)} t` : `${NUM.format(Math.round(kg))} kg`;
}
export const fmtSet = (s: { weight: number; reps: number }) => (s.weight > 0 ? `${NUM.format(s.weight)} × ${s.reps}` : `${s.reps} reps`);
/** Série d'endurance : distance (facultative) et durée. */
export const fmtCardio = (s: { weight: number; reps: number }) => (s.weight > 0 ? `${NUM.format(s.weight)} km en ${s.reps} min` : `${s.reps} min`);
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function fmtRest(sec: number | null): string {
  if (!sec) return '';
  return sec % 60 === 0 ? `${sec / 60} min` : fmtClock(sec);
}

/** Chargement de données avec états explicites. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    setLoading(true);
    return run().then(d => { setData(d); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [run]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    run().then(d => { if (alive) { setData(d); setError(null); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [run]);
  return { data, error, loading, reload, setData };
}
