import { Link, useSearchParams } from 'react-router-dom';
import { BarsChart, TrendChart } from '../components/Charts';
import { Async } from '../components/ui';
import { api, type CardioHistory, type ExerciseHistory, type RecordRow } from '../lib/api';
import { MUSCLE_FR, fmtFull, fmtKg, fmtNum, fmtSet, fmtVolume, useData } from '../lib/format';

function ExerciseDetail({ id, name }: { id: number; name: string }) {
  const state = useData(() => api<ExerciseHistory | CardioHistory>('GET', `/exercises/${id}/history`), [id]);
  return (
    <Async state={state}>{h => {
      if (h.cardio) {
        const total = h.sessions.reduce((s, x) => s + x.minutes, 0);
        return (
          <div className="stack">
            <div className="grid cols-2">
              <div className="card">
                <div className="card-head"><h2>Durée par séance</h2><span className="small muted">minutes · {h.sessions.length} séances, {fmtNum(Math.round(total / 6) / 10)} h au total</span></div>
                <BarsChart data={h.sessions} yKey="minutes" label="Durée" unit="min" />
              </div>
              {h.sessions.some(s => s.km > 0) && (
                <div className="card">
                  <div className="card-head"><h2>Distance par séance</h2><span className="small muted">km</span></div>
                  <BarsChart data={h.sessions} yKey="km" label="Distance" unit="km" />
                </div>
              )}
            </div>
            <div className="card">
              <h2>Historique — {name}</h2>
              <table className="table">
                <thead><tr><th>Date</th><th className="r">Durée</th><th className="r">Distance</th><th className="r">Allure</th></tr></thead>
                <tbody>
                  {[...h.sessions].reverse().slice(0, 30).map(s => (
                    <tr key={s.workoutId}>
                      <td><Link to={`/seances/${s.workoutId}`}>{fmtFull(s.date)}</Link></td>
                      <td className="num r">{s.minutes} min</td>
                      <td className="num r">{s.km > 0 ? `${fmtNum(s.km)} km` : '—'}</td>
                      <td className="num r">{s.km > 0 ? `${Math.floor(s.minutes / s.km)}:${String(Math.round(((s.minutes / s.km) % 1) * 60)).padStart(2, '0')} /km` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
      if (!h.records) return <div className="card empty"><h3>Pas encore d’historique</h3><p>Les graphiques apparaîtront après ta première séance sur cet exercice.</p></div>;
      const loaded = h.records.weight.value > 0;
      const first = h.sessions[0], last = h.sessions[h.sessions.length - 1];
      const gain = loaded && first.e1rm > 0 && h.sessions.length > 1 ? ((last.e1rm - first.e1rm) / first.e1rm) * 100 : null;
      const repsData = h.sessions.map(s => ({ date: s.date, reps: Math.max(...s.sets.map(x => x.reps)) }));
      return (
        <div className="stack">
          <div className="grid cols-3">
            <div className="card stat">
              <div className="label">{loaded ? '1RM estimé (record)' : 'Répétitions (record)'}</div>
              <div className="value">{loaded ? fmtNum(h.records.e1rm.value) : Math.max(...repsData.map(r => r.reps))} <small>{loaded ? 'kg' : 'reps'}</small></div>
              <div className="hint">{loaded ? fmtFull(h.records.e1rm.date) : `${h.sessions.length} séances`}</div>
            </div>
            <div className="card stat">
              <div className="label">Charge la plus lourde</div>
              <div className="value">{loaded ? fmtNum(h.records.weight.value) : '—'} <small>{loaded ? `kg × ${h.records.weight.reps}` : 'poids du corps'}</small></div>
              <div className="hint">{loaded ? fmtFull(h.records.weight.date) : ''}</div>
            </div>
            <div className="card stat">
              <div className="label">Évolution du 1RM estimé</div>
              <div className="value">{gain == null ? '—' : <span className={gain >= 0 ? 'delta-up' : 'delta-down'}>{gain >= 0 ? '+' : ''}{fmtNum(gain)} %</span>}</div>
              <div className="hint">{h.sessions.length} séances depuis le {fmtFull(first.date)}</div>
            </div>
          </div>
          <div className="grid cols-2">
            <div className="card">
              <div className="card-head"><h2>{loaded ? '1RM estimé' : 'Meilleure série (reps)'}</h2><span className="small muted">{loaded ? 'kg · meilleure série de chaque séance' : 'par séance'}</span></div>
              {loaded
                ? <TrendChart data={h.sessions} unit="kg" series={[{ key: 'e1rm', label: '1RM estimé', color: 'var(--series-1)' }]} />
                : <TrendChart data={repsData} unit="reps" series={[{ key: 'reps', label: 'Répétitions', color: 'var(--series-1)' }]} />}
            </div>
            {loaded && (
              <div className="card">
                <div className="card-head"><h2>Volume par séance</h2><span className="small muted">kg (charge × reps)</span></div>
                <BarsChart data={h.sessions} yKey="volume" label="Volume" unit="kg" />
              </div>
            )}
          </div>
          <div className="card">
            <h2>Historique — {name}</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Séries</th><th className="r">1RM estimé</th><th className="r">Volume</th></tr></thead>
                <tbody>
                  {[...h.sessions].reverse().slice(0, 30).map(s => (
                    <tr key={s.workoutId}>
                      <td style={{ whiteSpace: 'nowrap' }}><Link to={`/seances/${s.workoutId}`}>{fmtFull(s.date)}</Link></td>
                      <td className="num">{s.sets.map(fmtSet).join(' · ')}</td>
                      <td className="num r">{loaded ? fmtKg(s.e1rm) : '—'}</td>
                      <td className="num r">{loaded ? fmtVolume(s.volume) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="source">1RM estimé : formule d’Epley (charge × (1 + reps/30)), plafonnée à 12 répétitions. C’est une estimation, pas un maximum testé.</p>
          </div>
        </div>
      );
    }}</Async>
  );
}

export default function ProgressPage() {
  const [params, setParams] = useSearchParams();
  const records = useData(() => api<RecordRow[]>('GET', '/records'), []);
  return (
    <>
      <div className="page-head"><div><h1>Progression</h1><p>Charges, répétitions et records, exercice par exercice.</p></div></div>
      <Async state={records}>{rows => {
        if (!rows.length) {
          return <div className="card empty"><h3>Pas encore de données</h3><p>Termine une première séance pour voir ta progression.</p><Link className="btn primary" to="/seances">Aller aux séances</Link></div>;
        }
        const selected = Number(params.get('exercice')) || rows[0].exerciseId;
        const current = rows.find(r => r.exerciseId === selected);
        return (
          <div className="stack">
            <label className="field" style={{ maxWidth: 420 }}>Exercice
              <select className="input" value={selected} onChange={e => setParams({ exercice: e.target.value }, { replace: true })}>
                {!current && <option value={selected}>Exercice sans historique</option>}
                {rows.map(r => <option key={r.exerciseId} value={r.exerciseId}>{r.name} ({r.sessions} séances)</option>)}
              </select>
            </label>
            <ExerciseDetail id={selected} name={current?.name ?? ''} />
            <div className="card">
              <h2>Tous les records</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Exercice</th><th>Muscle</th><th className="r">Meilleure charge</th><th className="r">1RM estimé</th><th className="r">Séances</th></tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.exerciseId}>
                        <td><a href="#" onClick={e => { e.preventDefault(); setParams({ exercice: String(r.exerciseId) }); window.scrollTo({ top: 0 }); }}>{r.name}</a></td>
                        <td className="muted">{MUSCLE_FR[r.muscle]}</td>
                        <td className="num r">{r.weight > 0 ? `${fmtNum(r.weight)} kg × ${r.reps}` : `${r.maxReps} reps`}</td>
                        <td className="num r">{r.weight > 0 ? fmtKg(r.e1rm) : '—'}</td>
                        <td className="num r">{r.sessions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }}</Async>
    </>
  );
}
