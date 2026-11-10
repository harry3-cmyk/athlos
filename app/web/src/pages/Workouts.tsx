import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Async, Icon } from '../components/ui';
import { api, type Workout, type WorkoutSummary } from '../lib/api';
import { fmtFull, fmtVolume, relDay, todayStr, useData } from '../lib/format';

export default function WorkoutsPage() {
  const nav = useNavigate();
  const today = todayStr();
  const state = useData(() => api<WorkoutSummary[]>('GET', '/workouts?limit=300'), []);
  const [error, setError] = useState<string | null>(null);

  const freeSession = async () => {
    try {
      const w = await api<Workout>('POST', '/workouts', { name: 'Séance libre', date: today, status: 'in_progress', exercises: [] });
      nav(`/seances/${w.id}`);
    } catch (e: any) { setError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Séances</h1><p>Enregistre une séance et retrouve ton historique.</p></div>
        <div className="row">
          <Link className="btn" to="/programmes">Depuis un programme</Link>
          <button className="btn primary" onClick={freeSession}><Icon name="plus" size={16} />Séance libre</button>
        </div>
      </div>
      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}
      <Async state={state}>{all => {
        const current = all.filter(w => w.status === 'in_progress');
        const upcoming = all.filter(w => w.status === 'planned' && w.date >= today).reverse().slice(0, 4);
        const done = all.filter(w => w.status === 'done');
        return (
          <div className="stack">
            {current.length > 0 && (
              <div className="card">
                <h2>En cours</h2>
                <div className="list">
                  {current.map(w => (
                    <Link key={w.id} to={`/seances/${w.id}`} className="list-item">
                      <div className="grow"><div className="title">{w.name}</div><div className="sub">{relDay(w.date, today)} · {w.setCount} série(s) validée(s)</div></div>
                      <span className="btn primary sm">Reprendre</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="card">
                <div className="card-head"><h2>À venir</h2><Link className="small" to="/planning">Planning</Link></div>
                <div className="list">
                  {upcoming.map(w => (
                    <Link key={w.id} to={`/seances/${w.id}`} className="list-item">
                      <div className="grow"><div className="title">{w.name}</div><div className="sub">{relDay(w.date, today)} · {w.exerciseCount} exercices</div></div>
                      <Icon name="right" size={16} />
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div className="card">
              <h2>Historique</h2>
              {done.length ? (
                <div className="list">
                  {done.map(w => (
                    <Link key={w.id} to={`/seances/${w.id}`} className="list-item">
                      <div className="grow">
                        <div className="title">{w.name}</div>
                        <div className="sub">{fmtFull(w.date)} · {w.exerciseCount} exercices · {w.setCount} séries{w.minutes ? ` · ${w.minutes} min` : ''}</div>
                      </div>
                      <span className="num small" style={{ fontWeight: 600 }}>{fmtVolume(w.volume)}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <h3>Aucune séance terminée</h3>
                  <p>Lance une séance libre ou génère un programme pour démarrer.</p>
                </div>
              )}
            </div>
          </div>
        );
      }}</Async>
    </>
  );
}
