import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from '../theme/nativeComponents';
import { adminOpsGetRequest, adminOpsPostRequest, adminOpsPutRequest, adminSessionRequest, adminUsersRequest, extractErrorMessage } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';

const PAGE_SIZE = 20;
const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', permission: 'dashboard.read', kind: 'object' },
  { id: 'users', label: 'Users', permission: 'users.read' },
  { id: 'players', label: 'Players', permission: 'players.read' },
  { id: 'clubs', label: 'Clubs', permission: 'clubs.read' },
  { id: 'competitions', label: 'Competitions', permission: 'competitions.manage' },
  { id: 'matches', label: 'Matches', permission: 'matches.manage' },
  { id: 'scouting', label: 'Scouting', permission: 'scouting.read' },
  { id: 'media', label: 'Media', permission: 'media.manage' },
  { id: 'products', label: 'Products', permission: 'marketplace.read' },
  { id: 'orders', label: 'Orders', permission: 'orders.manage' },
  { id: 'sellers', label: 'Sellers', permission: 'marketplace.read' },
  { id: 'finance', label: 'Finance', permission: 'finance.read', alternatePermission: 'payments.read', kind: 'object' },
  { id: 'notifications', label: 'Notifications', permission: 'notifications.read' },
  { id: 'reports', label: 'Reports', permission: 'reports.read' },
  { id: 'analytics', label: 'Analytics', permission: 'analytics.read', kind: 'object' },
  { id: 'system', label: 'System', permission: 'system.read', kind: 'object' },
  { id: 'deployment', label: 'Deployment', permission: 'system.read', kind: 'object' },
  { id: 'audit', label: 'Audit log', permission: 'audit.read' },
  { id: 'jobs', label: 'Jobs', permission: 'jobs.read', kind: 'array' },
  { id: 'errors', label: 'Errors', permission: 'errors.read' },
];

const SECTION_ENDPOINT = {
  dashboard: 'dashboard', analytics: 'analytics', players: 'players', clubs: 'clubs',
  competitions: 'competitions', matches: 'matches', scouting: 'scouting', media: 'media',
  products: 'products', orders: 'orders', sellers: 'sellers', finance: 'finance',
  notifications: 'notifications', reports: 'reports', audit: 'audit', jobs: 'jobs',
  errors: 'errors', system: 'system', deployment: 'deployment',
};

const REASONS_REQUIRED = new Set([
  'users', 'players', 'clubs', 'competitions', 'matches', 'media', 'products', 'orders',
  'notifications', 'reports', 'jobs', 'flags', 'maintenance', 'finance',
]);

function hasPermission(permissions, permission) {
  return permissions.includes('*') || permissions.includes(permission);
}

