import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import AdminDashboard from '../AdminDashboard';
import AdminMedia from '../AdminMedia';
import AdminStadiums from '../AdminStadiums';
import AdminTournaments from '../AdminTournaments';
import { apiError, canPermission } from './opsFormat';
import { DangerConfirm, ExportButton, Pager, Pill } from './ui';

function useList(loader) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    loader({ page, q: query, status: filter })
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [loader, page, query, filter]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return { page, setPage, data, error, loading, query, setQuery, filter, setFilter, reload: load };
}

function BulkUsers({ allow, onDone }) {
  const [ids, setIds] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  return (
    <div className="rounded border bg-white p-3 text-sm">
      <p className="font-medium">Bulk action</p>
      <input className="mt-2 w-full rounded border px-3 py-2" placeholder="User IDs, comma separated" value={ids} onChange={(event) => setIds(event.target.value)} />
      <div className="mt-2 flex gap-2">
        {allow('users.verify') ? <button type="button" className="rounded border px-2 py-1" onClick={() => setConfirm('verify_users')}>Bulk verify</button> : null}
        {allow('users.suspend') ? <button type="button" className="rounded border px-2 py-1" onClick={() => setConfirm('suspend_users')}>Bulk suspend</button> : null}
      </div>
      {result ? <p className="mt-2 text-gray-600">Affected {result.affected}. Failed {result.failed?.length || 0}.</p> : null}
      <DangerConfirm
        open={Boolean(confirm)}
        title={confirm === 'suspend_users' ? 'Bulk suspend' : 'Bulk verify'}
        warning={`${ids.split(',').map((id) => id.trim()).filter(Boolean).length} records will be updated.`}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async (reason) => {
          setBusy(true);
          try {
            const res = await api.post('/admin/ops/bulk', {
              action: confirm,
              ids: ids.split(',').map((id) => id.trim()).filter(Boolean),
              reason,
            });
            setResult(res.data);
            setConfirm(null);
            onDone();
          } catch (error) {
            window.alert(apiError(error));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function Table({ columns, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            {columns.map((column) => <th key={column.key} className="px-3 py-2">{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="px-3 py-6 text-gray-500" colSpan={columns.length}>No records</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id || row.name} className="border-t border-gray-100">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2 align-top text-gray-800">
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageFrame({ title, children, extra }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {extra}
      </div>
      {children}
    </div>
  );
}

export function UsersPage({ permissions }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [verified, setVerified] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/admin/users', { params: { page, limit: 20, search: search || undefined, role: role || undefined, verified: verified || undefined } })
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err)));
  }, [page, search, role, verified]);

  useEffect(() => { load(); }, [load]);

  const run = async (reason, extra) => {
    if (!confirm) return;
    setBusy(true);
    try {
      const { type, user } = confirm;
      if (type === 'suspend') await api.post(`/admin/users/${user.id}/ban`, { reason });
      if (type === 'restore') await api.post(`/admin/users/${user.id}/unban`);
      if (type === 'verify') await api.post(`/admin/users/${user.id}/verify`);
      if (type === 'revoke') await api.post(`/admin/ops/users/${user.id}/sessions/revoke`, { reason });
      if (type === 'role') await api.put(`/admin/users/${user.id}/role`, { role: extra.role || confirm.role, reason });
      if (type === 'adminRole') await api.put(`/admin/ops/users/${user.id}/admin-role`, { adminRole: extra.adminRole, reason });
      if (type === 'delete') await api.delete(`/admin/users/${user.id}`, { data: { reason } });
      setConfirm(null);
      load();
    } catch (err) {
      window.alert(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const allow = (permission) => canPermission(permissions, permission);

  return (
    <PageFrame title="Users">
      <div className="flex flex-wrap gap-2">
        <input className="rounded border px-3 py-2 text-sm" placeholder="Search name or email" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <select className="rounded border px-3 py-2 text-sm" value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }}>
          <option value="">All roles</option>
          {['athlete', 'club', 'scout', 'coach', 'admin', 'liga'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="rounded border px-3 py-2 text-sm" value={verified} onChange={(e) => { setPage(1); setVerified(e.target.value); }}>
          <option value="">Verification</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
        {allow('export.ops') ? <ExportButton kind="users" /> : null}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {allow('users.verify') || allow('users.suspend') ? <BulkUsers allow={allow} onDone={load} /> : null}
      <Table
        columns={[
          { key: 'name', label: 'User', render: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', render: (row) => row.adminRole ? `${row.role} / ${row.adminRole}` : row.role },
          { key: 'status', label: 'Status', render: (row) => <Pill value={row.bannedAt ? 'ERROR' : 'ONLINE'} /> },
          { key: 'verified', label: 'Verified', render: (row) => row.verified ? 'Yes' : 'No' },
          { key: 'createdAt', label: 'Registered', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
          { key: 'lastSeenAt', label: 'Last activity', render: (row) => row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : 'N/A' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-1">
                <button type="button" className="text-xs underline" onClick={() => api.get(`/admin/ops/users/${row.id}/activity`).then((res) => setActivity(res.data)).catch((err) => window.alert(apiError(err)))}>View</button>
                {allow('users.suspend') && !row.bannedAt ? <button type="button" className="text-xs underline" onClick={() => setConfirm({ type: 'suspend', user: row, title: 'Suspend user' })}>Suspend</button> : null}
                {allow('users.suspend') && row.bannedAt ? <button type="button" className="text-xs underline" onClick={() => setConfirm({ type: 'restore', user: row, title: 'Restore user' })}>Unsuspend</button> : null}
                {allow('users.verify') ? <button type="button" className="text-xs underline" onClick={() => setConfirm({ type: 'verify', user: row, title: 'Verify user' })}>Verify</button> : null}
                {allow('users.sessions') ? <button type="button" className="text-xs underline" onClick={() => setConfirm({ type: 'revoke', user: row, title: 'Revoke sessions' })}>Revoke sessions</button> : null}
                {allow('users.role') ? <button type="button" className="text-xs underline" onClick={() => setConfirm({ type: 'role', user: row, title: 'Change role', fields: [{ name: 'role', label: 'New role', required: true }] })}>Role</button> : null}
                {allow('users.delete') ? <button type="button" className="text-xs text-red-700 underline" onClick={() => setConfirm({ type: 'delete', user: row, title: 'Delete user' })}>Delete</button> : null}
              </div>
            ),
          },
        ]}
        rows={data?.users || []}
      />
      <Pager page={page} pages={data?.pages || 1} onPage={setPage} />
      {activity ? (
        <div className="rounded border bg-white p-4 text-sm">
          <div className="flex justify-between">
            <p className="font-medium">Activity for {activity.user?.email}</p>
            <button type="button" className="text-xs underline" onClick={() => setActivity(null)}>Close</button>
          </div>
          <p className="mt-2 text-gray-600">Last seen: {activity.lastSeenAt ? new Date(activity.lastSeenAt).toLocaleString() : 'N/A'}</p>
          <p className="mt-1">Posts: {(activity.posts || []).length} recent · Orders: {(activity.orders || []).length} · Payments: {(activity.payments || []).length}</p>
        </div>
      ) : null}
      <DangerConfirm
        open={Boolean(confirm)}
        title={confirm?.title || 'Confirm'}
        warning="This action is audited."
        fields={confirm?.fields || []}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={run}
      />
    </PageFrame>
  );
}

function ActionPage({ title, endpoint, columns, actions, permissions, permission, legacy }) {
  const loader = useCallback((params) => api.get(endpoint, { params: { page: params.page, limit: 20, q: params.q || undefined, status: params.status || undefined } }), [endpoint]);
  const list = useList(loader);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('');

  const run = async (reason, extra) => {
    setBusy(true);
    try {
      await confirm.run(reason, extra);
      setConfirm(null);
      list.reload();
    } catch (err) {
      window.alert(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame
      title={title}
      extra={actions?.sections ? (
        <select className="rounded border px-3 py-2 text-sm" value={section} onChange={(e) => { setSection(e.target.value); list.setPage(1); }}>
          {actions.sections.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      ) : null}
    >
      <div className="flex gap-2">
        <input className="rounded border px-3 py-2 text-sm" placeholder="Search" value={list.query} onChange={(e) => { list.setPage(1); list.setQuery(e.target.value); }} />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Status filter" value={list.filter} onChange={(e) => { list.setPage(1); list.setFilter(e.target.value); }} />
      </div>
      {list.error ? <p className="text-sm text-red-700">{list.error}</p> : null}
      {list.loading ? <p className="text-sm text-gray-500">Loading…</p> : (
        <Table
          columns={[
            ...columns,
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  {(actions?.items || []).filter((item) => !item.permission || canPermission(permissions, item.permission)).map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="text-xs underline"
                      onClick={() => setConfirm({
                        title: item.label,
                        fields: item.fields || [],
                        run: (reason, extra) => item.run(row, reason, extra, section),
                      })}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ),
            },
          ]}
          rows={list.data?.rows || []}
        />
      )}
      <Pager page={list.data?.page || list.page} pages={list.data?.pages || 1} onPage={list.setPage} />
      {legacy}
      <DangerConfirm open={Boolean(confirm)} title={confirm?.title || 'Confirm'} warning={permission || 'This action is written to the audit log.'} fields={confirm?.fields || []} busy={busy} onCancel={() => setConfirm(null)} onConfirm={run} />
    </PageFrame>
  );
}

const postAction = (url, body) => (reason, extra = {}) => api.post(url, { ...body, ...extra, reason });

export function PlayersPage({ permissions }) {
  return (
    <ActionPage
      title="Players"
      endpoint="/admin/ops/players"
      permissions={permissions}
      columns={[
        { key: 'name', label: 'Player' },
        { key: 'club', label: 'Club' },
        { key: 'position', label: 'Position' },
        { key: 'completeness', label: 'Completeness', render: (row) => row.completeness == null ? 'N/A' : `${row.completeness}%` },
        { key: 'verified', label: 'Verified', render: (row) => row.clubVerified ? 'Yes' : 'No' },
        { key: 'status', label: 'Status', render: (row) => row.suspended ? 'Suspended' : 'Active' },
        { key: 'stats', label: 'Statistics', render: (row) => row.stats ? `G ${row.stats.goals ?? '—'} A ${row.stats.assists ?? '—'}` : 'N/A' },
      ]}
      actions={{
        items: [
          { label: 'Verify', permission: 'players.manage', run: (row, reason) => postAction(`/admin/ops/players/${row.id}/actions`, { action: 'verify' })(reason) },
          { label: 'Unverify', permission: 'players.manage', run: (row, reason) => postAction(`/admin/ops/players/${row.id}/actions`, { action: 'unverify' })(reason) },
          { label: 'Suspend', permission: 'players.manage', run: (row, reason) => postAction(`/admin/ops/players/${row.id}/actions`, { action: 'suspend' })(reason) },
          { label: 'Restore', permission: 'players.manage', run: (row, reason) => postAction(`/admin/ops/players/${row.id}/actions`, { action: 'restore' })(reason) },
          { label: 'Feature', permission: 'players.manage', run: (row, reason) => postAction(`/admin/ops/players/${row.id}/actions`, { action: 'feature' })(reason) },
        ],
      }}
    />
  );
}

export function ClubsPage({ permissions }) {
  return (
    <ActionPage
      title="Clubs"
      endpoint="/admin/ops/clubs"
      permissions={permissions}
      columns={[
        { key: 'name', label: 'Club' },
        { key: 'email', label: 'Email' },
        { key: 'league', label: 'League' },
        { key: 'verified', label: 'Verified', render: (row) => row.verified ? 'Yes' : 'No' },
        { key: 'suspended', label: 'Status', render: (row) => row.suspended ? 'Suspended' : 'Active' },
      ]}
      actions={{
        items: [
          { label: 'Verify', permission: 'clubs.manage', run: (row, reason) => postAction(`/admin/ops/clubs/${row.id}/actions`, { action: 'verify' })(reason) },
          { label: 'Suspend', permission: 'clubs.manage', run: (row, reason) => postAction(`/admin/ops/clubs/${row.id}/actions`, { action: 'suspend' })(reason) },
          { label: 'Restore', permission: 'clubs.manage', run: (row, reason) => postAction(`/admin/ops/clubs/${row.id}/actions`, { action: 'restore' })(reason) },
        ],
      }}
    />
  );
}

export function CompetitionsPage({ permissions }) {
  return (
    <div className="space-y-8">
      <ActionPage
        title="Competitions"
        endpoint="/admin/ops/competitions"
        permissions={permissions}
        columns={[
          { key: 'name', label: 'Competition' },
          { key: 'season', label: 'Season' },
          { key: 'lifecycle', label: 'Status', render: (row) => row.lifecycle || row.status },
          { key: 'matches', label: 'Matches', render: (row) => row.matches ?? 'N/A' },
        ]}
        actions={{
          items: [
            { label: 'Publish', permission: 'competitions.manage', run: (row, reason) => postAction(`/admin/ops/competitions/${row.id}/actions`, { action: 'publish' })(reason) },
            { label: 'Pause', permission: 'competitions.manage', run: (row, reason) => postAction(`/admin/ops/competitions/${row.id}/actions`, { action: 'pause' })(reason) },
            { label: 'Archive', permission: 'competitions.manage', run: (row, reason) => postAction(`/admin/ops/competitions/${row.id}/actions`, { action: 'archive' })(reason) },
          ],
        }}
      />
      <AdminTournaments />
    </div>
  );
}

export function MatchesPage({ permissions }) {
  return (
    <ActionPage
      title="Matches"
      endpoint="/admin/ops/matches"
      permissions={permissions}
      columns={[
        { key: 'competition', label: 'Competition' },
        { key: 'teams', label: 'Teams', render: (row) => `${row.home || '—'} vs ${row.away || '—'}` },
        { key: 'date', label: 'Date', render: (row) => row.date ? new Date(row.date).toLocaleString() : '—' },
        { key: 'venue', label: 'Venue' },
        { key: 'status', label: 'Status' },
        { key: 'score', label: 'Score', render: (row) => `${row.scoreHome ?? '—'} - ${row.scoreAway ?? '—'}` },
      ]}
      actions={{
        items: [
          { label: 'Reschedule', permission: 'matches.manage', fields: [{ name: 'matchDate', label: 'New date (ISO)', required: true }], run: (row, reason, extra) => postAction(`/admin/ops/matches/${row.id}/actions`, { action: 'reschedule' })(reason, extra) },
          { label: 'Postpone', permission: 'matches.manage', run: (row, reason) => postAction(`/admin/ops/matches/${row.id}/actions`, { action: 'postpone' })(reason) },
          { label: 'Cancel', permission: 'matches.manage', run: (row, reason) => postAction(`/admin/ops/matches/${row.id}/actions`, { action: 'cancel' })(reason) },
          { label: 'Correct score', permission: 'matches.correct', fields: [{ name: 'scoreHome', label: 'Home score', required: true, type: 'number' }, { name: 'scoreAway', label: 'Away score', required: true, type: 'number' }], run: (row, reason, extra) => postAction(`/admin/ops/matches/${row.id}/actions`, { action: 'correct' })(reason, extra) },
        ],
      }}
    />
  );
}

export function ScoutingPage() {
  return (
    <ActionPage
      title="Scouting"
      endpoint="/admin/ops/scouting"
      columns={[
        { key: 'player', label: 'Player' },
        { key: 'scout', label: 'Scout' },
        { key: 'status', label: 'Status' },
        { key: 'overallRating', label: 'Rating', render: (row) => row.overallRating ?? 'N/A' },
        { key: 'flagged', label: 'Flagged', render: (row) => row.flagged ? 'Yes' : 'No' },
        { key: 'reportDate', label: 'Date' },
      ]}
      actions={{ items: [] }}
    />
  );
}

export function MediaPage({ permissions }) {
  const [section, setSection] = useState('videos');
  const loader = useCallback((params) => api.get('/admin/ops/media', { params: { ...params, section, limit: 20 } }), [section]);
  const list = useList(loader);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-8">
      <PageFrame title="Media" extra={(
        <select className="rounded border px-3 py-2 text-sm" value={section} onChange={(e) => { setSection(e.target.value); list.setPage(1); }}>
          <option value="live">Live</option>
          <option value="videos">Videos</option>
          <option value="highlights">Highlights</option>
          <option value="replays">Replays</option>
        </select>
      )}>
        {list.loading ? <p className="text-sm text-gray-500">Loading…</p> : (
          <Table
            columns={[
              { key: 'title', label: 'Item', render: (row) => row.title || `Item ${row.id}` },
              { key: 'ownerId', label: 'Owner' },
              { key: 'matchId', label: 'Match', render: (row) => row.matchId ?? '—' },
              { key: 'status', label: 'Status', render: (row) => row.status || row.visibility || '—' },
              { key: 'provider', label: 'Provider', render: (row) => row.provider || 'N/A' },
              { key: 'views', label: 'Views', render: (row) => row.views == null ? 'N/A' : row.views },
              { key: 'createdAt', label: 'Created', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—' },
              { key: 'actions', label: 'Actions', render: (row) => (section === 'videos' || section === 'highlights') && canPermission(permissions, 'media.manage') ? (
                <div className="flex gap-2">
                  {['publish', 'unpublish', 'remove', 'feature'].map((action) => (
                    <button key={action} type="button" className="text-xs underline" onClick={() => setConfirm({ id: row.id, action })}>{action}</button>
                  ))}
                </div>
              ) : 'Inspect in the list' }
            ]}
            rows={list.data?.rows || []}
          />
        )}
        <Pager page={list.page} pages={list.data?.pages || 1} onPage={list.setPage} />
      </PageFrame>
      <AdminMedia />
      <DangerConfirm
        open={Boolean(confirm)}
        title={confirm?.action || 'Media'}
        warning="Stream keys and storage credentials are never shown."
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async (reason) => {
          setBusy(true);
          try {
            await api.post(`/admin/ops/media/${confirm.id}/actions`, { action: confirm.action, reason });
            setConfirm(null);
            list.reload();
          } catch (err) {
            window.alert(apiError(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function MarketplacePage({ permissions }) {
  const [section, setSection] = useState('products');
  const endpoint = section === 'orders' ? '/admin/ops/orders' : section === 'sellers' ? '/admin/ops/sellers' : '/admin/ops/products';
  return (
    <div className="space-y-3">
      <select className="rounded border px-3 py-2 text-sm" value={section} onChange={(event) => setSection(event.target.value)}>
        <option value="products">Products</option>
        <option value="orders">Orders</option>
        <option value="sellers">Sellers</option>
      </select>
      <ActionPage
        key={endpoint}
        title="Marketplace"
        endpoint={endpoint}
        permissions={permissions}
        columns={section === 'orders' ? [
          { key: 'id', label: 'Order' },
          { key: 'userId', label: 'User' },
          { key: 'sellerId', label: 'Seller' },
          { key: 'status', label: 'Status' },
          { key: 'totalAmount', label: 'Total', render: (row) => `${row.totalAmount} ${row.currency}` },
        ] : section === 'sellers' ? [
          { key: 'id', label: 'Seller' },
          { key: 'email', label: 'Email' },
          { key: 'products', label: 'Products' },
        ] : [
          { key: 'name', label: 'Product' },
          { key: 'Seller', label: 'Seller', render: (row) => row.Seller?.email || row.sellerId },
          { key: 'status', label: 'Status' },
          { key: 'stock', label: 'Stock' },
          { key: 'price', label: 'Price', render: (row) => `${row.price} ${row.currency}` },
        ]}
        actions={{
          items: section === 'products' ? [
            { label: 'Archive', permission: 'marketplace.manage', run: (row, reason) => postAction(`/admin/ops/products/${row.id}/actions`, { action: 'archive' })(reason) },
          ] : section === 'orders' ? [
            { label: 'Refund', permission: 'orders.manage', run: (row, reason) => postAction(`/admin/ops/orders/${row.id}/actions`, { action: 'refund' })(reason) },
            { label: 'Cancel', permission: 'orders.manage', run: (row, reason) => postAction(`/admin/ops/orders/${row.id}/actions`, { action: 'cancelled' })(reason) },
          ] : [],
        }}
        legacy={<p className="text-xs text-gray-500">Checkout totals stay in the marketplace service. Payments cannot be marked successful from here.</p>}
      />
    </div>
  );
}

export function NotificationsPage() {
  const [summary, setSummary] = useState(null);
  const loader = useCallback((params) => api.get('/admin/ops/notifications', { params }).then((res) => {
    setSummary(res.data.summary);
    return res;
  }), []);
  const list = useList(loader);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <PageFrame title="Notifications">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
        <p>Sent: {summary?.sent ?? 'N/A'}</p>
        <p>Pending: {summary?.pending ?? 'N/A'}</p>
        <p>Email failures: {summary?.recordedEmailFailures ?? 'N/A'}</p>
        <p>Invalid tokens: {summary?.invalidTokens ?? 'N/A'}</p>
      </div>
      {summary?.pendingNote ? <p className="text-xs text-gray-500">{summary.pendingNote}</p> : null}
      <Table
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'userId', label: 'User' },
          { key: 'type', label: 'Type' },
          { key: 'title', label: 'Title' },
          { key: 'createdAt', label: 'Created', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '—' },
          { key: 'actions', label: 'Actions', render: (row) => (
            <button type="button" className="text-xs underline" onClick={() => setConfirm(row)}>Retry push</button>
          ) },
        ]}
        rows={list.data?.rows || []}
      />
      <DangerConfirm
        open={Boolean(confirm)}
        title="Retry notification push"
        warning="This resends the push only. It does not create another in-app notification."
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async (reason) => {
          setBusy(true);
          try {
            await api.post('/admin/ops/notifications/actions', { action: 'retry', id: confirm.id, reason });
            setConfirm(null);
          } catch (err) {
            window.alert(apiError(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </PageFrame>
  );
}

export function ReportsPage({ permissions }) {
  return (
    <div className="space-y-8">
      <ActionPage
        title="Reports"
        endpoint="/admin/ops/reports"
        permissions={permissions}
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'category', label: 'Category' },
          { key: 'targetType', label: 'Target' },
          { key: 'reason', label: 'Reason' },
          { key: 'status', label: 'Status' },
          { key: 'createdAt', label: 'Opened', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '—' },
        ]}
        actions={{
          items: [
            { label: 'Assign', permission: 'reports.manage', run: (row, reason) => postAction(`/admin/ops/reports/${row.id}/actions`, { status: 'in_review' })(reason) },
            { label: 'Resolve', permission: 'reports.manage', run: (row, reason) => postAction(`/admin/ops/reports/${row.id}/actions`, { status: 'resolved' })(reason) },
            { label: 'Reject', permission: 'reports.manage', run: (row, reason) => postAction(`/admin/ops/reports/${row.id}/actions`, { status: 'rejected' })(reason) },
            { label: 'Suspend', permission: 'users.suspend', run: (row, reason) => postAction(`/admin/ops/reports/${row.id}/actions`, { status: 'resolved', suspend: true })(reason) },
          ],
        }}
      />
      <AdminDashboard section="reports" embedded />
    </div>
  );
}

export function AuditPage() {
  return (
    <ActionPage
      title="Audit log"
      endpoint="/admin/ops/audit"
      columns={[
        { key: 'createdAt', label: 'Time', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '—' },
        { key: 'admin', label: 'Admin' },
        { key: 'action', label: 'Action' },
        { key: 'entity', label: 'Entity' },
        { key: 'entityId', label: 'ID' },
        { key: 'result', label: 'Result' },
        { key: 'reason', label: 'Reason' },
      ]}
      actions={{ items: [] }}
    />
  );
}

export function JobsPage({ permissions }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/admin/ops/jobs').then((res) => setData(res.data)).catch((err) => setError(apiError(err)));
  useEffect(() => { load(); }, []);
  return (
    <PageFrame title="Background jobs">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Table
        columns={[
          { key: 'name', label: 'Job' },
          { key: 'status', label: 'Status', render: (row) => <Pill value={row.status === 'success' ? 'ONLINE' : row.status === 'failed' ? 'ERROR' : 'UNKNOWN'} /> },
          { key: 'lastRun', label: 'Last run', render: (row) => row.lastRun ? new Date(row.lastRun).toLocaleString() : 'N/A' },
          { key: 'nextRun', label: 'Next run', render: (row) => row.nextRun ? new Date(row.nextRun).toLocaleString() : 'N/A' },
          { key: 'durationMs', label: 'Duration', render: (row) => row.durationMs == null ? 'N/A' : `${row.durationMs} ms` },
          { key: 'failures', label: 'Failures' },
          { key: 'actions', label: 'Actions', render: (row) => canPermission(permissions, 'jobs.retry') ? <button type="button" className="text-xs underline" onClick={() => setConfirm(row.name)}>Retry</button> : null },
        ]}
        rows={data?.jobs || []}
      />
      <DangerConfirm
        open={Boolean(confirm)}
        title={`Retry ${confirm || 'job'}`}
        warning="Only idempotent jobs can be retried."
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async (reason) => {
          setBusy(true);
          try {
            await api.post(`/admin/ops/jobs/${confirm}/retry`, { reason });
            setConfirm(null);
            load();
          } catch (err) {
            window.alert(apiError(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </PageFrame>
  );
}

export function ErrorsPage() {
  const loader = useCallback((params) => api.get('/admin/ops/errors', { params }), []);
  const list = useList(loader);
  return (
    <PageFrame title="Errors">
      <p className="text-xs text-gray-500">Repeated errors are grouped. Stack traces are not shown.</p>
      <Table
        columns={[
          { key: 'path', label: 'Module / endpoint', render: (row) => `${row.method || ''} ${row.path}` },
          { key: 'message', label: 'Error', render: (row) => row.message || 'Hidden' },
          { key: 'count', label: 'Count' },
          { key: 'severity', label: 'Severity' },
          { key: 'firstSeenAt', label: 'First seen', render: (row) => row.firstSeenAt ? new Date(row.firstSeenAt).toLocaleString() : '—' },
          { key: 'lastSeenAt', label: 'Last seen', render: (row) => row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : '—' },
        ]}
        rows={list.data?.rows || []}
      />
    </PageFrame>
  );
}

export function FinancePage({ permissions }) {
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const financeAllowed = canPermission(permissions, 'finance.read');
    const paymentsAllowed = financeAllowed || canPermission(permissions, 'payments.read');
    if (financeAllowed) {
      api.get('/admin/ops/finance').then((res) => setData(res.data)).catch((err) => setError(apiError(err)));
    }
    if (paymentsAllowed) {
      api.get('/admin/ops/payments', { params: { limit: 20 } }).then((res) => setPayments(res.data)).catch((err) => setError(apiError(err)));
    }
  }, [permissions]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Finance</h1>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded border bg-white p-3 text-sm"><p className="text-gray-500">JonCoin circulation</p><p className="text-xl">{data?.joncoinCirculation ?? 'N/A'}</p></div>
        <div className="rounded border bg-white p-3 text-sm"><p className="text-gray-500">Volume 24h</p><p className="text-xl">{data?.transactionVolume24h ?? 'N/A'}</p></div>
        <div className="rounded border bg-white p-3 text-sm"><p className="text-gray-500">Successful payments</p><p className="text-xl">{data?.payments?.successful ?? 'N/A'}</p></div>
        <div className="rounded border bg-white p-3 text-sm"><p className="text-gray-500">Failed payments</p><p className="text-xl">{data?.payments?.failed ?? 'N/A'}</p></div>
        <div className="rounded border bg-white p-3 text-sm"><p className="text-gray-500">Pending payments</p><p className="text-xl">{data?.payments?.pending ?? 'N/A'}</p></div>
        <div className="rounded border bg-white p-3 text-sm"><p className="text-gray-500">Refunds</p><p className="text-xl">{data?.refunds ?? 'N/A'}</p></div>
        <div className="rounded border bg-white p-3 text-sm"><p className="text-gray-500">Webhook errors</p><p className="text-xl">{payments?.webhookErrors ?? 'N/A'}</p></div>
      </div>
      <p className="text-xs text-gray-500">{payments?.retryNote}</p>
      <Table
        columns={[
          { key: 'provider', label: 'Provider' },
          { key: 'providerId', label: 'Provider ID' },
          { key: 'userId', label: 'User' },
          { key: 'amount', label: 'Amount', render: (row) => `${row.amount} ${row.currency}` },
          { key: 'status', label: 'Status' },
          { key: 'createdAt', label: 'Created', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '—' },
        ]}
        rows={payments?.rows || []}
      />
      {canPermission(permissions, 'finance.adjust') ? (
        <button type="button" className="rounded bg-gray-900 px-3 py-2 text-sm text-white" onClick={() => setConfirm(true)}>Adjustment transaction</button>
      ) : <p className="text-sm text-gray-500">Balance edits are disabled for this role.</p>}
      <DangerConfirm
        open={confirm}
        title="Financial adjustment"
        warning="This posts a ledger transaction. It does not edit a balance field."
        fields={[
          { name: 'userId', label: 'User ID', required: true },
          { name: 'direction', label: 'credit or debit', required: true },
          { name: 'amount', label: 'Amount', required: true },
        ]}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async (reason, extra) => {
          setBusy(true);
          try {
            await api.post('/admin/ops/finance/adjustments', { ...extra, reason, idempotencyKey: `admin-${extra.userId}-${Date.now()}` });
            setConfirm(false);
            const finance = await api.get('/admin/ops/finance');
            setData(finance.data);
          } catch (err) {
            window.alert(apiError(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <h2 className="text-lg font-medium">Recent adjustments</h2>
      <Table
        columns={[
          { key: 'createdAt', label: 'Time', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '—' },
          { key: 'adminId', label: 'Admin' },
          { key: 'userId', label: 'User' },
          { key: 'direction', label: 'Direction' },
          { key: 'balanceBefore', label: 'Before' },
          { key: 'amount', label: 'Adjustment' },
          { key: 'balanceAfter', label: 'After' },
          { key: 'reason', label: 'Reason' },
        ]}
        rows={data?.adjustments || []}
      />
      <AdminDashboard section="invoices" embedded />
      <AdminDashboard section="joncoin" embedded />
    </div>
  );
}

export function SystemPage({ permissions }) {
  const [health, setHealth] = useState(null);
  const [flags, setFlags] = useState([]);
  const [deploy, setDeploy] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/admin/ops/system').then((res) => setHealth(res.data)).catch(() => {});
    api.get('/admin/ops/flags').then((res) => setFlags(res.data.flags || [])).catch(() => {});
    api.get('/admin/ops/deployment').then((res) => setDeploy(res.data)).catch(() => {});
    api.get('/admin/ops/maintenance').then((res) => setMaintenance(res.data)).catch(() => {});
  }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">System</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {(health?.status || []).map((item) => (
          <div key={item.key} className="rounded border bg-white p-4 text-sm">
            <div className="flex justify-between"><span>{item.label || item.key}</span><Pill value={item.status} /></div>
            <p className="mt-2 text-gray-500">Latency: {item.latencyMs ?? 'N/A'}</p>
            <p className="text-gray-500">Last success: {item.lastSuccessAt || 'N/A'}</p>
            <p className="text-gray-500">Last failure: {item.lastFailureAt || 'N/A'}</p>
            {item.sizeBytes != null ? <p className="text-gray-500">Database size: {item.sizeBytes} bytes</p> : null}
            {item.connections != null ? <p className="text-gray-500">Connections: {item.connections}</p> : null}
            {item.migrations ? <p className="text-gray-500">Migrations: {item.migrations.applied}/{item.migrations.files} {item.migrations.status}</p> : null}
            {item.percent != null ? <p className="text-gray-500">Disk: {item.percent}%</p> : null}
            {item.imageBytes != null ? <p className="text-gray-500">Images: {item.imageBytes} bytes</p> : <p className="text-gray-500">Image usage: N/A</p>}
            {item.videoBytes != null ? <p className="text-gray-500">Videos: {item.videoBytes} bytes</p> : null}
            {item.providerQuota ? <p className="text-gray-500">Provider quota: {item.providerQuota}</p> : null}
            {item.detail ? <p className="text-gray-500">{item.detail}</p> : null}
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-2 font-medium">API health</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {health?.api?.windows ? Object.values(health.api.windows).map((window) => (
            <div key={window.window} className="rounded border bg-white p-3 text-sm">
              <p className="font-medium">{window.window}</p>
              <p>Requests {window.requests}</p>
              <p>Errors {window.errors}</p>
              <p>Error rate {Math.round(window.errorRate * 1000) / 10}%</p>
              <p>Latency {window.avgLatencyMs ?? 'N/A'} ms</p>
              <ul className="mt-2 text-xs text-gray-600">
                {(window.problematicEndpoints || []).map((row) => <li key={row.endpoint}>{row.endpoint} · {row.errors} errors</li>)}
              </ul>
            </div>
          )) : <p>N/A</p>}
        </div>
        <p className="mt-2 text-xs text-gray-500">{health?.api?.note}</p>
      </section>
      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="font-medium">Deployment</h2>
        <p className="mt-2"><Pill value={deploy?.deploymentStatus || 'NOT CONNECTED'} /></p>
        <p>Frontend: {deploy?.frontendVersion || 'N/A'}</p>
        <p>Backend: {deploy?.backendVersion || 'N/A'}</p>
        <p>Mobile: {deploy?.mobileVersion || 'N/A'}</p>
        <p>Repository mobile version: {deploy?.repositoryMobileVersion || 'N/A'}</p>
        <p>Commit: {deploy?.gitCommit || 'N/A'}</p>
        <p>Build time: {deploy?.buildTime || 'N/A'}</p>
        <p>Environment: {deploy?.environment || 'N/A'}</p>
        <p className="mt-2 text-xs text-gray-500">{deploy?.integrationPoint}</p>
      </section>
      <section>
        <h2 className="mb-2 font-medium">Feature flags</h2>
        <div className="space-y-2">
          {flags.map((flag) => (
            <div key={flag.flag} className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm">
              <span>{flag.flag}</span>
              <button
                type="button"
                className="underline"
                disabled={!canPermission(permissions, 'flags.manage')}
                onClick={() => setConfirm({ kind: 'flag', flag: flag.flag, enabled: !flag.enabled })}
              >
                {flag.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="font-medium">Maintenance</h2>
        <p className="mt-1">Currently {maintenance?.enabled ? 'enabled' : 'disabled'}.</p>
        {canPermission(permissions, 'maintenance.manage') ? (
          <button type="button" className="mt-2 underline" onClick={() => setConfirm({ kind: 'maintenance', enabled: !maintenance?.enabled })}>
            {maintenance?.enabled ? 'Disable maintenance' : 'Enable maintenance'}
          </button>
        ) : null}
      </section>
      <DangerConfirm
        open={Boolean(confirm)}
        title={confirm?.kind === 'flag' ? `${confirm.enabled ? 'Enable' : 'Disable'} ${confirm.flag}` : 'Maintenance mode'}
        warning="Admins keep access. This is enforced by the API."
        fields={confirm?.kind === 'maintenance' && confirm.enabled ? [{ name: 'message', label: 'Message' }, { name: 'estimatedMinutes', label: 'Estimated minutes' }] : []}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async (reason, extra) => {
          setBusy(true);
          try {
            if (confirm.kind === 'flag') {
              await api.put(`/admin/ops/flags/${confirm.flag}`, { enabled: confirm.enabled, reason });
              const res = await api.get('/admin/ops/flags');
              setFlags(res.data.flags || []);
            } else {
              const res = await api.put('/admin/ops/maintenance', {
                enabled: confirm.enabled,
                message: extra.message,
                estimatedMinutes: extra.estimatedMinutes,
                reason,
              });
              setMaintenance(res.data);
            }
            setConfirm(null);
          } catch (err) {
            window.alert(apiError(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function LegacyPage({ section, title }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {section === 'stadiums' ? <AdminStadiums /> : section === 'media' ? <AdminMedia /> : <AdminDashboard section={section} embedded />}
    </div>
  );
}

export function AnalyticsAdmin() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/admin/ops/analytics').then((res) => setData(res.data)).catch(() => setData(null));
  }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
        <p>API errors 24h: {data?.today?.apiErrors ?? 'N/A'}</p>
        <p>New users: {data?.today?.newUsers ?? 'N/A'}</p>
        <p>Orders today: {data?.today?.orders ?? 'N/A'}</p>
        <p>Open reports: {data?.today?.openReports ?? 'N/A'}</p>
      </div>
      <AdminDashboard section="dashboard" embedded />
    </div>
  );
}
