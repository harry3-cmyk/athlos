import { useEffect, useState, type FormEvent } from 'react';
import { api, type User } from '../lib/api';

export default function AuthPage({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [allowRegistration, setAllow] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ allowRegistration: boolean }>('GET', '/auth/config').then(c => setAllow(c.allowRegistration)).catch(() => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      onAuth(await api<User>('POST', `/auth/${mode}`, mode === 'login' ? { email: form.email, password: form.password } : form));
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth">
      <div className="card">
        <div className="brand" style={{ padding: 0, marginBottom: 6 }}><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />Forge</div>
        <p className="muted">{mode === 'login' ? 'Connecte-toi pour retrouver tes séances.' : 'Crée ton compte pour commencer le suivi.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label className="field">Prénom<input className="input" required value={form.name} onChange={set('name')} autoComplete="given-name" /></label>
          )}
          <label className="field">E-mail<input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
          <label className="field">Mot de passe
            <input className="input" type="password" required minLength={mode === 'register' ? 8 : undefined} value={form.password} onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'register' && <span className="muted" style={{ fontWeight: 400 }}>8 caractères minimum.</span>}
          </label>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="btn primary lg" disabled={busy}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
        </form>
        {allowRegistration && (
          <p className="small" style={{ marginTop: 16, textAlign: 'center' }}>
            {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            <a href="#" onClick={e => { e.preventDefault(); setError(null); setMode(mode === 'login' ? 'register' : 'login'); }}>
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
