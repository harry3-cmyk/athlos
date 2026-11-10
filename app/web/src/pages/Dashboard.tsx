import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { BarsChart, TrendChart } from '../components/Charts';
import { Async, FindingList, Icon, MuscleBars, musclesForBars } from '../components/ui';
import { LOCAL, api, type Dashboard, type PrEvent, type Workout } from '../lib/api';
import { fmtKg, fmtNum, fmtShort, fmtVolume, relDay, todayStr, useData } from '../lib/format';

export function prLabel(r: PrEvent): string {
  if (r.type === 'weight') return `${fmtKg(r.value)} × ${r.reps} — charge record (avant : ${fmtKg(r.previous)})`;
  if (r.type === 'e1rm') return `1RM estimé ${fmtKg(r.value)} (${fmtNum(r.weight)} × ${r.reps}) — avant : ${fmtKg(r.previous)}`;
  return `${r.value} reps — record (avant : ${r.previous})`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const today = todayStr();
  const state = useData(() => api<Dashboard>('GET', `/dashboard?today=${today}`), [today]);

  const demo = async () => { await api('POST', '/local/demo', { today }); location.reload(); };
  const start = async (id: number) => {
    await api<Workout>('POST', `/workouts/${id}/start`, { date: today });
    nav(`/seances/${id}`);
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Bonjour{user.name ? ` ${user.name}` : ''}</h1><p>Ta semaine et tes tendances en un coup d’œil.</p></div>
        <Link className="btn" to="/seances"><Icon name="plus" size={16} />Nouvelle séance</Link>
      </div>
      <Async state={state}>{d => {
        const k = d.kpis;
        const next = d.planned[0];
        if (!k.totalWorkouts && !d.current && !next) {
          return (
            <div className="card empty">
              <h3>Bienvenue sur Forge</h3>
              <p>Commence par générer un programme adapté à ton objectif, ou enregistre directement une séance.</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <Link className="btn primary" to="/programmes">Créer mon programme</Link>
                <Link className="btn" to="/seances">Séance libre</Link>
                {LOCAL && <button className="btn" onClick={demo}>Voir avec des données d’exemple</button>}
              </div>
              {LOCAL && (
                <p className="small" style={{ marginTop: 16 }}>
                  Tes données restent sur cet appareil, dans ce navigateur : aucun compte, aucun serveur.
                  Pense à les exporter de temps en temps (Réglages → Mes données).
                </p>
              )}
            </div>
          );
        }
        return (
          <div className="stack">
            {(d.current || next) && (
              <div className="card row between">
                {d.current ? (
                  <>
                    <div><span className="badge accent">Séance en cours</span><h2 style={{ marginTop: 6 }}>{d.current.name}</h2></div>
                    <Link className="btn primary lg" to={`/seances/${d.current.id}`}><Icon name="play" size={16} />Reprendre</Link>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="badge">Prochaine séance · {relDay(next.date, today)}</span>
                      <h2 style={{ marginTop: 6 }}>{next.name}</h2>
                    </div>
                    <div className="row">
                      <Link className="btn" to={`/seances/${next.id}`}>Voir</Link>
                      <button className="btn primary lg" onClick={() => start(next.id)}><Icon name="play" size={16} />Démarrer</button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid cols-4">
              <div className="card stat">
                <div className="label">Séances cette semaine</div>
                <div className="value">{k.sessionsThisWeek}</div>
                <div className="hint">{k.sessions28} sur 28 jours</div>
              </div>
              <div className="card stat">
                <div className="label">Volume cette semaine</div>
                <div className="value">{fmtVolume(k.volumeThisWeek)}</div>
                <div className="hint">{k.volumeLastWeek > 0 ? `Semaine dernière : ${fmtVolume(k.volumeLastWeek)}` : 'Pas de semaine précédente'}</div>
              </div>
              <div className="card stat">
                <div className="label">Régularité</div>
                <div className="value">{k.streakWeeks} <small>sem. d’affilée</small></div>
                <div className="hint">{k.totalWorkouts} séances au total</div>
              </div>
              <div className="card stat">
                <div className="label">Poids (tendance)</div>
                <div className="value">{k.weight ? fmtNum(k.weight.trend ?? k.weight.value) : '—'} <small>kg</small></div>
                <div className="hint">
                  {k.weight?.delta28 != null ? `${k.weight.delta28 > 0 ? '+' : ''}${fmtNum(k.weight.delta28)} kg en 28 jours` : <Link to="/corps">Ajouter une pesée</Link>}
                </div>
              </div>
            </div>

            <div className="grid cols-2">
              <div className="card">
                <div className="card-head"><h2>Volume hebdomadaire</h2><span className="small muted">kg soulevés · 12 semaines</span></div>
                <BarsChart data={d.weekly} xKey="week" yKey="volume" label="Volume" unit="kg" fmtX={w => `Sem. du ${fmtShort(w)}`}
                  fmtY={v => (v >= 1000 ? `${fmtNum(v / 1000)} t` : fmtNum(v))} />
              </div>
              <div className="card">
                <div className="card-head"><h2>Séries par muscle</h2><span className="small muted">moyenne hebdo · 28 jours · trait = repère</span></div>
                <MuscleBars rows={musclesForBars(d.muscles)} />
              </div>
            </div>

            <div className="grid cols-2">
              <div className="card">
                <div className="card-head"><h2>Points à travailler</h2><Link className="small" to="/analyse">Analyse complète</Link></div>
                {d.findings.length ? <FindingList findings={d.findings} /> : <p className="muted">Aucun point faible détecté pour l’instant.</p>}
              </div>
              <div className="card">
                <div className="card-head"><h2>Records récents</h2><Link className="small" to="/progression">Progression</Link></div>
                {d.records.length ? (
                  <div className="list">
                    {d.records.map((r, i) => (
                      <Link key={i} className="list-item" to={`/progression?exercice=${r.exerciseId}`}>
                        <span style={{ color: 'var(--warning)' }}><Icon name="trophy" /></span>
                        <div className="grow"><div className="title">{r.name}</div><div className="sub">{prLabel(r)}</div></div>
                        <span className="small muted">{fmtShort(r.date)}</span>
                      </Link>
                    ))}
                  </div>
                ) : <p className="muted">Pas de record sur les 30 derniers jours.</p>}
              </div>
            </div>

            {d.weightSeries.length >= 2 && (
              <div className="card">
                <div className="card-head"><h2>Poids</h2><Link className="small" to="/corps">Détail</Link></div>
                <TrendChart small unit="kg" data={d.weightSeries} series={[
                  { key: 'weight', label: 'Pesées', color: 'var(--line-strong)', dots: true },
                  { key: 'trend', label: 'Tendance', color: 'var(--series-1)' },
                ]} />
              </div>
            )}
          </div>
        );
      }}</Async>
    </>
  );
}
