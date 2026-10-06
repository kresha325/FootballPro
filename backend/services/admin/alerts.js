'use strict';

const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function buildAlerts(signals = {}, now = new Date()) {
  const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const items = [];
  const push = (entry) => items.push({ timestamp, count: entry.count || 1, ...entry });

  if (signals.databaseStatus === 'ERROR') {
    push({
      severity: 'CRITICAL',
      category: 'database',
      code: 'DATABASE_UNAVAILABLE',
      description: 'Database unavailable',
      href: '/admin/system',
    });
  }
  if (signals.backendStatus === 'ERROR') {
    push({
      severity: 'CRITICAL',
      category: 'backend',
      code: 'BACKEND_UNAVAILABLE',
      description: 'Backend unavailable',
      href: '/admin/system',
    });
  }
  if (Number(signals.failedPayments24h) >= 5) {
    push({
      severity: 'HIGH',
      category: 'payments',
      code: 'PAYMENT_FAILURE_SPIKE',
      description: `${signals.failedPayments24h} failed payments in the last 24 hours`,
      href: '/admin/finance',
      count: Number(signals.failedPayments24h),
    });
  }
  if (Number(signals.apiRequests1h) >= 20 && Number(signals.apiErrorRate1h) >= 0.05) {
    push({
      severity: 'HIGH',
      category: 'api',
      code: 'API_ERROR_SPIKE',
      description: `API error rate ${Math.round(Number(signals.apiErrorRate1h) * 1000) / 10}% over the last hour`,
      href: '/admin/errors',
    });
  }
  if (Number(signals.streamFailures24h) >= 3) {
    push({
      severity: 'HIGH',
      category: 'streaming',
      code: 'STREAM_FAILURES',
      description: `${signals.streamFailures24h} stream failures in the last 24 hours`,
      href: '/admin/media',
      count: Number(signals.streamFailures24h),
    });
  } else if (Number(signals.streamFailures24h) > 0) {
    push({
      severity: 'MEDIUM',
      category: 'streaming',
      code: 'STREAM_FAILURES',
      description: `${signals.streamFailures24h} stream failure in the last 24 hours`,
      href: '/admin/media',
      count: Number(signals.streamFailures24h),
    });
  }
  if (Number(signals.notificationFailures24h) >= 5) {
    push({
      severity: 'MEDIUM',
      category: 'notifications',
      code: 'NOTIFICATION_FAILURES',
      description: `${signals.notificationFailures24h} notification delivery failures recorded`,
      href: '/admin/notifications',
      count: Number(signals.notificationFailures24h),
    });
  }
  if (Number(signals.pendingVerifications) >= 20) {
    push({
      severity: 'MEDIUM',
      category: 'verification',
      code: 'PENDING_VERIFICATION',
      description: `${signals.pendingVerifications} players waiting for verification`,
      href: '/admin/players',
      count: Number(signals.pendingVerifications),
    });
  } else if (Number(signals.pendingVerifications) > 0) {
    push({
      severity: 'LOW',
      category: 'verification',
      code: 'PENDING_VERIFICATION',
      description: `${signals.pendingVerifications} players waiting for verification`,
      href: '/admin/players',
      count: Number(signals.pendingVerifications),
    });
  }
  if (Number(signals.failedJobs) > 0) {
    push({
      severity: 'MEDIUM',
      category: 'jobs',
      code: 'FAILED_JOBS',
      description: `${signals.failedJobs} background job failure${signals.failedJobs === 1 ? '' : 's'} on the latest run`,
      href: '/admin/jobs',
      count: Number(signals.failedJobs),
    });
  }
  if (Number(signals.openReports) > 0) {
    push({
      severity: Number(signals.openReports) >= 5 ? 'MEDIUM' : 'LOW',
      category: 'reports',
      code: 'OPEN_REPORTS',
      description: `${signals.openReports} open report${signals.openReports === 1 ? '' : 's'}`,
      href: '/admin/reports',
      count: Number(signals.openReports),
    });
  }
  if (Number(signals.abuseReports) > 0) {
    push({
      severity: Number(signals.abuseReports) >= 5 ? 'HIGH' : 'MEDIUM',
      category: 'suspicious',
      code: 'SUSPICIOUS_REPORTS',
      description: `${signals.abuseReports} abuse or scam report${signals.abuseReports === 1 ? '' : 's'} still open`,
      href: '/admin/reports',
      count: Number(signals.abuseReports),
    });
  }
  const storage = signals.storagePercent;
  if (storage != null && Number.isFinite(Number(storage))) {
    const pct = Number(storage);
    let severity = null;
    if (pct >= 95) severity = 'CRITICAL';
    else if (pct >= 90) severity = 'HIGH';
    else if (pct >= 80) severity = 'MEDIUM';
    else if (pct >= 70) severity = 'LOW';
    if (severity) {
      push({
        severity,
        category: 'storage',
        code: 'STORAGE_PRESSURE',
        description: `Host disk usage ${pct}%`,
        href: '/admin/system',
      });
    }
  }

  return groupAlerts(items).sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
}

function groupAlerts(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = item.code || `${item.category}:${item.description}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...item, count: item.count || 1 });
      continue;
    }
    existing.count += item.count || 1;
    if (!existing.description.includes('grouped')) {
      existing.description = `${existing.description} (grouped ${existing.count})`;
    }
  }
  return [...grouped.values()];
}

module.exports = {
  SEVERITY_RANK,
  buildAlerts,
  groupAlerts,
};
