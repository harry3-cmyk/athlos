import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Icon } from './components/ui';
import { api, type User } from './lib/api';
import AnalysisPage from './pages/Analysis';
import AuthPage from './pages/Auth';
import BodyPage from './pages/Body';
import DashboardPage from './pages/Dashboard';
import PlanningPage from './pages/Planning';
import ProgramDetailPage from './pages/ProgramDetail';
import ProgramsPage from './pages/Programs';
import ProgressPage from './pages/Progress';
import SettingsPage from './pages/Settings';
import WorkoutPage from './pages/Workout';
import WorkoutsPage from './pages/Workouts';

interface AuthCtx { user: User; setUser: (u: User | null) => void }
const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => useContext(Ctx)!;

const NAV = [
  { to: '/', label: 'Tableau de bord', short: 'Accueil', icon: 'home', primary: true },
  { to: '/seances', label: 'Séances', short: 'Séances', icon: 'dumbbell', primary: true },
  { to: '/planning', label: 'Planning', short: 'Planning', icon: 'calendar', primary: true },
  { to: '/progression', label: 'Progression', short: 'Progrès', icon: 'chart', primary: true },
  { to: '/programmes', label: 'Programmes', short: 'Programmes', icon: 'list' },
  { to: '/corps', label: 'Poids & composition', short: 'Corps', icon: 'body' },
  { to: '/analyse', label: 'Points faibles', short: 'Analyse', icon: 'target' },
  { to: '/reglages', label: 'Réglages', short: 'Réglages', icon: 'settings' },
];

function MorePage() {
  return (
    <>
      <div className="page-head"><h1>Plus</h1></div>
      <div className="card list">
        {NAV.filter(n => !n.primary).map(n => (
          <NavLink key={n.to} to={n.to} className="list-item">
            <Icon name={n.icon} /><span className="title grow">{n.label}</span><Icon name="right" size={16} />
          </NavLink>
        ))}
      </div>
    </>
  );
}

function Shell() {
  const { pathname } = useLocation();
  const secondaryActive = NAV.some(n => !n.primary && pathname.startsWith(n.to)) || pathname === '/plus';
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />Forge</div>
        {NAV.slice(0, 7).map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link"><Icon name={n.icon} />{n.label}</NavLink>
        ))}
        <div className="spacer" />
        <NavLink to="/reglages" className="nav-link"><Icon name="settings" />Réglages</NavLink>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/seances" element={<WorkoutsPage />} />
          <Route path="/seances/:id" element={<WorkoutPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/progression" element={<ProgressPage />} />
          <Route path="/programmes" element={<ProgramsPage />} />
          <Route path="/programmes/:id" element={<ProgramDetailPage />} />
          <Route path="/corps" element={<BodyPage />} />
          <Route path="/analyse" element={<AnalysisPage />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="/plus" element={<MorePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {NAV.filter(n => n.primary).map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}><Icon name={n.icon} size={22} />{n.short}</NavLink>
        ))}
        <NavLink to="/plus" className={secondaryActive ? 'active' : ''}><Icon name="more" size={22} />Plus</NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  const [user, setUserState] = useState<User | null | undefined>(undefined); // undefined = vérification en cours
  const setUser = useCallback((u: User | null) => setUserState(u), []);

  useEffect(() => {
    try { const t = localStorage.getItem('forge-theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* stockage indisponible */ }
    api<User>('GET', '/auth/me').then(setUser).catch(() => setUser(null));
    const out = () => setUser(null);
    window.addEventListener('forge:unauthorized', out);
    return () => window.removeEventListener('forge:unauthorized', out);
  }, [setUser]);

  if (user === undefined) return <div className="auth"><div className="skeleton" style={{ width: 320 }} /></div>;
  if (!user) return <AuthPage onAuth={setUser} />;
  return <Ctx.Provider value={{ user, setUser }}><Shell /></Ctx.Provider>;
}
