export function displayMetric(value) {
  if (value == null || value === '') return 'N/A';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'N/A';
  return String(value);
}

export function displayRevenue(revenue) {
  if (revenue == null) return 'N/A';
  if (!Array.isArray(revenue) || revenue.length === 0) return '0';
  return revenue
    .map((row) => `${displayMetric(row.amount)} ${row.currency || ''}`.trim())
    .join(' · ');
}

export function canPermission(permissions, permission) {
  if (!Array.isArray(permissions) || !permission) return false;
  if (permissions.includes('*') || permissions.includes(permission)) return true;
  const [resource, action] = permission.split('.');
  return action === 'read' && permissions.includes(`${resource}.manage`);
}

export function apiError(error, fallback = 'Request failed') {
  return error?.response?.data?.msg || error?.response?.data?.error || error?.message || fallback;
}
