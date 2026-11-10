import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { TrendChart } from '../components/Charts';
import { Async, Icon } from '../components/ui';
import { api, type BodyRow } from '../lib/api';
import { fmtFull, fmtNum, todayStr, useData } from '../lib/format';

const FIELDS = [
  ['weightKg', 'Poids (kg)'], ['bodyFatPct', 'Masse grasse (%)'], ['waistCm', 'Tour de taille (cm)'], ['neckCm', 'Tour de cou (cm)'],
  ['hipCm', 'Hanches (cm)'], ['chestCm', 'Poitrine (cm)'], ['armCm', 'Bras (cm)'], ['thighCm', 'Cuisse (cm)'],
] as const;
type Key = (typeof FIELDS)[number][0];

export default function BodyPage() {
  const { user } = useAuth();
  const state = useData(() => api<BodyRow[]>('GET', '/body'), []);
  const [date, setDate] = useState(todayStr());
  const [form, setForm] = useState<Record<Key, string>>(Object.fromEntries(FIELDS.map(f => [f[0], ''])) as Record<Key, string>);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: Record<string, unknown> = { date };
    for (const [k] of FIELDS) body[k] = form[k].trim() === '' ? null : Number(form[k].replace(',', '.'));
    if (FIELDS.every(([k]) => body[k] == null)) { setError('Renseigne au moins une mesure.'); return; }
    if (FIELDS.some(([k]) => body[k] != null && !Number.isFinite(body[k]))) { setError('Une valeur n’est pas un nombre valide.'); return; }
    try {
      state.setData(await api<BodyRow[]>('POST', '/body', body));
      setForm(Object.fromEntries(FIELDS.map(f => [f[0], ''])) as Record<Key, string>);
    } catch (err: any) { setError(err.message); }
  };
  const remove = async (id: number) => {
    if (confirm('Supprimer cette mesure ?')) state.setData(await api<BodyRow[]>('DELETE', `/body/${id}`));
  };
  const shown = more ? FIELDS : FIELDS.slice(0, 4);

  return (
    <>
      <div className="page-head"><div><h1>Poids & composition</h1><p>Pèse-toi dans les mêmes conditions (au réveil) : la tendance compte plus qu’une pesée isolée.</p></div></div>
      <div className="stack">
        <form className="card stack" onSubmit={submit}>
          <h2>Nouvelle mesure</h2>
          <div className="form-grid">
            <label className="field">Date<input className="input" type="date" value={date} max={todayStr()} onChange={e => e.target.value && setDate(e.target.value)} /></label>
            {shown.map(([k, label]) => (
              <label className="field" key={k}>{label}
                <input className="input" inputMode="decimal" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          <div className="row">
            <button className="btn primary">Enregistrer</button>
            <button type="button" className="btn ghost" onClick={() => setMore(!more)}>{more ? 'Moins de mesures' : 'Plus de mesures'}</button>
          </div>
          <p className="small muted">
            Une mesure par jour : enregistrer à nouveau la même date la remplace. Sans % de masse grasse saisi, une estimation est calculée à partir des tours de taille et de cou
            (et de hanches pour les femmes) — méthode US Navy, précise à 3–4 points près.
            {(!user.sex || !user.heightCm) && <> Pour l’activer, renseigne ton sexe et ta taille dans les <Link to="/reglages">réglages</Link>.</>}
          </p>
        </form>

        <Async state={state}>{rows => {
          if (!rows.length) return <div className="card empty"><h3>Aucune mesure</h3><p>Ajoute ta première pesée pour démarrer le suivi.</p></div>;
          const weights = rows.filter(r => r.weightKg != null).map(r => ({ date: r.date, weight: r.weightKg, trend: r.weightTrend }));
          const comp = rows.filter(r => r.leanMassKg != null).map(r => ({ date: r.date, lean: r.leanMassKg, fat: r.fatMassKg, bf: r.bodyFatPct ?? r.bodyFatEstimate }));
          const waist = rows.filter(r => r.waistCm != null).map(r => ({ date: r.date, waist: r.waistCm }));
          return (
            <>
              <div className="grid cols-2">
                {weights.length >= 2 && (
                  <div className="card">
                    <div className="card-head"><h2>Poids</h2><span className="small muted">kg · tendance = moyenne mobile</span></div>
                    <TrendChart data={weights} unit="kg" series={[
                      { key: 'weight', label: 'Pesées', color: 'var(--line-strong)', dots: true },
                      { key: 'trend', label: 'Tendance', color: 'var(--series-1)' },
                    ]} />
                  </div>
                )}
                {comp.length >= 2 && (
                  <div className="card">
                    <div className="card-head"><h2>Masse maigre et masse grasse</h2><span className="small muted">kg</span></div>
                    <TrendChart data={comp} unit="kg" series={[
                      { key: 'lean', label: 'Masse maigre', color: 'var(--series-1)' },
                      { key: 'fat', label: 'Masse grasse', color: 'var(--series-2)' },
                    ]} />
                  </div>
                )}
                {comp.length >= 2 && (
                  <div className="card">
                    <div className="card-head"><h2>Taux de masse grasse</h2><span className="small muted">%</span></div>
                    <TrendChart small data={comp} unit="%" series={[{ key: 'bf', label: 'Masse grasse', color: 'var(--series-1)' }]} />
                  </div>
                )}
                {waist.length >= 2 && (
                  <div className="card">
                    <div className="card-head"><h2>Tour de taille</h2><span className="small muted">cm</span></div>
                    <TrendChart small data={waist} unit="cm" series={[{ key: 'waist', label: 'Tour de taille', color: 'var(--series-1)' }]} />
                  </div>
                )}
              </div>
              <div className="card">
                <h2>Historique</h2>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Date</th><th className="r">Poids</th><th className="r">Tendance</th><th className="r">Masse grasse</th><th className="r">Masse maigre</th><th className="r">Taille</th><th /></tr></thead>
                    <tbody>
                      {[...rows].reverse().slice(0, 60).map(r => (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtFull(r.date)}</td>
                          <td className="num r">{fmtNum(r.weightKg)}</td>
                          <td className="num r muted">{fmtNum(r.weightTrend)}</td>
                          <td className="num r">{r.bodyFatPct != null ? `${fmtNum(r.bodyFatPct)} %` : r.bodyFatEstimate != null ? `≈ ${fmtNum(r.bodyFatEstimate)} %` : '—'}</td>
                          <td className="num r">{fmtNum(r.leanMassKg)}</td>
                          <td className="num r">{fmtNum(r.waistCm)}</td>
                          <td className="r"><button className="icon-btn" onClick={() => remove(r.id)} aria-label={`Supprimer la mesure du ${fmtFull(r.date)}`}><Icon name="trash" size={16} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        }}</Async>
      </div>
    </>
  );
}
