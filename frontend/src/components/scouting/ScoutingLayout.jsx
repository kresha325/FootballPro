import { NavLink } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasTier } from '../../utils/subscriptionAccess';

const LINKS = [
  ['/scouting', 'Paneli', true],
  ['/scouting/discover', 'Zbulimi', false],
  ['/scouting/shortlist', 'Shortlist', false],
  ['/scouting/watchlist', 'Watchlist', false],
  ['/scouting/reports', 'Raporte', false],
  ['/scouting/compare', 'Krahasimi', false],
];

function scoutingAllowed(user) {
  const roleOk = ['scout', 'club', 'manager'].includes(String(user?.role || '').toLowerCase());
  return { roleOk, authorized: roleOk && hasTier(user, 'pro') };
}

export default function ScoutingLayout({ children }) {
  const { user } = useAuth();
  const { roleOk, authorized } = scoutingAllowed(user);

  if (!authorized) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <section className="xt-card xt-empty-state">
          <h1 className="text-2xl font-bold">Qasja është e kufizuar</h1>
          <p>
            {roleOk
              ? 'Scouting është tipar Pro. Trial 30-ditor jep tipare Basic, jo Pro.'
              : 'Qendra e scouting është për rolet Scout, Club dhe Manager me planin Pro.'}
          </p>
          {roleOk ? <Link to="/premium" className="btn btn-primary mt-6 inline-flex min-h-11 px-6">Përmirëso në Pro</Link> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-6 lg:py-8">
      <header className="xt-page-header">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--xt-color-gold-bright)]">X TALENTI · RECRUITMENT</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Qendra e Scouting</h1>
        <p>Zbulim, shortlist, watchlist dhe raporte mbi të dhënat zyrtare të ndeshjeve.</p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Scouting">
        {LINKS.map(([to, label, end]) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `btn min-h-11 ${isActive ? 'btn-primary' : 'btn-outline'}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {children}
    </main>
  );
}

export function LoadingBlock({ label = 'Po ngarkohet' }) {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-label={label}>
      {[0, 1, 2, 3].map((item) => (
        <div className="xt-card space-y-3 p-5" key={item}>
          <div className="xt-skeleton h-5 w-2/3" />
          <div className="xt-skeleton h-4 w-1/2" />
          <div className="xt-skeleton h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="xt-error-state xt-card" role="alert">
      <p>{message}</p>
      {onRetry ? <button type="button" className="btn btn-outline" onClick={onRetry}>Provo përsëri</button> : null}
    </div>
  );
}

export function EmptyBlock({ title, text }) {
  return (
    <div className="xt-empty-state xt-card">
      <h3 className="font-semibold text-[var(--xt-color-text)]">{title}</h3>
      <p>{text}</p>
    </div>
  );
}