function valueText(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function rowSummary(row, section) {
  const preferred = {
    users: ['id', 'firstName', 'lastName', 'email', 'role', 'adminRole', 'verified', 'premium', 'bannedAt', 'createdAt', 'lastSeenAt'],
    players: ['name', 'email', 'club', 'position', 'completeness', 'verified', 'suspended', 'stats'],
    clubs: ['name', 'email', 'league', 'city', 'verified', 'suspended'],
    competitions: ['name', 'season', 'lifecycle', 'status', 'matches'],
    matches: ['competition', 'home', 'away', 'date', 'venue', 'status', 'scoreHome', 'scoreAway'],
    scouting: ['player', 'scout', 'status', 'overallRating', 'recommendation', 'flagged', 'reportDate'],
    media: ['title', 'ownerId', 'matchId', 'status', 'provider', 'views', 'createdAt'],
    products: ['name', 'Seller', 'sellerId', 'status', 'stock', 'price', 'currency'],
    orders: ['id', 'userId', 'sellerId', 'status', 'totalAmount', 'currency', 'paymentMethod', 'createdAt'],
    sellers: ['firstName', 'lastName', 'email', 'products'],
    notifications: ['id', 'userId', 'platform', 'enabled', 'invalidatedAt', 'type', 'title', 'isRead', 'createdAt'],
    reports: ['id', 'category', 'status', 'targetType', 'targetId', 'reporterId', 'createdAt'],
    audit: ['id', 'action', 'entity', 'entityId', 'adminId', 'result', 'reason', 'createdAt'],
    errors: ['method', 'path', 'severity', 'statusCode', 'count', 'firstSeenAt', 'lastSeenAt'],
  }[section] || Object.keys(row || {}).slice(0, 7);
  return preferred.filter((key) => row?.[key] !== undefined && row?.[key] !== null)
    .map((key) => [key, row[key]]);
}

function actionsFor(section, row, permissions) {
  const can = (name) => hasPermission(permissions, name);
  if (section === 'users') return [
    ...(can('users.sessions') ? ['revoke_sessions'] : []),
    ...(row.role === 'admin' && can('users.role') ? ['admin_role'] : []),
  ];
  if (section === 'players' && can('players.manage')) return [
    ...(!row.clubVerified ? ['verify'] : ['unverify']),
    ...(row.suspended ? ['restore'] : ['suspend']),
    ...(row.featured ? ['unfeature'] : ['feature']),
  ];
  if (section === 'clubs' && can('clubs.manage')) return [
    ...(!row.verified ? ['verify'] : []), ...(row.suspended ? ['restore'] : ['suspend']),
  ];
  if (section === 'competitions' && can('competitions.manage')) return ['publish', 'pause', 'archive'];
  if (section === 'matches') return [
    ...(can('matches.manage') ? ['reschedule', 'edit', 'postpone', 'cancel'] : []),
    ...(can('matches.correct') ? ['correct'] : []),
  ];
  if (section === 'media' && can('media.manage') && ['videos', 'highlights'].includes(row.kind)) return ['publish', 'unpublish', 'remove', 'feature'];
  if (section === 'products' && can('marketplace.manage')) return row.status === 'active' ? ['archive'] : ['publish'];
  if (section === 'orders' && can('orders.manage')) {
    return row.status === 'paid' || row.status === 'processing'
      ? ['processing', 'shipped', 'cancelled', 'refund']
      : row.status === 'shipped' ? ['delivered', 'cancelled'] : [];
  }
  if (section === 'notifications' && can('notifications.manage')) return row.platform ? ['disable_token'] : ['retry'];
  if (section === 'reports') return [
    ...(can('reports.manage') ? ['in_review', 'resolved', 'rejected'] : []),
    ...(can('users.suspend') ? ['suspend'] : []),
  ];
  if (section === 'jobs' && can('jobs.retry') && row.status === 'failed') return ['retry'];
  return [];
}

function actionPath(section, row, action) {
  if (section === 'users') return { path: `users/${row.id}/sessions/revoke`, body: {} };
  if (section === 'notifications') return { path: 'notifications/actions', body: { action: row.platform ? 'disable_token' : action, id: row.id } };
  if (section === 'jobs') return { path: `jobs/${encodeURIComponent(row.name)}/retry`, body: {} };
  if (section === 'reports') return { path: `reports/${row.id}/actions`, body: { status: action === 'suspend' ? 'resolved' : action, ...(action === 'suspend' ? { suspend: true } : {}) } };
  const entity = section === 'products' ? 'products' : section;
  return { path: `${entity}/${row.id}/actions`, body: { action } };
}

function actionFields(section, action) {
  if (section === 'users' && action === 'admin_role') return [{ key: 'adminRole', label: 'Admin role: super_admin, admin, moderator or support' }];
  if (section === 'matches' && action === 'reschedule') return [{ key: 'matchDate', label: 'New match date (ISO)' }];
  if (section === 'matches' && action === 'correct') return [
    { key: 'scoreHome', label: 'Home score', keyboardType: 'numeric' },
    { key: 'scoreAway', label: 'Away score', keyboardType: 'numeric' },
    { key: 'halfTimeHome', label: 'Home half-time score (optional)', keyboardType: 'numeric' },
    { key: 'halfTimeAway', label: 'Away half-time score (optional)', keyboardType: 'numeric' },
  ];
  if (section === 'matches' && action === 'edit') return [
    { key: 'venue', label: 'Venue (optional)' },
    { key: 'highlightsUrl', label: 'Highlights URL (optional)' },
  ];
  return [];
}

export default function AdminOperationsScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const [permissions, setPermissions] = useState([]);
  const [active, setActive] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [mediaSection, setMediaSection] = useState('videos');
  const [notificationTokens, setNotificationTokens] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [activityUser, setActivityUser] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  const availableSections = useMemo(() => SECTIONS.filter((item) =>
    hasPermission(permissions, item.permission) || (item.alternatePermission && hasPermission(permissions, item.alternatePermission))), [permissions]);
  const activeSection = availableSections.find((item) => item.id === active) || availableSections[0];

  useEffect(() => {
    let alive = true;
    adminSessionRequest().then((res) => {
      if (alive) {
        setPermissions(Array.isArray(res?.data?.permissions) ? res.data.permissions : []);
        setLoading(false);
      }
    }).catch((err) => {
      if (alive) {
        setError(extractErrorMessage(err, 'Admin access could not be verified.'));
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!activeSection) return;
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      let endpoint = SECTION_ENDPOINT[activeSection.id];
      const params = { page, limit: PAGE_SIZE, q: debouncedSearch.trim() || undefined, status: status || undefined };
      if (activeSection.id === 'media') params.section = mediaSection;
      if (activeSection.id === 'notifications' && notificationTokens) endpoint = 'notifications/tokens';
      if (activeSection.id === 'users') {
        const res = await adminUsersRequest({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch.trim() || undefined,
          role: status || undefined,
        });
        setData({ rows: res?.data?.users || [], pages: Number(res?.data?.pages || 1), total: Number(res?.data?.total || 0) });
      } else if (activeSection.id === 'finance') {
        const canReadFinance = hasPermission(permissions, 'finance.read');
        const canReadPayments = canReadFinance || hasPermission(permissions, 'payments.read');
        const [financeResult, paymentsResult] = await Promise.all([
          canReadFinance ? adminOpsGetRequest('finance') : Promise.resolve(null),
          canReadPayments ? adminOpsGetRequest('payments', { page, limit: PAGE_SIZE, status: status || undefined }) : Promise.resolve(null),
        ]);
        setData({ finance: financeResult?.data || null, payments: paymentsResult?.data || null });
      } else if (activeSection.id === 'system') {
        const requests = [
          adminOpsGetRequest('system'),
          adminOpsGetRequest('flags'),
          adminOpsGetRequest('maintenance'),
          adminOpsGetRequest('deployment'),
        ];
        const [systemResult, flagsResult, maintenanceResult, deploymentResult] = await Promise.allSettled(requests);
        setData({
          ...(systemResult.status === 'fulfilled' ? systemResult.value.data : {}),
          flags: flagsResult.status === 'fulfilled' ? flagsResult.value.data?.flags || [] : [],
          maintenance: maintenanceResult.status === 'fulfilled' ? maintenanceResult.value.data : null,
          deployment: deploymentResult.status === 'fulfilled' ? deploymentResult.value.data : null,
        });
      } else {
        const res = await adminOpsGetRequest(endpoint, activeSection.kind ? {} : params);
        setData(res.data);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load admin data.'));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSection, page, debouncedSearch, status, mediaSection, notificationTokens, permissions]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const changeSection = (id) => {
    setActive(id);
    setPage(1);
    setSearch('');
    setStatus('');
    setData(null);
  };

  const startAction = (section, row, action) => {
    setFields({});
    setReason('');
    setSelectedAction({ section, row, action, fields: actionFields(section, action) });
  };

  const showUserActivity = async (row) => {
    setActivityUser(row);
    setActivityData(null);
    setActivityLoading(true);
    try {
      const res = await adminOpsGetRequest(`users/${row.id}/activity`);
      setActivityData(res.data);
    } catch (err) {
      Alert.alert(t('Could not load activity'), extractErrorMessage(err, 'Could not load user activity.'));
      setActivityUser(null);
    } finally {
      setActivityLoading(false);
    }
  };

  const submitAction = async () => {
    if (!selectedAction) return;
    if (REASONS_REQUIRED.has(selectedAction.section) && (reason.trim().length < 3 || reason.trim().length > 500)) {
      Alert.alert(t('Reason required'), t('Enter a reason between 3 and 500 characters so the action can be audited.'));
      return;
    }
    if (selectedAction.section === 'jobs') {
      await runAction(() => adminOpsPostRequest(actionPath('jobs', selectedAction.row, selectedAction.action).path, { reason }));
      return;
    }
    const { section, row, action } = selectedAction;
    if (section === 'matches' && action === 'reschedule' && !String(fields.matchDate || '').trim()) {
      Alert.alert(t('Date required'), t('Enter the new match date and time.'));
      return;
    }
    if (section === 'matches' && action === 'correct' && (
      !String(fields.scoreHome ?? '').trim() || !String(fields.scoreAway ?? '').trim()
      || !Number.isFinite(Number(fields.scoreHome)) || !Number.isFinite(Number(fields.scoreAway))
    )) {
      Alert.alert(t('Invalid score'), t('Enter both scores as numbers.'));
      return;
    }
    if (section === 'users' && action === 'admin_role' && !fields.adminRole) {
      Alert.alert(t('Choose an admin role'), t('Select the admin permission level to assign.'));
      return;
    }
    const request = actionPath(section, row, action);
    const extra = Object.fromEntries(Object.entries(fields).filter(([, value]) => String(value ?? '').trim() !== ''));
    const payload = { ...request.body, ...extra, reason: reason.trim() };
    await runAction(() => section === 'users' && action === 'admin_role'
      ? adminOpsPutRequest(`users/${row.id}/admin-role`, payload)
      : adminOpsPostRequest(request.path, payload));
  };

  const runAction = async (operation) => {
    setBusy(true);
    try {
      await operation();
      setSelectedAction(null);
      await load(true);
    } catch (err) {
      Alert.alert(t('Action failed'), extractErrorMessage(err, 'The action could not be completed.'));
    } finally {
      setBusy(false);
    }
  };

  const startFlagAction = (flag) => {
    setFields({ flag: flag.flag, enabled: !flag.enabled });
    setReason('');
    setSelectedAction({ section: 'flags', action: flag.enabled ? 'Disable feature' : 'Enable feature', row: flag, fields: [] });
  };

  const startMaintenanceAction = () => {
    const maintenance = data?.maintenance || {};
    setFields({ enabled: !Boolean(maintenance.enabled), message: maintenance.message || '', estimatedMinutes: maintenance.estimatedMinutes == null ? '' : String(maintenance.estimatedMinutes) });
    setReason('');
    setSelectedAction({ section: 'maintenance', action: maintenance.enabled ? 'Disable maintenance' : 'Enable maintenance', row: maintenance, fields: [] });
  };

  const submitSpecialAction = async () => {
    if (reason.trim().length < 3 || reason.trim().length > 500) {
      Alert.alert(t('Reason required'), t('Enter a reason between 3 and 500 characters so the action can be audited.'));
      return;
    }
    if (selectedAction?.section === 'flags') {
      await runAction(() => adminOpsPutRequest(`flags/${encodeURIComponent(fields.flag)}`, { enabled: fields.enabled, reason: reason.trim() }));
    } else if (selectedAction?.section === 'maintenance') {
      await runAction(() => adminOpsPutRequest('maintenance', { ...fields, reason: reason.trim() }));
    } else if (selectedAction?.section === 'finance') {
      if (!fields.userId || !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(String(fields.amount || '')) || Number(fields.amount) <= 0 || !['credit', 'debit'].includes(fields.direction)) {
        Alert.alert(t('Check the fields'), t('Enter a user ID, credit or debit, and a positive amount.'));
        return;
      }
      await runAction(() => adminOpsPostRequest('finance/adjustments', {
        ...fields,
        reason: reason.trim(),
        idempotencyKey: `mobile-admin-${fields.userId}-${Date.now()}`,
      }));
    }
  };

  const renderObject = (obj, title) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object');
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {title ? <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text> : null}
        {entries.map(([key, value]) => (
          <View key={key} style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>{key}</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{valueText(value)}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderDashboard = () => {
    const today = data?.today || {};
    const metrics = data?.metrics || {};
    const metricRows = [
      ['System health', today.systemHealthPercent == null ? 'N/A' : `${today.systemHealthPercent}%`],
      ['Failed jobs', today.failedJobs], ['Failed payments', today.failedPayments],
      ['Open reports', today.openReports], ['New users', today.newUsers],
      ['New players', today.newPlayers], ['Orders today', today.orders],
      ['Live streams', today.liveStreams], ['API errors 24h', today.apiErrors],
      ['Storage', today.storagePercent == null ? 'N/A' : `${today.storagePercent}%`],
      ['Total users', metrics.totalUsers], ['Active users 7d', metrics.activeUsers],
      ['Players', metrics.players], ['Clubs', metrics.clubs], ['Matches', metrics.matches],
      ['Orders', metrics.orders], ['Revenue', metrics.revenue],
    ];
    const alerts = data?.actionRequired || data?.alerts || [];
    return (
      <>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('Operational snapshot')}</Text>
          <View style={styles.metricGrid}>{metricRows.map(([label, value]) => (
            <View key={label} style={[styles.metric, { backgroundColor: colors.bgElevated }]}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{valueText(value)}</Text>
              <Text style={[styles.detailLabel, { color: colors.muted }]}>{label}</Text>
            </View>
          ))}</View>
        </View>
        {Array.isArray(data?.status) ? data.status.map((item) => renderObject(item, item.label || item.key)) : null}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('Action required')}</Text>
        {alerts.length ? alerts.map((item, idx) => renderObject(item, item.description || `Alert ${idx + 1}`)) : (
          <Text style={[styles.empty, { color: colors.muted }]}>{t('No operational alerts.')}</Text>
        )}
      </>
    );
  };

  const renderFinance = () => (
    <>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('Finance summary')}</Text>
      {renderObject({
        joncoinCirculation: data?.finance?.joncoinCirculation,
        transactionVolume24h: data?.finance?.transactionVolume24h,
        successfulPayments: data?.finance?.payments?.successful,
        failedPayments: data?.finance?.payments?.failed,
        pendingPayments: data?.finance?.payments?.pending,
        refunds: data?.finance?.refunds,
      })}
      {data?.finance?.review ? renderObject({ failedPaymentsForReview: data.finance.review.failedPayments?.length, pendingWithdrawals: data.finance.review.pendingWithdrawals?.length }, t('Needs review')) : null}
      {hasPermission(permissions, 'finance.adjust') ? (
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => {
          setFields({ userId: '', direction: 'credit', amount: '' }); setReason('');
          setSelectedAction({ section: 'finance', action: 'Ledger adjustment', fields: [] });
        }}>
          <Text style={styles.primaryButtonText}>{t('Create ledger adjustment')}</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('Recent adjustments')}</Text>
      {(data?.finance?.adjustments || []).map((row) => renderObject(row, `${t('Adjustment')} #${row.id}`))}
      {(data?.payments?.rows || []).map((row) => renderObject(row, `${t('Payment')} #${row.id}`))}
      <Text style={[styles.note, { color: colors.muted }]}>{data?.payments?.retryNote || t('Payments cannot be marked successful from the admin panel.')}</Text>
    </>
  );

  const renderNotifications = () => (
    <>
      {data?.summary ? renderObject(data.summary, t('Delivery summary')) : null}
      {renderRecords()}
    </>
  );

  const renderSystem = () => (
    <>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('System health')}</Text>
      {(data?.status || []).map((row) => renderObject(row, row.label || row.key))}
      {data?.api?.windows ? Object.values(data.api.windows).map((row) => renderObject(row, `API ${row.window}`)) : null}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('Feature flags')}</Text>
      {(data?.flags || []).map((flag) => (
        <View key={flag.flag} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{flag.flag === 'JONCOIN' ? 'XCOIN' : flag.flag}</Text>
              <Text style={[styles.detailLabel, { color: colors.muted }]}>{flag.enabled ? t('Enabled') : t('Disabled')}</Text>
            </View>
            {hasPermission(permissions, 'flags.manage') ? <ActionButton label={flag.enabled ? t('Disable') : t('Enable')} colors={colors} onPress={() => startFlagAction(flag)} /> : null}
          </View>
        </View>
      ))}
      {data?.maintenance ? renderObject(data.maintenance, t('Maintenance mode')) : null}
      {hasPermission(permissions, 'maintenance.manage') ? <ActionButton label={data?.maintenance?.enabled ? t('Disable maintenance') : t('Configure maintenance')} colors={colors} onPress={startMaintenanceAction} /> : null}
      {data?.deployment ? renderObject(data.deployment, t('Deployment')) : null}
    </>
  );

  const renderRecords = () => {
    const recordRows = Array.isArray(data) ? data : data?.rows;
    if (!Array.isArray(recordRows)) return <Text style={[styles.empty, { color: colors.muted }]}>{t('No records')}</Text>;
    if (!recordRows.length) return <Text style={[styles.empty, { color: colors.muted }]}>{t('No records')}</Text>;
    return recordRows.map((row, index) => {
      const details = rowSummary(row, activeSection.id);
      const actions = actionsFor(activeSection.id, row, permissions);
      return (
        <View key={`${activeSection.id}-${row.id ?? row.name ?? index}`} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{row.name || row.title || row.player || row.competition || (row.firstName || row.lastName ? `${row.firstName || ''} ${row.lastName || ''}`.trim() : '') || `${activeSection.label} ${row.id ?? ''}`}</Text>
          {details.map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.muted }]}>{key}</Text>
              <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={3}>{valueText(value)}</Text>
            </View>
          ))}
          {activeSection.id === 'users' && hasPermission(permissions, 'users.read') ? (
            <ActionButton label={t('View activity')} colors={colors} onPress={() => showUserActivity(row)} />
          ) : null}
          {actions.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
            {actions.map((action) => (
              <ActionButton key={action} label={t(action.replaceAll('_', ' '))} colors={colors} onPress={() => startAction(activeSection.id, row, action)} />
            ))}
          </ScrollView> : null}
        </View>
      );
    });
  };

  const showFilters = activeSection && !['dashboard', 'analytics', 'finance', 'system', 'deployment', 'jobs'].includes(activeSection.id);

  if (!permissions.length && loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ color: colors.muted, marginTop: 10 }}>{t('Checking admin permissions…')}</Text></View>;
  }

  if (!permissions.length) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.danger, textAlign: 'center' }}>{error || t('This account does not have access to admin operations.')}</Text>
    </View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('Admin Operations Center')}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>{t('Permission-controlled platform administration')}</Text>
        {error ? <Text style={{ color: colors.danger, marginTop: 6 }}>{error}</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabRow}>
        {availableSections.map((section) => (
          <TouchableOpacity key={section.id} onPress={() => changeSection(section.id)} style={[styles.tab, { borderColor: colors.border, backgroundColor: activeSection?.id === section.id ? colors.primary : colors.card }]}>
            <Text style={{ color: activeSection?.id === section.id ? colors.onPrimary : colors.text, fontWeight: '700' }}>{t(section.label)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {showFilters ? (
        <View style={styles.filters}>
          <TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} placeholder={t('Search')} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} />
          <TextInput value={status} onChangeText={(value) => { setStatus(value); setPage(1); }} placeholder={t(activeSection.id === 'users' ? 'Role filter' : 'Status filter')} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} />
        </View>
      ) : null}
      {activeSection?.id === 'media' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabs}>
          {['videos', 'highlights', 'live', 'replays'].map((item) => <ActionButton key={item} label={t(item)} colors={colors} active={mediaSection === item} onPress={() => { setMediaSection(item); setPage(1); }} />)}
        </ScrollView>
      ) : null}
      {activeSection?.id === 'notifications' ? (
        <View style={styles.subTabs}><ActionButton label={t('Notifications')} colors={colors} active={!notificationTokens} onPress={() => { setNotificationTokens(false); setPage(1); }} /><ActionButton label={t('Invalid tokens')} colors={colors} active={notificationTokens} onPress={() => { setNotificationTokens(true); setPage(1); }} /></View>
      ) : null}
      <FlatList
        key={active}
        data={[]}
        keyExtractor={(item, index) => `${active}-${item?.id ?? item?.name ?? index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        ListHeaderComponent={loading ? <ActivityIndicator style={{ margin: 20 }} color={colors.primary} /> : activeSection?.id === 'dashboard' ? renderDashboard() : activeSection?.id === 'analytics' ? <>{renderObject(data?.today, t('Today'))}{renderObject(data?.metrics, t('Key metrics'))}{renderObject(data?.api, t('API'))}</> : activeSection?.id === 'finance' ? renderFinance() : activeSection?.id === 'system' ? renderSystem() : activeSection?.id === 'deployment' ? renderObject(data, t('Deployment details')) : activeSection?.id === 'notifications' ? renderNotifications() : activeSection?.id === 'jobs' ? (Array.isArray(data) ? data.map((job) => <View key={job.name}>{renderObject(job, job.name)}{actionsFor('jobs', job, permissions).map((action) => <ActionButton key={action} label={t(action)} colors={colors} onPress={() => startAction('jobs', job, action)} />)}</View>) : renderRecords()) : renderRecords()}
        ListFooterComponent={activeSection && !activeSection.kind && data?.pages > 1 ? (
          <View style={styles.pager}>
            <ActionButton label={t('Previous')} colors={colors} onPress={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} />
            <Text style={{ color: colors.muted }}>{page} / {data.pages}</Text>
            <ActionButton label={t('Next')} colors={colors} onPress={() => setPage((current) => Math.min(data.pages, current + 1))} disabled={page >= data.pages} />
          </View>
        ) : <View style={{ height: 18 }} />}
      />
      <ActionModal
        visible={Boolean(selectedAction)}
        selectedAction={selectedAction}
        reason={reason}
        fields={fields}
        busy={busy}
        colors={colors}
        t={t}
        onReason={setReason}
        onField={(key, value) => setFields((current) => ({ ...current, [key]: value }))}
        onCancel={() => setSelectedAction(null)}
        onSubmit={() => ['flags', 'maintenance', 'finance'].includes(selectedAction?.section) ? submitSpecialAction() : submitAction()}
      />
      <Modal visible={Boolean(activityUser)} transparent animationType="fade" onRequestClose={() => setActivityUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('User activity')} · {activityUser?.firstName || ''} {activityUser?.lastName || ''}</Text>
            <ScrollView style={{ maxHeight: 520 }}>
              {activityLoading ? <ActivityIndicator style={{ margin: 24 }} color={colors.primary} /> : <>
                {renderObject({ lastSeenAt: activityData?.lastSeenAt }, t('Account'))}
                {['posts', 'orders', 'payments'].map((key) => (
                  <View key={key}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t(key)}</Text>
                    {(activityData?.[key] || []).map((item, index) => renderObject(item, `${t(key)} #${item.id || index + 1}`))}
                    {!activityData?.[key]?.length ? <Text style={[styles.note, { color: colors.muted }]}>{t('No recent activity')}</Text> : null}
                  </View>
                ))}
              </>}
            </ScrollView>
            <View style={styles.modalActions}><ActionButton label={t('Close')} colors={colors} onPress={() => setActivityUser(null)} /></View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActionButton({ label, colors, onPress, active = false, disabled = false }) {
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.actionButton, { backgroundColor: active ? colors.primary : colors.bgElevated, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={{ color: active ? colors.onPrimary : colors.text, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionModal({ visible, selectedAction, reason, fields, busy, colors, t, onReason, onField, onCancel, onSubmit }) {
  const customFields = selectedAction?.fields || [];
  const section = selectedAction?.section;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{t(selectedAction?.action || 'Confirm action')}</Text>
          <Text style={[styles.note, { color: colors.muted }]}>{t('This operation is permission checked and written to the audit log.')}</Text>
          {section === 'finance' ? <>
            <TextInput value={String(fields.userId || '')} onChangeText={(value) => onField('userId', value)} keyboardType="numeric" placeholder={t('User ID')} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} />
            <View style={styles.choiceRow}>
              <ActionButton label={t('Credit')} colors={colors} active={fields.direction === 'credit'} onPress={() => onField('direction', 'credit')} />
              <ActionButton label={t('Debit')} colors={colors} active={fields.direction === 'debit'} onPress={() => onField('direction', 'debit')} />
            </View>
            <TextInput value={String(fields.amount || '')} onChangeText={(value) => onField('amount', value)} keyboardType="decimal-pad" placeholder={t('Amount')} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} />
          </> : null}
          {section === 'maintenance' ? <>
            <TextInput value={String(fields.message || '')} onChangeText={(value) => onField('message', value)} placeholder={t('Maintenance message')} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} />
            <TextInput value={String(fields.estimatedMinutes ?? '')} onChangeText={(value) => onField('estimatedMinutes', value)} keyboardType="numeric" placeholder={t('Estimated minutes (optional)')} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} />
          </> : null}
          {section === 'users' && selectedAction?.action === 'admin_role' ? (
            <View style={styles.choiceRow}>
              {['super_admin', 'admin', 'moderator', 'support'].map((role) => (
                <ActionButton key={role} label={role} colors={colors} active={fields.adminRole === role} onPress={() => onField('adminRole', role)} />
              ))}
            </View>
          ) : null}
          {customFields.filter((field) => !(section === 'users' && selectedAction?.action === 'admin_role')).map((field) => (
            <TextInput key={field.key} value={String(fields[field.key] ?? '')} onChangeText={(value) => onField(field.key, value)} keyboardType={field.keyboardType} placeholder={t(field.label)} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} />
          ))}
          {REASONS_REQUIRED.has(section) ? <TextInput value={reason} onChangeText={onReason} placeholder={t('Reason (required for audit)')} placeholderTextColor={colors.muted} multiline style={[styles.input, styles.reasonInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} /> : null}
          <View style={styles.modalActions}>
            <ActionButton label={t('Cancel')} colors={colors} onPress={onCancel} disabled={busy} />
            <TouchableOpacity disabled={busy} onPress={onSubmit} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryButtonText}>{t('Confirm')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  tabs: { maxHeight: 54, flexGrow: 0 },
  tabRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  filters: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, marginBottom: 8 },
  listContent: { padding: 12, gap: 10, paddingBottom: 28 },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  cardTitle: { fontWeight: '800', fontSize: 15, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  detailLabel: { fontSize: 12, flex: 1, textTransform: 'capitalize' },
  detailValue: { fontSize: 12, flex: 1.2, textAlign: 'right' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { width: '48%', minHeight: 64, borderRadius: 10, padding: 9, justifyContent: 'center' },
  metricValue: { fontSize: 16, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginVertical: 8 },
  empty: { padding: 22, textAlign: 'center' },
  actionRow: { gap: 6, marginTop: 10 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  actionButton: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  subTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 12 },
  note: { fontSize: 12, marginVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 500, borderWidth: 1, borderRadius: 18, padding: 16, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  reasonInput: { minHeight: 76, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
