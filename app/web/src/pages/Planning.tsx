import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Async, Icon, Modal } from '../components/ui';
import { api, type Program, type ProgramSummary, type Workout, type WorkoutSummary } from '../lib/api';
import { DAYS_FR, addDays, fmtLong, fmtMonth, todayStr, useData, weekStart } from '../lib/format';

const STATUS_FR = { planned: 'Planifiée', in_progress: 'En cours', done: 'Terminée', missed: 'Manquée' } as const;

function PlanModal({ date, onClose }: { date: string; onClose: () => void }) {
  const nav = useNavigate();
  const [programs, setPrograms] = useState<ProgramSummary[] | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<ProgramSummary[]>('GET', '/programs').then(ps => {
      setPrograms(ps);
      if (ps[0]) api<Program>('GET', `/programs/${ps[0].id}`).then(setProgram);
    }).catch(e => setError(e.message));
  }, []);
  const fromDay = async (dayId: number) => {
    try {
      const w = await api<Workout>('POST', `/programs/${program!.id}/days/${dayId}/start`, { date });
      nav(`/seances/${w.id}`);
    } catch (e: any) { setError(e.message); }
  };
  const empty = async () => {
    try {
      const w = await api<Workout>('POST', '/workouts', { name: 'Séance libre', date, status: date <= todayStr() ? 'in_progress' : 'planned', exercises: [] });
      nav(`/seances/${w.id}`);
    } catch (e: any) { setError(e.message); }
  };
  return (
    <Modal title={`Ajouter une séance — ${fmtLong(date)}`} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      {programs && programs.length > 0 && (
        <>
          <select className="input" style={{ marginBottom: 8 }} aria-label="Programme" value={program?.id ?? ''}
            onChange={e => api<Program>('GET', `/programs/${e.target.value}`).then(setProgram)}>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {program?.days.map(d => (
            <button key={d.id} className="pick" onClick={() => fromDay(d.id!)}>
              <strong>{d.name}</strong><span className="small muted">{d.exercises.length} exercices · ≈ {d.estMinutes} min</span>
            </button>
          ))}
        </>
      )}
      {programs && !programs.length && <p className="muted">Aucun programme enregistré. <Link to="/programmes">Générer un programme</Link></p>}
      <button className="btn block" style={{ marginTop: 14 }} onClick={empty}>
        <Icon name="plus" size={16} />{date <= todayStr() ? 'Saisir une séance libre à cette date' : 'Planifier une séance libre'}
      </button>
    </Modal>
  );
}

export default function PlanningPage() {
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 7) + '-01');
  const [adding, setAdding] = useState<string | null>(null);
  const first = weekStart(month);
  const nextMonth = (() => { const [y, m] = month.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; })();
  const prevMonth = (() => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`; })();
  const weeks = Math.ceil((Date.parse(nextMonth) - Date.parse(first)) / (7 * 86400000));
  const last = addDays(first, weeks * 7 - 1);
  const state = useData(() => api<WorkoutSummary[]>('GET', `/workouts?from=${first}&to=${last}&limit=500`), [first, last]);
  const kind = (w: WorkoutSummary) => (w.status === 'planned' && w.date < today ? 'missed' : w.status);

  return (
    <>
      <div className="page-head">
        <div><h1>Planning</h1><p>Clique sur un jour pour ajouter une séance, sur une séance pour l’ouvrir.</p></div>
        <div className="row">
          <button className="icon-btn" onClick={() => setMonth(prevMonth)} aria-label="Mois précédent"><Icon name="left" /></button>
          <strong className="cap" style={{ minWidth: 130, textAlign: 'center' }}>{fmtMonth(month)}</strong>
          <button className="icon-btn" onClick={() => setMonth(nextMonth)} aria-label="Mois suivant"><Icon name="right" /></button>
          <button className="btn sm" onClick={() => setMonth(today.slice(0, 7) + '-01')}>Aujourd’hui</button>
        </div>
      </div>
      <Async state={state}>{workouts => {
        const byDate = new Map<string, WorkoutSummary[]>();
        for (const w of [...workouts].reverse()) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
        const inMonth = [...workouts].reverse().filter(w => w.date >= month && w.date < nextMonth);
        return (
          <div className="stack">
            <div className="cal">
              {DAYS_FR.map(d => <div className="cal-dow" key={d}>{d}</div>)}
              {Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i)).map(date => (
                <div key={date} role="button" tabIndex={0} aria-label={`Ajouter une séance le ${fmtLong(date)}`}
                  className={`cal-day${date.slice(0, 7) !== month.slice(0, 7) ? ' out' : ''}${date === today ? ' today' : ''}`}
                  onClick={() => setAdding(date)} onKeyDown={e => e.key === 'Enter' && setAdding(date)}>
                  <span className="d">{Number(date.slice(8))}</span>
                  {(byDate.get(date) ?? []).map(w => (
                    <Link key={w.id} to={`/seances/${w.id}`} className={`cal-ev ${kind(w)}`} title={`${w.name} — ${STATUS_FR[kind(w)]}`} onClick={e => e.stopPropagation()}>
                      {w.name}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--series-1)', height: 10, width: 10, borderRadius: 3 }} />Terminée</span>
              <span><i style={{ background: 'var(--series-2)', height: 10, width: 10, borderRadius: 3 }} />En cours</span>
              <span><i style={{ border: '1px dashed var(--line-strong)', height: 10, width: 10, borderRadius: 3 }} />Planifiée</span>
              <span><i style={{ border: '1px dashed var(--critical)', height: 10, width: 10, borderRadius: 3 }} />Manquée</span>
            </div>
            <div className="card">
              <h2 className="cap">{fmtMonth(month)}</h2>
              {inMonth.length ? (
                <div className="list">
                  {inMonth.map(w => (
                    <Link key={w.id} to={`/seances/${w.id}`} className="list-item">
                      <div className="grow">
                        <div className="title">{w.name}</div>
                        <div className="sub cap" style={{ display: 'block' }}>{fmtLong(w.date)}</div>
                      </div>
                      <span className={`badge${w.status === 'done' ? ' accent' : ''}`} style={kind(w) === 'missed' ? { color: 'var(--critical)' } : undefined}>{STATUS_FR[kind(w)]}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty"><h3>Rien de prévu ce mois-ci</h3><p>Planifie un programme sur plusieurs semaines en quelques clics.</p>
                  <Link className="btn primary" to="/programmes">Voir les programmes</Link></div>
              )}
            </div>
          </div>
        );
      }}</Async>
      {adding && <PlanModal date={adding} onClose={() => setAdding(null)} />}
    </>
  );
}
