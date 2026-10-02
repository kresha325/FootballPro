import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Analytics from './Analytics';
import Gamification from './Gamification';

function tabFromPath(pathname, search) {
  const q = new URLSearchParams(search);
  const tab = q.get('tab');
  if (tab === 'gamification' || tab === 'analytics') return tab;
  if (pathname.includes('/gamification')) return 'gamification';
  return 'analytics';
}

/**
 * Combined Insights hub (1:1 with mobile More → Insights).
 * Also used by /analytics and /gamification deep links.
 */
export default function InsightsHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = useMemo(
    () => tabFromPath(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const go = (next) => {
    if (next === 'gamification') navigate('/insights?tab=gamification');
    else navigate('/insights?tab=analytics');
  };

  return (
    <div className="pb-8">
      <div className="mx-auto mb-4 max-w-6xl px-2 pt-4 sm:px-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Insights</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analitika dhe gamifikimi — njëjtë si në app.
            </p>
          </div>
          <Link
            to="/premium"
            className="text-sm font-semibold text-[var(--xt-color-gold-bright,#9A6B12)] hover:underline"
          >
            Planet Premium →
          </Link>
        </div>
        <div className="flex gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => go('analytics')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
              tab === 'analytics'
                ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            Analitika
          </button>
          <button
            type="button"
            onClick={() => go('gamification')}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
              tab === 'gamification'
                ? 'bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            Gamifikim
          </button>
        </div>
      </div>

      {tab === 'gamification' ? <Gamification /> : <Analytics />}
    </div>
  );
}
