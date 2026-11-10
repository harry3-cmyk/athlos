import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProgramView } from '../components/ProgramView';
import { Async, Chips, ExercisePicker, Icon, Toast } from '../components/ui';
import { api, type Program, type ProgramDay, type ProgramExercise, type Workout } from '../lib/api';
import { DAYS_FR, addDays, todayStr, useData, weekStart } from '../lib/format';

const DEFAULT_DAYS: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

export default function ProgramDetailPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const today = todayStr();
  const state = useData(() => api<Program>('GET', `/programs/${id}`), [id]);
  const [swap, setSwap] = useState<ProgramExercise | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sched, setSched] = useState<{ startDate: string; weeks: number; weekdays: number[] | null; deloadEvery: number }>({
    startDate: today, weeks: 8, weekdays: null, deloadEvery: 4,
  });

  const guard = async (fn: () => Promise<void>) => { setError(null); try { await fn(); } catch (e: any) { setError(e.message); } };

  return (
    <>
      <Link to="/programmes" className="btn ghost sm" style={{ marginBottom: 8 }}><Icon name="left" size={16} />Programmes</Link>
      <Async state={state}>{p => {
        const n = p.days.length;
        const weekdays = sched.weekdays ?? DEFAULT_DAYS[n] ?? [];
        const toggleDay = (d: number) =>
          setSched({ ...sched, weekdays: weekdays.includes(d) ? weekdays.filter(x => x !== d) : [...weekdays, d] });
        const schedule = () => guard(async () => {
          const r = await api<{ created: number }>('POST', `/programs/${id}/schedule`, { ...sched, weekdays });
          setToast(`${r.created} séances planifiées`);
          setTimeout(() => nav('/planning'), 900);
        });
        const startDay = (d: ProgramDay) => guard(async () => {
          const w = await api<Workout>('POST', `/programs/${id}/days/${d.id}/start`, { date: today });
          await api('POST', `/workouts/${w.id}/start`, { date: today });
          nav(`/seances/${w.id}`);
        });
        const setSets = (e: ProgramExercise, delta: number) => guard(async () => {
          state.setData(await api<Program>('PATCH', `/programs/${id}/exercises/${e.id}`, { sets: Math.max(1, Math.min(10, e.sets + delta)) }));
        });
        const remove = () => guard(async () => {
          if (!confirm('Supprimer ce programme et ses séances planifiées ? Les séances déjà réalisées sont conservées.')) return;
          await api('DELETE', `/programs/${id}`);
          nav('/programmes');
        });
        // Première occurrence de chaque jour choisi, à partir de la date de début.
        const firstDates = [...weekdays].sort((a, b) => a - b).map(d => {
          const date = addDays(weekStart(sched.startDate), d);
          return date < sched.startDate ? addDays(date, 7) : date;
        });

        return (
          <div className="stack">
            <div className="page-head" style={{ marginBottom: 0 }}>
              <div><h1>{p.name}</h1><p>{n} séances par semaine</p></div>
              <button className="btn danger" onClick={remove}><Icon name="trash" size={16} />Supprimer</button>
            </div>
            {error && <div className="alert error" role="alert">{error}</div>}

            <div className="card stack">
              <h2>Planifier sur le calendrier</h2>
              <div className="form-grid">
                <label className="field">À partir du
                  <input className="input" type="date" value={sched.startDate} onChange={e => e.target.value && setSched({ ...sched, startDate: e.target.value })} />
                </label>
                <label className="field">Durée
                  <select className="input" value={sched.weeks} onChange={e => setSched({ ...sched, weeks: Number(e.target.value) })}>
                    {[4, 6, 8, 12, 16].map(w => <option key={w} value={w}>{w} semaines</option>)}
                  </select>
                </label>
                <label className="field">Semaine de décharge
                  <select className="input" value={sched.deloadEvery} onChange={e => setSched({ ...sched, deloadEvery: Number(e.target.value) })}>
                    <option value={0}>Aucune</option>
                    {[4, 5, 6].map(w => <option key={w} value={w}>Toutes les {w} semaines</option>)}
                  </select>
                </label>
              </div>
              <div className="field">Jours d’entraînement ({weekdays.length}/{n})
                <Chips label="Jours d’entraînement" value={weekdays} onChange={toggleDay} options={DAYS_FR.map((d, i) => ({ value: i, label: d }))} />
              </div>
              <p className="small muted">
                Les séances suivent l’ordre du programme. La décharge réduit le volume d’environ 40 % et l’effort (2 reps en réserve de plus).
                Replanifier remplace les séances planifiées à partir de la date choisie.
                {weekdays.length === n && firstDates[0] !== sched.startDate && ' La première semaine peut être partielle.'}
              </p>
              <div><button className="btn primary" disabled={weekdays.length !== n} onClick={schedule}><Icon name="calendar" size={16} />Planifier {sched.weeks} semaines</button></div>
            </div>

            <ProgramView program={p}
              dayAction={d => <button className="btn sm" onClick={() => startDay(d)}><Icon name="play" size={14} />Démarrer</button>}
              exerciseAction={e => (
                <div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                  <button className="icon-btn" aria-label={`Une série de moins pour ${e.name}`} onClick={() => setSets(e, -1)}>−</button>
                  <button className="icon-btn" aria-label={`Une série de plus pour ${e.name}`} onClick={() => setSets(e, 1)}>+</button>
                  <button className="btn sm" onClick={() => setSwap(e)}>Remplacer</button>
                </div>
              )} />
          </div>
        );
      }}</Async>
      {swap && (
        <ExercisePicker title={`Remplacer ${swap.name}`} onClose={() => setSwap(null)} onPick={ex => guard(async () => {
          state.setData(await api<Program>('PATCH', `/programs/${id}/exercises/${swap.id}`, { exerciseId: ex.id }));
          setSwap(null);
        })} />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
