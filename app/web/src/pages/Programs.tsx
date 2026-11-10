import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { ProgramView } from '../components/ProgramView';
import { Async, Chips } from '../components/ui';
import { api, type GenConfig, type Muscle, type Program, type ProgramSummary } from '../lib/api';
import { GOAL_FR, MUSCLE_FR, MUSCLES, fmtFull, useData } from '../lib/format';

export default function ProgramsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const list = useData(() => api<ProgramSummary[]>('GET', '/programs'), []);
  const [cfg, setCfg] = useState<GenConfig>({ goal: user.goal, days: 4, level: 'intermediate', equipment: 'gym', minutes: 60, priorities: [] });
  const [preview, setPreview] = useState<Program | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (p: Partial<GenConfig>) => { setCfg({ ...cfg, ...p }); setPreview(null); };
  const togglePriority = (m: Muscle) => {
    const has = cfg.priorities.includes(m);
    if (!has && cfg.priorities.length >= 3) return;
    patch({ priorities: has ? cfg.priorities.filter(x => x !== m) : [...cfg.priorities, m] });
  };
  const run = async (save: boolean) => {
    setBusy(true); setError(null);
    try {
      if (save) nav(`/programmes/${(await api<Program>('POST', '/programs', { config: cfg })).id}`);
      else setPreview(await api<Program>('POST', '/programs/generate', cfg));
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Programmes</h1><p>Un programme construit sur ton objectif, ton emploi du temps et ton matériel.</p></div>
      </div>
      <div className="stack">
        <Async state={list}>{programs => programs.length ? (
          <div className="card">
            <h2>Mes programmes</h2>
            <div className="list">
              {programs.map(p => (
                <Link className="list-item" key={p.id} to={`/programmes/${p.id}`}>
                  <div className="grow">
                    <div className="title">{p.name}</div>
                    <div className="sub">{GOAL_FR[p.goal]} · {p.days} séances/sem · créé le {fmtFull(p.createdAt.slice(0, 10))}</div>
                  </div>
                  {p.planned > 0 && <span className="badge accent">{p.planned} planifiées</span>}
                </Link>
              ))}
            </div>
          </div>
        ) : null}</Async>

        <div className="card stack">
          <div>
            <h2>Générer un programme</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              Le générateur applique les principes partagés par la recherche et les entraîneurs de haut niveau (volume, fréquence, intensité, progression).
              Il ne copie pas la routine d’un champion : elle est calibrée pour sa récupération, pas pour la tienne.
            </p>
          </div>
          <div className="field">Objectif
            <Chips label="Objectif" value={cfg.goal} onChange={goal => patch({ goal })}
              options={(Object.keys(GOAL_FR) as GenConfig['goal'][]).map(g => ({ value: g, label: GOAL_FR[g] }))} />
          </div>
          <div className="field">Séances par semaine
            <Chips label="Séances par semaine" value={cfg.days} onChange={days => patch({ days })} options={[2, 3, 4, 5, 6].map(d => ({ value: d, label: String(d) }))} />
          </div>
          <div className="field">Niveau
            <Chips label="Niveau" value={cfg.level} onChange={level => patch({ level })} options={[
              { value: 'beginner', label: 'Débutant (< 1 an)' }, { value: 'intermediate', label: 'Intermédiaire' }, { value: 'advanced', label: 'Avancé (> 3 ans)' }]} />
          </div>
          <div className="field">Matériel
            <Chips label="Matériel" value={cfg.equipment} onChange={equipment => patch({ equipment })} options={[
              { value: 'gym', label: 'Salle complète' }, { value: 'dumbbells', label: 'Haltères + banc' }, { value: 'bodyweight', label: 'Poids du corps' }]} />
          </div>
          <div className="field">Durée par séance
            <Chips label="Durée par séance" value={cfg.minutes} onChange={minutes => patch({ minutes })} options={[45, 60, 75, 90].map(m => ({ value: m, label: `${m} min` }))} />
          </div>
          <div className="field">Muscles prioritaires (3 max, facultatif)
            <Chips label="Muscles prioritaires" value={cfg.priorities} onChange={togglePriority} options={MUSCLES.map(m => ({ value: m, label: MUSCLE_FR[m] }))} />
          </div>
          {error && <div className="alert error">{error}</div>}
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={() => run(false)}>Générer l’aperçu</button>
            {preview && <button className="btn" disabled={busy} onClick={() => run(true)}>Enregistrer ce programme</button>}
          </div>
        </div>

        {preview && (
          <>
            <h2>Aperçu — {preview.name}</h2>
            <ProgramView program={preview} />
            <div><button className="btn primary lg" disabled={busy} onClick={() => run(true)}>Enregistrer ce programme</button></div>
          </>
        )}
      </div>
    </>
  );
}
