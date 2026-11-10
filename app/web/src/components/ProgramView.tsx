import type { ReactNode } from 'react';
import type { Program, ProgramDay, ProgramExercise } from '../lib/api';
import { GROUP_FR, fmtRest } from '../lib/format';
import { MuscleBars } from './ui';

const ROLE_FR: Record<string, string> = {
  main: 'Principal', secondary: 'Secondaire', accessory: 'Accessoire', power: 'Explosif', endurance: 'Endurance musculaire', carry: 'Porté', cardio: 'Endurance',
};
const range = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);

/** Affichage d'un programme (aperçu du générateur ou programme enregistré). */
export function ProgramView({ program, dayAction, exerciseAction }: {
  program: Program;
  dayAction?: (d: ProgramDay) => ReactNode;
  exerciseAction?: (e: ProgramExercise, d: ProgramDay) => ReactNode;
}) {
  const r = program.rationale;
  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="badge accent">{r.split}</span>
        </div>
        <p>{r.summary}</p>
        {r.warnings.map((w, i) => <div className="alert" key={i} style={{ marginTop: 10 }}>⚠ {w}</div>)}
      </div>

      <div className="grid cols-2">
        {program.days.map((d, i) => (
          <div className="card" key={d.id ?? i}>
            <div className="card-head">
              <div><h2>{d.name}</h2><div className="small muted">{d.focus} · ≈ {d.estMinutes} min</div></div>
              {dayAction?.(d)}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Exercice</th><th>Séries × reps</th><th>RIR</th><th>Repos</th>{exerciseAction && <th />}</tr></thead>
                <tbody>
                  {d.exercises.map((e, j) => (
                    <tr key={e.id ?? j}>
                      <td><strong>{e.name}</strong><div className="small muted">{e.muscle === 'cardio' ? ROLE_FR.cardio : `${GROUP_FR[e.muscle]} · ${ROLE_FR[e.role] ?? e.role}`}</div></td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{e.sets} × {range(e.repsMin, e.repsMax)}{e.muscle === 'cardio' ? ' min' : e.role === 'carry' ? ' m' : ''}</td>
                      <td className="num">{e.muscle === 'cardio' ? '—' : e.rir}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtRest(e.restSec)}</td>
                      {exerciseAction && <td className="r">{exerciseAction(e, d)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head"><h2>Séries hebdomadaires par muscle</h2><span className="small muted">trait = repère</span></div>
          <MuscleBars rows={program.weeklySets.map(w => ({ ...w, floor: ['hypertrophy', 'powerbuilding', 'hybrid'].includes(program.goal) && program.config.level !== 'beginner' ? 10 : 6 }))} />
          <p className="source">Muscle principal = 1 série, muscle secondaire = 0,5 série ; l’endurance n’est pas comptée ici. RIR = répétitions en réserve avant l’échec.</p>
        </div>
        <div className="card">
          <h2>Pourquoi ce programme</h2>
          {r.principles.map(p => (
            <details className="principle" key={p.title}>
              <summary>{p.title}</summary>
              <p>{p.text}</p>
              <div className="source">Source : {p.source}</div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
