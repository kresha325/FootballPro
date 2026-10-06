import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { apiError, displayMetric, displayRevenue } from './opsFormat';
import { Metric, Pill } from './ui';

export default function OpsDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/admin/ops/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err, 'Dashboard unavailable')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading operational dashboard…</p>;
  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
        <button type="button" className="ml-3 underline" onClick={load}>Retry</button>
      </div>
    );
  }

  const today = data.today || {};
  const status = data.status || [];
  const alerts = data.actionRequired || data.alerts || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Today</h1>
        <p className="text-sm text-gray-500">Operational snapshot from the backend. Empty or missing probes show N/A.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Metric label="System health" value={today.systemHealthPercent == null ? null : `${today.systemHealthPercent}%`} />
        <Metric label="Critical alerts" value={alerts.filter((item) => item.severity === 'CRITICAL').length} />
        <Metric label="High alerts" value={alerts.filter((item) => item.severity === 'HIGH').length} />
        <Metric label="Failed jobs" value={today.failedJobs} />
        <Metric label="Failed payments" value={today.failedPayments} />
        <Metric label="Open reports" value={today.openReports} />
        <Metric label="New users" value={today.newUsers} />
        <Metric label="New players" value={today.newPlayers} />
        <Metric label="Orders today" value={today.orders} />
        <Metric label="Live streams" value={today.liveStreams} />
        <Metric label="API errors 24h" value={today.apiErrors} />
        <Metric label="Storage" value={today.storagePercent == null ? null : `${today.storagePercent}%`} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">System status</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {status.map((item) => (
            <div key={item.key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">{item.label || item.key}</p>
                <Pill value={item.status} />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Latency {displayMetric(item.latencyMs)} ms
                {item.percent != null ? ` · ${item.percent}%` : ''}
              </p>
              {item.detail ? <p className="mt-1 text-xs text-gray-500">{item.detail}</p> : null}
              {item.providerQuota ? <p className="mt-1 text-xs text-gray-500">Provider quota: {item.providerQuota}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Action required</h2>
        {alerts.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">No operational alerts.</p>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {alerts.map((item) => (
              <Link key={item.code} to={item.href || '/admin'} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <Pill value={item.severity} />
                    <span className="text-xs uppercase text-gray-500">{item.category}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-900">{item.description}</p>
                </div>
                <time className="shrink-0 text-xs text-gray-400">{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}</time>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Key metrics</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric label="Total users" value={data.metrics?.totalUsers} />
          <Metric label="Active users 7d" value={data.metrics?.activeUsers} />
          <Metric label="Players" value={data.metrics?.players} />
          <Metric label="Clubs" value={data.metrics?.clubs} />
          <Metric label="Matches" value={data.metrics?.matches} />
          <Metric label="Live streams" value={data.metrics?.liveStreams} />
          <Metric label="Orders" value={data.metrics?.orders} />
          <Metric label="Revenue" value={displayRevenue(data.metrics?.revenue)} />
          <Metric label="JonCoin circulation" value={data.metrics?.joncoinCirculation} />
          <Metric label="Open reports" value={data.metrics?.openReports} />
        </div>
      </section>
    </div>
  );
}
