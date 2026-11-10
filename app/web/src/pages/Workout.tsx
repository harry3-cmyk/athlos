import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExercisePicker, Icon, Modal } from '../components/ui';
import { api, type Exercise, type PrEvent, type SetRow, type Workout, type WorkoutExercise } from '../lib/api';
import { fmtCardio, fmtClock, fmtFull, fmtRest, fmtSet, fmtShort, fmtVolume, todayStr } from '../lib/format';
import { prLabel } from './Dashboard';

const DEFAULT_REST = 120;

function target(e: WorkoutExercise): string {
  const parts: string[] = [];
  const cardio = e.muscle === 'cardio';
  if (e.targetSets && e.repsMin && e.repsMax) parts.push(`${e.targetSets} × ${e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}${cardio ? ' min' : ''}`);
  if (e.rir != null && !cardio) parts.push(`${e.rir} rep${e.rir > 1 ? 's' : ''} en réserve`);
  if (e.restSec) parts.push(`repos ${fmtRest(e.restSec)}`);
  return parts.join(' · ');
}

const toPayload = (w: Workout) => ({
  name: w.name.trim() || 'Séance', date: w.date, notes: w.notes,
  exercises: w.exercises.map(e => ({
    exerciseId: e.exerciseId, targetSets: e.targetSets, repsMin: e.repsMin, repsMax: e.repsMax, rir: e.rir, restSec: e.restSec,
    notes: e.notes, sets: e.sets,
  })),
});

/** Champ numérique tolérant : accepte la virgule, laisse le champ vide pendant la saisie. */
function NumInput({ value, onChange, label, decimal, disabled }: {
  value: number | null; onChange: (v: number | null) => void; label: string; decimal?: boolean; disabled?: boolean;
}) {
  const [text, setText] = useState(value == null || value === 0 ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { last.current = value; setText(value == null || value === 0 ? '' : String(value)); }
  }, [value]);
  return (
    <input inputMode={decimal ? 'decimal' : 'numeric'} aria-label={label} value={text} disabled={disabled} placeholder="–"
      onFocus={e => e.target.select()}
      onChange={e => {
        const t = e.target.value.replace(',', '.');
        if (!/^\d*\.?\d*$/.test(t)) return;
        setText(e.target.value);
        const n = t === '' || t === '.' ? null : Number(t);
        last.current = n;
        onChange(n);
      }} />
  );
}

