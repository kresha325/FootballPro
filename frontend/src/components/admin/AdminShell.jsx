import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { canPermission } from './opsFormat';
import OpsDashboard from './OpsDashboard';
import {
  AnalyticsAdmin,
  AuditPage,
  ClubsPage,
  CompetitionsPage,
  ErrorsPage,
  FinancePage,
  JobsPage,
  LegacyPage,
  MarketplacePage,
  MatchesPage,
  MediaPage,
  NotificationsPage,
  PlayersPage,
  ReportsPage,
  ScoutingPage,
  SystemPage,
  UsersPage,
} from './pages';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true, permission: 'dashboard.read' },
  { to: '/admin/users', label: 'Users', permission: 'users.read' },
  { to: '/admin/players', label: 'Players', permission: 'players.read' },
  { to: '/admin/clubs', label: 'Clubs', permission: 'clubs.read' },
  { to: '/admin/competitions', label: 'Competitions', permission: 'competitions.manage' },
  { to: '/admin/matches', label: 'Matches', permission: 'matches.manage' },
  { to: '/admin/scouting', label: 'Scouting', permission: 'scouting.read' },
  { to: '/admin/media', label: 'Media', permission: 'media.manage' },
  { to: '/admin/marketplace', label: 'Marketplace', permission: 'marketplace.read' },
  { to: '/admin/finance', label: 'Finance', permission: 'finance.read', also: 'payments.read' },
  { to: '/admin/notifications', label: 'Notifications', permission: 'notifications.read' },
  { to: '/admin/reports', label: 'Reports', permission: 'reports.read' },
  { to: '/admin/analytics', label: 'Analytics', permission: 'analytics.read' },
  { to: '/admin/system', label: 'System', permission: 'system.read' },
  { to: '/admin/audit-log', label: 'Audit log', permission: 'audit.read' },
];

export default function AdminShell() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/ops/session')
      .then((res) => setSession(res.data))
      .catch((err) => setError(err?.response?.data?.msg || 'Admin session failed'));
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return undefined;
    const timer = setTimeout(() => {
      api.get('/admin/ops/search', { params: { q: query.trim() } })
        .then((res) => setResults(res.data))
        .catch(() => setResults({ groups: [] }));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const permissions = session?.permissions || [];
  const visible = NAV.filter((item) => canPermission(permissions, item.permission) || (item.also && canPermission(permissions, item.also)));

  return (
    <div className="xt-dashboard-page xt-admin-page mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Control center</p>
          <p className="text-sm text-gray-600">{session ? `${session.adminRole || 'admin'}` : 'Checking access…'}</p>
        </div>
        <div className="relative w-full max-w-md">
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Search users, matches, orders, reports…"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (value.trim().length < 2) setResults(null);
            }}
          />
          {results?.groups?.length ? (
            <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded border bg-white shadow">
              {results.groups.map((group) => (
                <div key={group.type} className="border-b px-3 py-2">
                  <p className="text-xs uppercase text-gray-400">{group.type}</p>
                  {group.rows.map((row) => (
                    <button
                      key={`${group.type}-${row.id}`}
                      type="button"
                      className="block w-full py-1 text-left text-sm hover:underline"
                      onClick={() => {
                        setQuery('');
                        setResults(null);
                        navigate(row.href);
                      }}
                    >
                      {row.label} <span className="text-gray-400">{row.detail}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-gray-200 pb-2">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `whitespace-nowrap rounded px-3 py-2 text-sm ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {item.label}
          </NavLink>
        ))}
        {canPermission(permissions, 'jobs.read') ? <NavLink to="/admin/jobs" className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">Jobs</NavLink> : null}
        {canPermission(permissions, 'errors.read') ? <NavLink to="/admin/errors" className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">Errors</NavLink> : null}
        {canPermission(permissions, 'content.manage') ? <NavLink to="/admin/posts" className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">Posts</NavLink> : null}
        {canPermission(permissions, 'system.read') ? <NavLink to="/admin/stadiums" className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">Stadiums</NavLink> : null}
      </nav>
      <Routes>
        <Route index element={<OpsDashboard />} />
        <Route path="users" element={<UsersPage permissions={permissions} />} />
        <Route path="players" element={<PlayersPage permissions={permissions} />} />
        <Route path="clubs" element={<ClubsPage permissions={permissions} />} />
        <Route path="competitions" element={<CompetitionsPage permissions={permissions} />} />
        <Route path="matches" element={<MatchesPage permissions={permissions} />} />
        <Route path="scouting" element={<ScoutingPage />} />
        <Route path="media" element={<MediaPage permissions={permissions} />} />
        <Route path="marketplace" element={<MarketplacePage permissions={permissions} />} />
        <Route path="finance" element={<FinancePage permissions={permissions} />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<ReportsPage permissions={permissions} />} />
        <Route path="analytics" element={<AnalyticsAdmin />} />
        <Route path="system" element={<SystemPage permissions={permissions} />} />
        <Route path="deployment" element={<SystemPage permissions={permissions} />} />
        <Route path="audit-log" element={<AuditPage />} />
        <Route path="jobs" element={<JobsPage permissions={permissions} />} />
        <Route path="errors" element={<ErrorsPage />} />
        <Route path="posts" element={<LegacyPage section="content" title="Posts" />} />
        <Route path="stadiums" element={<LegacyPage section="stadiums" title="Stadiums" />} />
        <Route path="invoices" element={<LegacyPage section="invoices" title="Invoices" />} />
      </Routes>
    </div>
  );
}
