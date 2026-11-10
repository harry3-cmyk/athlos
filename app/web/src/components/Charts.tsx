import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtNum, fmtShort } from '../lib/format';

/**
 * Graphiques : un seul axe Y par graphique, traits fins, grille discrète, infobulle au survol.
 * Les couleurs viennent des jetons CSS (--series-n) pour suivre le thème clair/sombre.
 */
export interface Series { key: string; label: string; color: string; dots?: boolean; dashed?: boolean }

const AXIS = { fontSize: 12, fill: 'var(--muted)' };

function Tip({ active, payload, label, unit, series, fmtX }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="t">{fmtX(label)}</div>
      {payload.filter((p: any) => p.value != null).map((p: any) => {
        const s = (series as Series[]).find(x => x.key === p.dataKey);
        return (
          <div className="v" key={p.dataKey}>
            <span className="sw" style={{ background: s?.color }} />
            {series.length > 1 && <span className="muted" style={{ fontWeight: 400 }}>{s?.label}</span>}
            {fmtNum(p.value)} {unit}
          </div>
        );
      })}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null; // une seule série : le titre la nomme
  return <div className="legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>;
}

/** Tableau de données équivalent, accessible aux lecteurs d'écran. */
function DataTable({ data, xKey, series, unit, fmtX }: { data: any[]; xKey: string; series: Series[]; unit: string; fmtX: (v: string) => string }) {
  return (
    <table className="sr-only">
      <thead><tr><th>Date</th>{series.map(s => <th key={s.key}>{s.label} ({unit})</th>)}</tr></thead>
      <tbody>{data.map((d, i) => <tr key={i}><td>{fmtX(d[xKey])}</td>{series.map(s => <td key={s.key}>{d[s.key] ?? ''}</td>)}</tr>)}</tbody>
    </table>
  );
}

export function TrendChart({ data, xKey = 'date', series, unit, small, fmtX = fmtShort }: {
  data: any[]; xKey?: string; series: Series[]; unit: string; small?: boolean; fmtX?: (v: string) => string;
}) {
  return (
    <div>
      <Legend series={series} />
      <div className={`chart${small ? ' sm' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey={xKey} tickFormatter={fmtX} tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={36} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={48} tickFormatter={v => fmtNum(v)} />
            <Tooltip content={<Tip unit={unit} series={series} fmtX={fmtX} />} cursor={{ stroke: 'var(--line-strong)' }} />
            {series.map(s => (
              <Line key={s.key} dataKey={s.key} name={s.label} type="monotone" stroke={s.dots ? 'transparent' : s.color} strokeWidth={2}
                strokeDasharray={s.dashed ? '5 4' : undefined} connectNulls isAnimationActive={false}
                dot={s.dots ? { r: 3, fill: s.color, stroke: 'var(--surface)', strokeWidth: 1 } : data.length <= 24 ? { r: 3, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} xKey={xKey} series={series} unit={unit} fmtX={fmtX} />
    </div>
  );
}

export function BarsChart({ data, xKey = 'date', yKey, label, unit, small, fmtX = fmtShort, fmtY = fmtNum }: {
  data: any[]; xKey?: string; yKey: string; label: string; unit: string; small?: boolean;
  fmtX?: (v: string) => string; fmtY?: (v: number) => string;
}) {
  const series = [{ key: yKey, label, color: 'var(--series-1)' }];
  return (
    <div>
      <div className={`chart${small ? ' sm' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="22%">
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey={xKey} tickFormatter={fmtX} tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={24} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={v => fmtY(v)} />
            <Tooltip content={<Tip unit={unit} series={series} fmtX={fmtX} />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey={yKey} name={label} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} xKey={xKey} series={series} unit={unit} fmtX={fmtX} />
    </div>
  );
}