export default function WorkoutPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const [w, setW] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [picker, setPicker] = useState(false);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState<PrEvent[] | null>(null);
  const dirty = useRef(false);
  const latest = useRef<Workout | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(() => api<Workout>('GET', `/workouts/${id}`).then(x => { setW(x); latest.current = x; }).catch(e => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (!dirty.current || !latest.current) return true;
    dirty.current = false;
    setSaveState('saving');
    try {
      await api('PUT', `/workouts/${id}`, toPayload(latest.current));
      if (!dirty.current) setSaveState('saved');
      return true;
    } catch (e: any) {
      dirty.current = true; setSaveState('error'); setError(e.message);
      return false;
    }
  }, [id]);

  /** Toute modification passe par ici : mise à jour locale immédiate, enregistrement différé. */
  const update = useCallback((fn: (w: Workout) => Workout) => {
    if (!latest.current) return;
    const next = fn(latest.current);
    latest.current = next; dirty.current = true;
    setW(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  }, [flush]);

  // Enregistre en quittant la page ou en passant l'app en arrière-plan (téléphone verrouillé entre deux séries).
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [flush]);

  useEffect(() => {
    if (!rest && w?.status !== 'in_progress') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rest, w?.status]);
  useEffect(() => {
    if (rest && now >= rest.until) { setRest(null); try { navigator.vibrate?.([200, 100, 200]); } catch { /* non supporté */ } }
  }, [now, rest]);

  if (error && !w) return <div className="alert error">{error} <Link to="/seances">Retour aux séances</Link></div>;
  if (!w) return <div className="skeleton" />;

  const editable = w.status === 'in_progress';
  const setEx = (i: number, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    update(x => ({ ...x, exercises: x.exercises.map((e, j) => (j === i ? fn(e) : e)) }));
  const setSet = (i: number, k: number, patch: Partial<SetRow>) =>
    setEx(i, e => ({ ...e, sets: e.sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) }));

  const toggleDone = (i: number, k: number) => {
    const e = w.exercises[i], s = e.sets[k];
    if (!s.done && s.reps <= 0) { setError(e.muscle === 'cardio' ? 'Indique la durée en minutes avant de valider.' : 'Indique le nombre de répétitions avant de valider la série.'); return; }
    setError(null);
    setSet(i, k, { done: !s.done });
    if (!s.done) {
      const total = e.restSec ?? DEFAULT_REST;
      // Pas de minuteur pour un effort continu (repos prescrit à 0).
      if (total > 0) { setRest({ until: Date.now() + total * 1000, total }); setNow(Date.now()); }
    }
  };
  const addSet = (i: number) => setEx(i, e => {
    const lastSet = e.sets[e.sets.length - 1];
    return { ...e, sets: [...e.sets, { weight: lastSet?.weight ?? e.suggestion?.weight ?? 0, reps: lastSet?.reps ?? e.suggestion?.reps ?? 0, rpe: null, warmup: false, done: false }] };
  });
  const addExercise = async (ex: Exercise) => {
    setPicker(false);
    update(x => ({ ...x, exercises: [...x.exercises, {
      exerciseId: ex.id, name: ex.name, muscle: ex.muscle, equipment: ex.equipment, targetSets: null, repsMin: null, repsMax: null,
      rir: null, restSec: null, notes: '', previous: null, suggestion: null,
      sets: [{ weight: 0, reps: 0, rpe: null, warmup: false, done: false }],
    }] }));
    // Recharge pour récupérer la dernière performance sur cet exercice.
    if (await flush()) {
      const fresh = await api<Workout>('GET', `/workouts/${id}`);
      if (!dirty.current) { setW(fresh); latest.current = fresh; }
    }
  };
  const move = (i: number, dir: -1 | 1) => update(x => {
    const list = [...x.exercises]; const j = i + dir;
    if (j < 0 || j >= list.length) return x;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...x, exercises: list };
  });

  const start = async () => {
    try { const x = await api<Workout>('POST', `/workouts/${id}/start`, { date: todayStr() }); setW(x); latest.current = x; }
    catch (e: any) { setError(e.message); }
  };
  const finish = async () => {
    if (!(await flush())) return;
    try {
      const r = await api<{ workout: Workout; records: PrEvent[] }>('POST', `/workouts/${id}/finish`);
      setRest(null); setW(r.workout); latest.current = r.workout; setSummary(r.records); setError(null);
    } catch (e: any) { setError(e.message); }
  };
  const reopen = async () => { await api('POST', `/workouts/${id}/reopen`); load(); };
  const remove = async () => {
    if (!confirm('Supprimer définitivement cette séance ?')) return;
    dirty.current = false;
    await api('DELETE', `/workouts/${id}`);
    nav('/seances');
  };
  const reschedule = async (date: string) => {
    if (!date) return;
    await api('PATCH', `/workouts/${id}`, { date });
    setW({ ...w, date });
  };

  const doneSets = w.exercises.flatMap(e => e.sets.filter(s => s.done && !s.warmup));
  const volume = w.exercises.filter(e => e.muscle !== 'cardio').flatMap(e => e.sets.filter(s => s.done && !s.warmup)).reduce((s, x) => s + x.weight * x.reps, 0);
  const elapsed = w.startedAt && editable ? Math.max(0, (now - Date.parse(w.startedAt)) / 1000) : null;

  return (
    <>
      <div className="sticky-actions">
        <div className="row between">
          <Link to="/seances" className="btn ghost sm"><Icon name="left" size={16} />Séances</Link>
          <div className="row">
            {editable && (
              <span className="small muted" role="status">
                {saveState === 'saving' ? 'Enregistrement…' : saveState === 'error' ? 'Non enregistré' : 'Enregistré'}
                {elapsed != null && elapsed < 6 * 3600 && ` · ${fmtClock(elapsed)}`}
              </span>
            )}
            {w.status === 'planned' && <button className="btn primary" onClick={start}><Icon name="play" size={16} />Démarrer</button>}
            {editable && <button className="btn primary" onClick={finish}><Icon name="check" size={16} />Terminer</button>}
            {w.status === 'done' && <button className="btn" onClick={reopen}>Corriger</button>}
            <button className="icon-btn" onClick={remove} aria-label="Supprimer la séance"><Icon name="trash" /></button>
          </div>
        </div>
      </div>

      <div className="page-head">
        <div className="grow">
          {editable ? (
            <input className="input" style={{ fontSize: 20, fontWeight: 700 }} value={w.name} aria-label="Nom de la séance"
              onChange={e => update(x => ({ ...x, name: e.target.value }))} />
          ) : <h1>{w.name}</h1>}
          <p>
            {w.status === 'planned' ? 'Planifiée le ' : ''}{fmtFull(w.date)}
            {w.deload && ' · semaine de décharge'}
            {w.status !== 'planned' && ` · ${doneSets.length} séries · ${fmtVolume(volume)}`}
          </p>
        </div>
        {w.status === 'planned' && (
          <label className="field">Déplacer au<input className="input" type="date" value={w.date} onChange={e => reschedule(e.target.value)} /></label>
        )}
        {editable && (
          <label className="field">Date<input className="input" type="date" value={w.date} max={todayStr()} onChange={e => e.target.value && update(x => ({ ...x, date: e.target.value }))} /></label>
        )}
      </div>

      {error && <div className="alert error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="stack">
        {w.exercises.map((e, i) => (
          <div className="card ex-card" key={`${e.exerciseId}-${i}`}>
            <div className="ex-head">
              <div>
                <h2><Link to={`/progression?exercice=${e.exerciseId}`} style={{ color: 'inherit' }}>{e.name}</Link></h2>
                {target(e) && <div className="ex-meta">{target(e)}</div>}
              </div>
              {editable && (
                <div className="row" style={{ gap: 0, flexWrap: 'nowrap' }}>
                  <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter l’exercice" style={{ transform: 'rotate(90deg)' }}><Icon name="left" size={16} /></button>
                  <button className="icon-btn" disabled={i === w.exercises.length - 1} onClick={() => move(i, 1)} aria-label="Descendre l’exercice" style={{ transform: 'rotate(90deg)' }}><Icon name="right" size={16} /></button>
                  <button className="icon-btn" aria-label={`Retirer ${e.name}`}
                    onClick={() => (e.sets.some(s => s.done) && !confirm(`Retirer ${e.name} et ses séries ?`)) || update(x => ({ ...x, exercises: x.exercises.filter((_, j) => j !== i) }))}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              )}
            </div>

            {w.status !== 'done' && (e.previous || e.suggestion) && (
              <div className="hint-box">
                {e.previous && <div>Dernière fois ({fmtShort(e.previous.date)}) : <strong>{e.previous.sets.map(e.muscle === 'cardio' ? fmtCardio : fmtSet).join(' · ')}</strong></div>}
                {e.suggestion && <div>Objectif : <strong>{fmtSet(e.suggestion)}</strong> — {e.suggestion.reason}</div>}
              </div>
            )}

            {w.status === 'planned' ? null : (
              <table className="sets">
                <thead><tr><th>#</th><th>{e.muscle === 'cardio' ? 'Distance (km)' : 'Charge (kg)'}</th><th>{e.muscle === 'cardio' ? 'Durée (min)' : 'Reps'}</th><th>RPE</th>{editable && <><th><span className="sr-only">Valider</span></th><th /></>}</tr></thead>
                <tbody>
                  {e.sets.map((s, k) => (
                    <tr key={k} className={s.done ? 'done' : ''}>
                      <td>{k + 1}</td>
                      <td><NumInput decimal disabled={!editable} value={s.weight} label={`${e.name}, série ${k + 1}, charge`} onChange={v => setSet(i, k, { weight: v ?? 0 })} /></td>
                      <td><NumInput disabled={!editable} value={s.reps} label={`${e.name}, série ${k + 1}, répétitions`} onChange={v => setSet(i, k, { reps: Math.round(v ?? 0) })} /></td>
                      <td><NumInput decimal disabled={!editable} value={s.rpe} label={`${e.name}, série ${k + 1}, RPE`} onChange={v => setSet(i, k, { rpe: v != null && v >= 1 && v <= 10 ? v : null })} /></td>
                      {editable && (
                        <>
                          <td style={{ width: 48 }}>
                            <button className="check" aria-pressed={s.done} aria-label={`Valider la série ${k + 1} de ${e.name}`} onClick={() => toggleDone(i, k)}><Icon name="check" /></button>
                          </td>
                          <td style={{ width: 32 }}>
                            <button className="icon-btn" style={{ width: 30 }} aria-label={`Supprimer la série ${k + 1}`}
                              onClick={() => setEx(i, x => ({ ...x, sets: x.sets.filter((_, j) => j !== k) }))}><Icon name="x" size={16} /></button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {editable && <button className="btn sm ghost" style={{ marginTop: 4 }} onClick={() => addSet(i)}><Icon name="plus" size={14} />Ajouter une série</button>}
          </div>
        ))}

        {!w.exercises.length && (
          <div className="card empty"><h3>Séance vide</h3><p>Ajoute ton premier exercice pour commencer la saisie.</p></div>
        )}
        {editable && (
          <>
            <button className="btn block" onClick={() => setPicker(true)}><Icon name="plus" size={16} />Ajouter un exercice</button>
            <label className="field">Notes de séance
              <textarea className="input" value={w.notes} placeholder="Sensations, sommeil, douleurs…" onChange={e => update(x => ({ ...x, notes: e.target.value }))} />
            </label>
          </>
        )}
        {!editable && w.notes && <div className="card"><h2>Notes</h2><p style={{ whiteSpace: 'pre-wrap' }}>{w.notes}</p></div>}
      </div>

      {rest && editable && (
        <div className="rest-bar" role="timer" aria-label="Temps de repos">
          <span className="small">Repos</span>
          <span className="clock">{fmtClock((rest.until - now) / 1000)}</span>
          <button onClick={() => setRest({ ...rest, until: rest.until + 30000 })}>+30 s</button>
          <button onClick={() => setRest(null)}>Passer</button>
        </div>
      )}
      {picker && <ExercisePicker onPick={addExercise} onClose={() => setPicker(false)} />}
      {summary && (
        <Modal title="Séance terminée" onClose={() => setSummary(null)}>
          <p>{doneSets.length} séries · {fmtVolume(volume)} soulevés.</p>
          {summary.length > 0 ? (
            <div className="list" style={{ marginTop: 14 }}>
              {summary.map((r, i) => (
                <div className="list-item" key={i}>
                  <span style={{ color: 'var(--warning)' }}><Icon name="trophy" /></span>
                  <div className="grow"><div className="title">{r.name}</div><div className="sub">{prLabel(r)}</div></div>
                </div>
              ))}
            </div>
          ) : <p className="muted" style={{ marginTop: 8 }}>Pas de nouveau record aujourd’hui — la régularité compte davantage.</p>}
          <div className="row" style={{ marginTop: 18 }}>
            <Link className="btn primary" to="/">Tableau de bord</Link>
            <button className="btn" onClick={() => setSummary(null)}>Voir la séance</button>
          </div>
        </Modal>
      )}
    </>
  );
}
