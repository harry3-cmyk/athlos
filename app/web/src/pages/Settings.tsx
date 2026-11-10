import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../App';
import { Chips, Toast } from '../components/ui';
import { LOCAL, api, type Goal, type User } from '../lib/api';
import { GOAL_FR } from '../lib/format';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [p, setP] = useState({
    name: user.name, sex: user.sex ?? '', heightCm: user.heightCm?.toString() ?? '', birthYear: user.birthYear?.toString() ?? '', goal: user.goal,
  });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeState] = useState(document.documentElement.dataset.theme ?? 'auto');
  const file = useRef<HTMLInputElement>(null);

  const guard = async (fn: () => Promise<void>) => { setError(null); try { await fn(); } catch (e: any) { setError(e.message); } };
  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    guard(async () => {
      setUser(await api<User>('PATCH', '/auth/me', {
        name: p.name, sex: p.sex || null, heightCm: p.heightCm ? Number(p.heightCm.replace(',', '.')) : null,
        birthYear: p.birthYear ? Number(p.birthYear) : null, goal: p.goal,
      }));
      setToast('Profil enregistré');
    });
  };
  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    guard(async () => { await api('POST', '/auth/password', pw); setPw({ current: '', next: '' }); setToast('Mot de passe modifié'); });
  };
  const setTheme = (t: string) => {
    setThemeState(t);
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { t === 'auto' ? localStorage.removeItem('forge-theme') : localStorage.setItem('forge-theme', t); } catch { /* stockage indisponible */ }
  };
  const exportData = () => guard(async () => {
    const data = await api('GET', '/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `forge-export-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  });
  const importData = (f: File | undefined) => f && guard(async () => {
    let json: unknown;
    try { json = JSON.parse(await f.text()); } catch { throw new Error('Ce fichier n’est pas un export Forge valide.'); }
    const r = await api<{ workouts: number; body: number }>('POST', '/import', json);
    setToast(`${r.workouts} séances et ${r.body} mesures importées`);
    if (file.current) file.current.value = '';
  });
  const reset = () => guard(async () => {
    if (!confirm('Effacer définitivement toutes tes séances, programmes et mesures sur cet appareil ?')) return;
    await api('POST', '/local/reset');
    location.hash = '#/';
    location.reload();
  });
  const logout = async () => { await api('POST', '/auth/logout').catch(() => {}); setUser(null); };

  return (
    <>
      <div className="page-head"><div><h1>Réglages</h1><p>{LOCAL ? 'Données enregistrées sur cet appareil' : user.email}</p></div></div>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="stack" style={{ maxWidth: 720 }}>
        <form className="card stack" onSubmit={saveProfile}>
          <h2>Profil</h2>
          <div className="form-grid">
            <label className="field">Prénom<input className="input" required={!LOCAL} value={p.name} onChange={e => setP({ ...p, name: e.target.value })} /></label>
            <label className="field">Sexe
              <select className="input" value={p.sex} onChange={e => setP({ ...p, sex: e.target.value })}>
                <option value="">Non renseigné</option><option value="male">Homme</option><option value="female">Femme</option>
              </select>
            </label>
            <label className="field">Taille (cm)<input className="input" inputMode="decimal" value={p.heightCm} onChange={e => setP({ ...p, heightCm: e.target.value })} /></label>
            <label className="field">Année de naissance<input className="input" inputMode="numeric" value={p.birthYear} onChange={e => setP({ ...p, birthYear: e.target.value })} /></label>
          </div>
          <div className="field">Objectif principal
            <Chips label="Objectif principal" value={p.goal} onChange={goal => setP({ ...p, goal })}
              options={(Object.keys(GOAL_FR) as Goal[]).map(g => ({ value: g, label: GOAL_FR[g] }))} />
          </div>
          <p className="small muted">L’objectif règle les repères de l’analyse. Sexe et taille servent uniquement à estimer la masse grasse.</p>
          <div><button className="btn primary">Enregistrer</button></div>
        </form>

        <div className="card stack">
          <h2>Apparence</h2>
          <Chips label="Thème" value={theme} onChange={setTheme} options={[{ value: 'auto', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} />
        </div>

        <div className="card stack">
          <h2>Mes données</h2>
          <p className="small muted">L’export contient toutes tes séances et mesures au format JSON. L’import ajoute les séances du fichier et complète les mesures manquantes (rien n’est écrasé).</p>
          <div className="row">
            <button className="btn" onClick={exportData}>Exporter (JSON)</button>
            <button className="btn" onClick={() => file.current?.click()}>Importer un export</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => importData(e.target.files?.[0])} />
          </div>
        </div>

        {LOCAL ? (
          <div className="card stack">
            <h2>Stockage sur l’appareil</h2>
            <p className="small muted">
              Cette version fonctionne sans serveur : tout est enregistré dans ce navigateur. Vider les données de navigation, changer de téléphone
              ou de navigateur fait perdre l’historique — l’export JSON ci-dessus est ta sauvegarde, et l’import permet de le retrouver ailleurs.
              Sur iPhone, ajoute l’application à l’écran d’accueil : Safari peut effacer les données d’un site resté longtemps sans visite.
            </p>
            {import.meta.env.VITE_LEGACY_URL && (
              <p className="small">L’application précédente et ses données restent accessibles : <a href={import.meta.env.VITE_LEGACY_URL}>ouvrir l’ancienne version</a>.</p>
            )}
            <div><button className="btn danger" onClick={reset}>Effacer toutes mes données</button></div>
          </div>
        ) : (
          <>
        <form className="card stack" onSubmit={savePassword}>
              <h2>Mot de passe</h2>
              <div className="form-grid">
                <label className="field">Actuel<input className="input" type="password" required autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></label>
                <label className="field">Nouveau (8 caractères min.)<input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></label>
              </div>
              <div><button className="btn">Modifier le mot de passe</button></div>
            </form>

            <div><button className="btn danger" onClick={logout}>Se déconnecter</button></div>
          </>
        )}
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
