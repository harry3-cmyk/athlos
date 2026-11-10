import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { Async, FindingList, MuscleBars, musclesForBars } from '../components/ui';
import { api, type Analysis } from '../lib/api';
import { GOAL_FR, fmtKg, fmtNum, todayStr, useData } from '../lib/format';

export default function AnalysisPage() {
  const { user } = useAuth();
  const today = todayStr();
  const state = useData(() => api<Analysis>('GET', `/analysis?today=${today}`), [today]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Points faibles</h1>
          <p>Analyse automatique de tes 4 à 12 dernières semaines, pour l’objectif « {GOAL_FR[user.goal]} » (<Link to="/reglages">modifier</Link>).</p>
        </div>
      </div>
      <Async state={state}>{a => {
        const issues = a.findings.filter(f => f.severity !== 'good');
        const strengths = a.findings.filter(f => f.severity === 'good');
        const showCardio = a.cardio.minutesPerWeek > 0 || user.goal === 'tactical' || user.goal === 'athletic';
        return (
          <div className="stack">
            <div className={`grid ${showCardio ? 'cols-4' : 'cols-3'}`}>
              {showCardio && (
                <div className="card stat">
                  <div className="label">Endurance</div>
                  <div className="value">{a.cardio.minutesPerWeek} <small>min/sem</small></div>
                  <div className="hint">{fmtNum(a.cardio.sessionsPerWeek)} séance(s) · {fmtNum(a.cardio.kmPerWeek)} km par semaine</div>
                </div>
              )}
              <div className="card stat">
                <div className="label">Séances par semaine</div>
                <div className="value">{fmtNum(a.consistency.perWeek)}</div>
                <div className="hint">moyenne sur 28 jours</div>
              </div>
              <div className="card stat">
                <div className="label">Assiduité au planning</div>
                <div className="value">{a.consistency.adherence != null ? `${a.consistency.adherence} %` : a.dataQuality.sessions28 ? '100 %' : '—'}</div>
                <div className="hint">séances planifiées réalisées</div>
              </div>
              <div className="card stat">
                <div className="label">Tendance du poids</div>
                <div className="value">{a.weightTrend ? <>{a.weightTrend.kgPerWeek > 0 ? '+' : ''}{fmtNum(a.weightTrend.kgPerWeek)} <small>kg/sem</small></> : '—'}</div>
                <div className="hint">{a.weightTrend ? `${a.weightTrend.pctPerWeek > 0 ? '+' : ''}${fmtNum(a.weightTrend.pctPerWeek)} % par semaine` : 'au moins 4 pesées sur 10 jours'}</div>
              </div>
            </div>

            <div className="card">
              <h2>À corriger en priorité</h2>
              {issues.length ? <FindingList findings={issues} /> : <p className="muted">Rien à signaler : entraînement équilibré et en progression.</p>}
            </div>
            {strengths.length > 0 && <div className="card"><h2>Points forts</h2><FindingList findings={strengths} /></div>}

            <div className="grid cols-2">
              <div className="card">
                <div className="card-head"><h2>Volume par muscle</h2><span className="small muted">séries/sem · trait = repère</span></div>
                <MuscleBars rows={musclesForBars(a.muscles)} />
              </div>
              <div className="stack">
                <div className="card">
                  <h2>Équilibres</h2>
                  <table className="table">
                    <thead><tr><th>Rapport</th><th className="r">Séries (28 j)</th><th className="r">Rapport</th></tr></thead>
                    <tbody>
                      {a.balance.map(b => (
                        <tr key={b.label}><td>{b.label}</td><td className="num r">{b.aSets} / {b.bSets}</td><td className="num r">{b.ratio != null ? fmtNum(Math.round(b.ratio * 100) / 100) : '—'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card">
                  <h2>Rapports de force</h2>
                  {a.ratios.length ? (
                    <table className="table">
                      <thead><tr><th>Mouvements</th><th className="r">1RM estimés</th><th className="r">Rapport</th><th className="r">Habituel</th></tr></thead>
                      <tbody>
                        {a.ratios.map(r => (
                          <tr key={r.label}>
                            <td>{r.label}</td>
                            <td className="num r">{fmtKg(r.a)} / {fmtKg(r.b)}</td>
                            <td className="num r"><strong>{r.value.toFixed(2).replace('.', ',')}</strong></td>
                            <td className="num r muted">{String(r.low).replace('.', ',')}–{String(r.high).replace('.', ',')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="muted">Enregistre au moins deux mouvements de base à la barre (squat, développé couché, soulevé de terre, développé militaire, rowing) pour comparer.</p>}
                </div>
              </div>
            </div>

            {a.trends.length > 0 && (
              <div className="card">
                <div className="card-head"><h2>Tendance de force par exercice</h2><span className="small muted">8 semaines · 4 séances minimum</span></div>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Exercice</th><th className="r">Séances</th><th className="r">Meilleur 1RM estimé</th><th className="r">Évolution / semaine</th></tr></thead>
                    <tbody>
                      {[...a.trends].reverse().map(t => (
                        <tr key={t.exerciseId}>
                          <td><Link to={`/progression?exercice=${t.exerciseId}`}>{t.name}</Link></td>
                          <td className="num r">{t.sessions}</td>
                          <td className="num r">{fmtKg(t.best)}</td>
                          <td className="num r"><span className={t.pctPerWeek >= 0.15 ? 'delta-up' : t.pctPerWeek <= -0.5 ? 'delta-down' : 'muted'}>
                            {t.pctPerWeek >= 0.15 ? '▲' : t.pctPerWeek <= -0.5 ? '▼' : '='} {t.pctPerWeek > 0 ? '+' : ''}{fmtNum(t.pctPerWeek)} %</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p className="small muted">
              Méthode : volume = séries de travail validées (muscle principal 1, secondaire 0,5) ; force = 1RM estimé (Epley).
              Les seuils (repère de volume, rapports de force, équilibres) sont des repères pratiques d’entraîneurs, pas des normes médicales :
              ils signalent où regarder, pas un diagnostic. Une douleur persistante relève d’un professionnel de santé.
            </p>
          </div>
        );
      }}</Async>
    </>
  );
}
