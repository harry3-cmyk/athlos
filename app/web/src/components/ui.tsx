import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Analysis, type Exercise, type Finding, type Group, type Muscle } from '../lib/api';
import { EQUIPMENT_FR, GROUP_FR, MUSCLE_FR, MUSCLES, fmtNum } from '../lib/format';

const GROUPS = [...MUSCLES, 'cardio'] as Group[];

const ICONS: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  dumbbell: 'M6.5 6.5v11M3 9v6M17.5 6.5v11M21 9v6M6.5 12h11',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  chart: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-7',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  body: 'M12 3a2 2 0 100 4 2 2 0 000-4zM6 9h12M12 9v6M9 21l3-6 3 6',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  trophy: 'M8 4h8v5a4 4 0 01-8 0zM8 6H4a4 4 0 004 4M16 6h4a4 4 0 01-4 4M12 13v4M8 20h8',
  play: 'M7 4l13 8-13 8z',
};
export function Icon({ name, size = 20 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Affiche chargement / erreur / contenu de façon uniforme. */
export function Async<T>({ state, children }: {
  state: { data: T | null; error: string | null; loading: boolean; reload: () => void }; children: (data: T) => ReactNode;
}) {
  if (state.error) {
    return <div className="alert error row between"><span>{state.error}</span><button className="btn sm" onClick={state.reload}>Réessayer</button></div>;
  }
  if (!state.data) return <div className="skeleton" aria-label="Chargement" />;
  return <>{children(state.data)}</>;
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return message ? <div className="toast" role="status">{message}</div> : null;
}

export function Chips<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T | T[]; onChange: (v: T) => void; label: string;
}) {
  const on = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(o => (
        <button type="button" key={String(o.value)} className="chip" aria-pressed={on(o.value)} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Sélecteur d'exercice : recherche, filtre par muscle, création d'un exercice personnalisé. */
export function ExercisePicker({ onPick, onClose, title = 'Ajouter un exercice' }: {
  onPick: (e: Exercise) => void; onClose: () => void; title?: string;
}) {
  const [all, setAll] = useState<Exercise[]>([]);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Group | ''>('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', muscle: 'chest' as Group, equipment: 'machine' });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Exercise[]>('GET', '/exercises').then(setAll).catch(e => setError(e.message)); }, []);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const shown = useMemo(
    () => all.filter(e => (!muscle || e.muscle === muscle) && norm(e.name).includes(norm(q))),
    [all, q, muscle]);

  const create = async () => {
    try {
      const e = await api<Exercise>('POST', '/exercises', { ...draft, compound: false });
      onPick(e);
    } catch (e: any) { setError(e.message); }
  };

  return (
    <Modal title={title} onClose={onClose}>
      {error && <div className="alert error" style={{ marginBottom: 10 }}>{error}</div>}
      {creating ? (
        <div className="stack">
          <label className="field">Nom<input className="input" autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <div className="form-grid">
            <label className="field">Muscle principal ou cardio
              <select className="input" value={draft.muscle} onChange={e => setDraft({ ...draft, muscle: e.target.value as Group })}>
                {GROUPS.map(m => <option key={m} value={m}>{GROUP_FR[m]}</option>)}
              </select>
            </label>
            <label className="field">Matériel
              <select className="input" value={draft.equipment} onChange={e => setDraft({ ...draft, equipment: e.target.value })}>
                {Object.entries(EQUIPMENT_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <button className="btn primary" disabled={draft.name.trim().length < 2} onClick={create}>Créer et ajouter</button>
            <button className="btn ghost" onClick={() => setCreating(false)}>Retour</button>
          </div>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 8 }}>
            <input className="input grow" placeholder="Rechercher…" autoFocus value={q} onChange={e => setQ(e.target.value)} aria-label="Rechercher un exercice" />
            <select className="input" style={{ width: 150 }} value={muscle} onChange={e => setMuscle(e.target.value as Group | '')} aria-label="Filtrer par muscle">
              <option value="">Tous</option>
              {GROUPS.map(m => <option key={m} value={m}>{GROUP_FR[m]}</option>)}
            </select>
          </div>
          {shown.map(e => (
            <button key={e.id} className="pick" onClick={() => onPick(e)}>
              <span><strong>{e.name}</strong>{e.custom && <span className="badge" style={{ marginLeft: 8 }}>Perso</span>}</span>
              <span className="small muted">{GROUP_FR[e.muscle]} · {EQUIPMENT_FR[e.equipment]}</span>
            </button>
          ))}
          {!shown.length && <p className="muted" style={{ padding: '14px 0' }}>Aucun exercice trouvé.</p>}
          <button className="btn block" style={{ marginTop: 14 }} onClick={() => { setDraft({ ...draft, name: q }); setCreating(true); }}>
            <Icon name="plus" size={16} /> Créer un exercice personnalisé
          </button>
        </>
      )}
    </Modal>
  );
}

/** Volume hebdomadaire par muscle : barres horizontales + repère (trait vertical). */
export function MuscleBars({ rows }: { rows: { muscle: Muscle; sets: number; floor?: number; frequency?: number }[] }) {
  const max = Math.max(12, ...rows.map(r => r.sets), ...rows.map(r => r.floor ?? 0)) * 1.05;
  return (
    <div className="hbars" role="table" aria-label="Séries hebdomadaires par muscle">
      {rows.map(r => {
        const low = r.floor != null && r.sets < r.floor;
        return (
          <div key={r.muscle} style={{ display: 'contents' }} role="row"
            title={`${MUSCLE_FR[r.muscle]} : ${fmtNum(r.sets)} séries/sem${r.frequency != null ? ` · ${fmtNum(r.frequency)}×/sem` : ''}`}>
            <span role="cell">{MUSCLE_FR[r.muscle]}</span>
            <div className="hbar-track" role="cell">
              <div className={`hbar-fill${low ? ' low' : ''}`} style={{ width: `${(r.sets / max) * 100}%` }} />
              {r.floor != null && <div className="hbar-ref" style={{ left: `${(r.floor / max) * 100}%` }} />}
            </div>
            <span className="num" role="cell" style={{ textAlign: 'right', fontWeight: 600 }}>
              {fmtNum(r.sets)}{low && <span className="muted" style={{ fontWeight: 400 }}> · bas</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
export const musclesForBars = (m: Analysis['muscles']) => m.map(x => ({ muscle: x.muscle, sets: x.weeklySets, floor: x.floor, frequency: x.frequency }));

const SEV = { high: ['!', 'Prioritaire'], medium: ['!', 'À corriger'], low: ['i', 'À surveiller'], good: ['✓', 'Point fort'] } as const;
export function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <div>
      {findings.map(f => (
        <div className="finding" key={f.id}>
          <div className={`sev ${f.severity}`} aria-hidden="true">{SEV[f.severity][0]}</div>
          <div>
            <div className="row" style={{ gap: 8 }}>
              <strong>{f.title}</strong>
              <span className="badge">{SEV[f.severity][1]} · {f.category}</span>
            </div>
            <p className="small muted" style={{ marginTop: 2 }}>{f.detail}</p>
            <p className="action">→ {f.action}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
