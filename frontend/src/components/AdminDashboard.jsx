import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getFullUrl } from '../utils/mediaUrl';
import {
  UsersIcon,
  DocumentTextIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  BoltIcon,
  PlayIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function apiError(error, fallback = 'Veprimi dështoi') {
  return (
    error?.response?.data?.msg ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ role: '', verified: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [resetPasswordModal, setResetPasswordModal] = useState({ show: false, userId: null, email: '' });
  const [newPassword, setNewPassword] = useState('');
  const [joncoinPending, setJoncoinPending] = useState([]);
  const [joncoinLoading, setJoncoinLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsStatus, setReportsStatus] = useState('pending');
  const [actionBusy, setActionBusy] = useState(false);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const res = await api.get('/admin/analytics');
      setAnalytics(res.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalyticsError(apiError(error, 'Failed to load analytics'));
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm || undefined,
        role: filters.role || undefined,
        verified: filters.verified || undefined,
      };
      const res = await api.get('/admin/users', { params });
      setUsers(res.data.users || []);
      setPagination((prev) => ({
        ...prev,
        total: res.data.total,
        pages: res.data.pages,
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      window.alert(apiError(error, 'Nuk u ngarkuan users'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, filters.role, filters.verified]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm || undefined,
      };
      const res = await api.get('/admin/posts', { params });
      setPosts(res.data.posts || []);
      setPagination((prev) => ({
        ...prev,
        total: res.data.total,
        pages: res.data.pages,
      }));
    } catch (error) {
      console.error('Error fetching posts:', error);
      window.alert(apiError(error, 'Nuk u ngarkuan posts'));
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm]);

  const fetchJoncoinPending = async () => {
    setJoncoinLoading(true);
    try {
      const res = await api.get('/admin/joncoin/pending');
      setJoncoinPending(res.data.transactions || []);
    } catch (error) {
      console.error('Error fetching JonCoin pending:', error);
      window.alert(apiError(error, 'Nuk u ngarkuan JonCoin pending'));
      setJoncoinPending([]);
    } finally {
      setJoncoinLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await api.get('/moderation/admin/reports', {
        params: { status: reportsStatus || 'pending' },
      });
      setReports(res.data?.reports || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      window.alert(apiError(error, 'Nuk u ngarkuan reports'));
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  };

  const handleReviewReport = async (reportId, status) => {
    setActionBusy(true);
    try {
      await api.put(`/moderation/admin/reports/${reportId}`, { status });
      await fetchReports();
    } catch (error) {
      console.error('Error reviewing report:', error);
      window.alert(apiError(error, 'Update failed'));
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAnalytics();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'content') {
      fetchPosts();
    } else if (activeTab === 'joncoin') {
      fetchJoncoinPending();
    } else if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, searchTerm, filters, pagination.page, fetchUsers, fetchPosts, reportsStatus]);

  const handleJoncoinDecision = async (txId, status) => {
    const label = status === 'completed' ? 'approve' : 'reject';
    if (!window.confirm(`${label === 'approve' ? 'Approve' : 'Reject'} this JonCoin transaction?`)) return;
    setActionBusy(true);
    try {
      await api.patch(`/joncoin/transaction/${txId}`, { status });
      await fetchJoncoinPending();
    } catch (error) {
      console.error('JonCoin transaction update:', error);
      window.alert(apiError(error, 'Update failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === user?.id) {
      window.alert('Nuk mund të fshish veten');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setActionBusy(true);
    try {
      await api.delete(`/admin/users/${userId}`);
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      window.alert(apiError(error, 'Delete failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleBanUser = async (userId) => {
    if (userId === user?.id) {
      window.alert('Nuk mund të banosh veten');
      return;
    }
    if (!window.confirm('Are you sure you want to ban this user?')) return;
    setActionBusy(true);
    try {
      await api.post(`/admin/users/${userId}/ban`, { reason: 'Admin action' });
      await fetchUsers();
    } catch (error) {
      console.error('Error banning user:', error);
      window.alert(apiError(error, 'Ban failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleUnbanUser = async (userId) => {
    setActionBusy(true);
    try {
      await api.post(`/admin/users/${userId}/unban`);
      await fetchUsers();
    } catch (error) {
      console.error('Error unbanning user:', error);
      window.alert(apiError(error, 'Unban failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleVerifyUser = async (userId) => {
    setActionBusy(true);
    try {
      await api.post(`/admin/users/${userId}/verify`);
      await fetchUsers();
    } catch (error) {
      console.error('Error verifying user:', error);
      window.alert(apiError(error, 'Verify failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleTogglePremium = async (userId) => {
    setActionBusy(true);
    try {
      await api.post(`/admin/users/${userId}/premium`);
      await fetchUsers();
    } catch (error) {
      console.error('Error toggling premium:', error);
      window.alert(apiError(error, 'Premium toggle failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    setActionBusy(true);
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      await fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      window.alert(apiError(error, 'Role update failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setActionBusy(true);
    try {
      await api.delete(`/admin/posts/${postId}`);
      await fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      window.alert(apiError(error, 'Delete post failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setActionBusy(true);
    try {
      await api.post(`/admin/users/${resetPasswordModal.userId}/reset-password`, { newPassword });
      alert('Password reset successfully!');
      setResetPasswordModal({ show: false, userId: null, email: '' });
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(apiError(error, 'Failed to reset password'));
    } finally {
      setActionBusy(false);
    }
  };

  const switchTab = (tab) => {
    setSearchTerm('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setActiveTab(tab);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Access denied. Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage users, content, and monitor platform activity</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => switchTab('dashboard')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'dashboard'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ChartBarIcon className="w-5 h-5 inline mr-2" />
          Dashboard
        </button>
        <button
          onClick={() => switchTab('users')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'users'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <UsersIcon className="w-5 h-5 inline mr-2" />
          Users
        </button>
        <button
          onClick={() => switchTab('content')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'content'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <DocumentTextIcon className="w-5 h-5 inline mr-2" />
          Content
        </button>
        <button
          onClick={() => switchTab('joncoin')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'joncoin'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BanknotesIcon className="w-5 h-5 inline mr-2" />
          JonCoin
        </button>
        <button
          onClick={() => switchTab('reports')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'reports'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ShieldCheckIcon className="w-5 h-5 inline mr-2" />
          Reports
        </button>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {analyticsLoading && (
            <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500 text-sm">
              Loading analytics…
            </div>
          )}
          {analyticsError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between gap-4">
              <p className="text-red-800 text-sm">{analyticsError}</p>
              <button
                type="button"
                onClick={fetchAnalytics}
                className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          ) : null}
          {analytics && (
            <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={analytics.totals?.users ?? 0}
              icon={<UsersIcon className="w-6 h-6" />}
              color="blue"
              subtitle={`${analytics.recentActivity?.users ?? 0} new this week`}
            />
            <StatCard
              title="Total Posts"
              value={analytics.totals?.posts ?? 0}
              icon={<DocumentTextIcon className="w-6 h-6" />}
              color="green"
              subtitle={`${analytics.recentActivity?.posts ?? 0} new this week`}
            />
            <StatCard
              title="Active Users"
              value={analytics.recentActivity?.activeUsers ?? 0}
              icon={<BoltIcon className="w-6 h-6" />}
              color="purple"
              subtitle="Last 7 days"
            />
            <StatCard
              title="Total Videos"
              value={analytics.totals?.videos ?? 0}
              icon={<PlayIcon className="w-6 h-6" />}
              color="red"
              subtitle={`${analytics.recentActivity?.videos ?? 0} new this week`}
            />
          </div>

          {/* Full totals grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Comments', analytics.totals?.comments],
              ['Likes', analytics.totals?.likes],
              ['Messages', analytics.totals?.messages],
              ['Matches', analytics.totals?.matches],
              ['Tournaments', analytics.totals?.tournaments],
              ['Streams', analytics.totals?.streams],
              ['Live streams', analytics.totals?.liveStreams],
              ['Subscriptions', analytics.totals?.subscriptions],
              ['Orders', analytics.totals?.orders],
              ['Payments', analytics.totals?.payments],
              ['JonCoin txs', analytics.totals?.joncoinTransactions],
              ['Reports', analytics.totals?.reports],
              ['Blocks', analytics.totals?.blocks],
            ].map(([label, value]) => (
              <div key={label} className="bg-white shadow rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{value ?? 0}</div>
                <div className="text-sm text-gray-600">{label}</div>
              </div>
            ))}
          </div>

          {/* System Health */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">System Health</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {analytics.systemHealth?.activeStreams ?? 0}
                </div>
                <div className="text-sm text-gray-600">Active Streams</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {analytics.systemHealth?.liveNow ?? 0}
                </div>
                <div className="text-sm text-gray-600">Live now</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.systemHealth?.processingVideos ?? 0}
                </div>
                <div className="text-sm text-gray-600">Processing Videos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {analytics.systemHealth?.verifiedUsers ?? 0}
                </div>
                <div className="text-sm text-gray-600">Verified Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {analytics.systemHealth?.premiumUsers ?? 0}
                </div>
                <div className="text-sm text-gray-600">Premium Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.systemHealth?.pendingReports ?? 0}
                </div>
                <div className="text-sm text-gray-600">Pending reports</div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly User Registrations */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">User Registrations (Last 12 Months)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.monthlyUsers || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} name="New Users" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Posts */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Daily Posts (Last 30 Days)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.dailyPosts || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#10B981" name="Posts" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Roles Distribution */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">User Roles Distribution</h3>
              {(analytics.userRoles || []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-16">No role data</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.userRoles}
                      dataKey="count"
                      nameKey="role"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.role}: ${entry.count}`}
                    >
                      {(analytics.userRoles || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Posters */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Top 10 Posters</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {(analytics.topPosters || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No posters yet</p>
                ) : (
                  (analytics.topPosters || []).map((poster, index) => (
                  <div key={poster.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {index + 1}
                      </div>
                      <span className="font-medium">{poster.name}</span>
                    </div>
                    <span className="text-gray-600">{poster.posts} posts</span>
                  </div>
                  ))
                )}
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'users' && (        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <select
                value={filters.role}
                onChange={(e) => {
                  setFilters({ ...filters, role: e.target.value });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="athlete">Athlete</option>
                <option value="coach">Coach</option>
                <option value="scout">Scout</option>
                <option value="manager">Manager</option>
                <option value="referee">Referee</option>
                <option value="club">Club</option>
                <option value="business">Business</option>
                <option value="media">Media</option>
                <option value="federation">Federation</option>
                <option value="liga">Liga</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={filters.verified}
                onChange={(e) => {
                  setFilters({ ...filters, verified: e.target.value });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Users</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {loading && (
              <div className="p-6 text-center text-gray-500 text-sm">Loading users…</div>
            )}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={getFullUrl(u.Profile?.profilePhoto || u.Profile?.profilePicture) || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${u.firstName || ''}+${u.lastName || ''}`)}`}
                          alt={`${u.firstName} ${u.lastName}`}
                          className="w-10 h-10 rounded-full mr-3 object-cover"
                        />
                        <div>
                          <div className="font-medium text-gray-900">
                            {u.firstName} {u.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="athlete">Athlete</option>
                        <option value="coach">Coach</option>
                        <option value="scout">Scout</option>
                        <option value="manager">Manager</option>
                        <option value="referee">Referee</option>
                        <option value="club">Club</option>
                        <option value="business">Business</option>
                        <option value="media">Media</option>
                        <option value="federation">Federation</option>
                        <option value="liga">Liga</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        {u.bannedAt && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Banned
                          </span>
                        )}
                        {u.verified && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="w-3 h-3 mr-1" />
                            Verified
                          </span>
                        )}
                        {u.premium && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            <ShieldCheckIcon className="w-3 h-3 mr-1" />
                            Premium
                          </span>
                        )}
                        {!u.verified && !u.bannedAt && (
                          <span className="text-xs text-gray-400">Unverified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      {!u.verified && (
                        <button
                          onClick={() => handleVerifyUser(u.id)}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          title="Verify User"
                          disabled={actionBusy}
                        >
                          <CheckCircleIcon className="w-5 h-5 inline" />
                        </button>
                      )}
                      <button
                        onClick={() => setResetPasswordModal({ show: true, userId: u.id, email: u.email })}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                        title="Reset Password"
                        disabled={actionBusy}
                      >
                        <BoltIcon className="w-5 h-5 inline" />
                      </button>
                      <button
                        onClick={() => handleTogglePremium(u.id)}
                        className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                        title={u.premium ? 'Remove Premium' : 'Make Premium'}
                        disabled={actionBusy}
                      >
                        <ShieldCheckIcon className="w-5 h-5 inline" />
                      </button>
                      {u.bannedAt ? (
                        <button
                          onClick={() => handleUnbanUser(u.id)}
                          className="text-green-700 hover:text-green-900 disabled:opacity-50"
                          title="Unban User"
                          disabled={actionBusy}
                        >
                          <CheckCircleIcon className="w-5 h-5 inline" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBanUser(u.id)}
                          className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                          title="Ban User"
                          disabled={actionBusy || u.id === user?.id}
                        >
                          <XCircleIcon className="w-5 h-5 inline" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Delete User"
                        disabled={actionBusy || u.id === user?.id}
                      >
                        <TrashIcon className="w-5 h-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && users.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm">No users found.</div>
            )}
          </div>

          {/* Pagination */}
          <Pagination pagination={pagination} setPagination={setPagination} />
        </div>
      )}

      {activeTab === 'content' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 gap-4">
            {loading && (
              <div className="p-6 text-center text-gray-500 text-sm bg-white shadow rounded-lg">Loading posts…</div>
            )}
            {!loading && posts.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm bg-white shadow rounded-lg">No posts found.</div>
            )}
            {posts.map((post) => {
              const postUser = post.User || post.author;
              const avatar = getFullUrl(
                postUser?.Profile?.profilePhoto || postUser?.Profile?.profilePicture
              );
              const imageSrc = getFullUrl(post.imageUrl || post.image);
              const videoSrc = getFullUrl(post.videoUrl);
              return (
              <div key={post.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <img
                      src={
                        avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          `${postUser?.firstName || ''}+${postUser?.lastName || ''}`
                        )}`
                      }
                      alt={`${postUser?.firstName || ''} ${postUser?.lastName || ''}`}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {postUser?.firstName} {postUser?.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{postUser?.email}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(post.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    disabled={actionBusy}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt="Post"
                      className="mt-4 rounded-lg max-h-96 object-cover"
                    />
                  ) : null}
                  {videoSrc ? (
                    <video
                      src={videoSrc}
                      controls
                      className="mt-4 rounded-lg max-h-96 w-full bg-black"
                    />
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination pagination={pagination} setPagination={setPagination} />
        </div>
      )}

      {activeTab === 'joncoin' && (
        <div className="space-y-4">
          <div className="bg-white shadow rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Pending purchases, withdrawals, and other JonCoin rows awaiting approval.
            </p>
            <button
              type="button"
              onClick={() => fetchJoncoinPending()}
              className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
              Refresh
            </button>
          </div>

          {joncoinLoading ? (
            <div className="text-gray-500 text-sm">Loading…</div>
          ) : joncoinPending.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500 text-sm">
              No pending JonCoin transactions.
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">User</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Type</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Amount</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Description</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Created</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {joncoinPending.map((tx) => {
                    const u = tx.User || tx.user;
                    return (
                      <tr key={tx.id}>
                        <td className="px-4 py-2 text-gray-900">{tx.id}</td>
                        <td className="px-4 py-2">
                          <div className="text-gray-900">
                            {u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : '—'}
                          </div>
                          {u?.email && (
                            <div className="text-xs text-gray-500">{u.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-800">{tx.type}</td>
                        <td className="px-4 py-2 text-right font-mono">{tx.amount}</td>
                        <td className="px-4 py-2 text-gray-600 max-w-xs truncate" title={tx.description}>
                          {tx.description || '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleJoncoinDecision(tx.id, 'completed')}
                            className="inline-flex items-center px-2 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700 disabled:opacity-50"
                            disabled={actionBusy}
                          >
                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleJoncoinDecision(tx.id, 'rejected')}
                            className="inline-flex items-center px-2 py-1 rounded bg-gray-200 text-gray-800 text-xs hover:bg-gray-300 disabled:opacity-50"
                            disabled={actionBusy}
                          >
                            <XCircleIcon className="w-4 h-4 mr-1" />
                            Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white shadow rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">User reports (UGC moderation).</p>
            <div className="flex items-center gap-2">
              <select
                value={reportsStatus}
                onChange={(e) => setReportsStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="pending">Pending</option>
                <option value="actioned">Actioned</option>
                <option value="dismissed">Dismissed</option>
                <option value="reviewed">Reviewed</option>
                <option value="all">All</option>
              </select>
              <button
                type="button"
                onClick={() => fetchReports()}
                className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                Refresh
              </button>
            </div>
          </div>
          {reportsLoading ? (
            <div className="text-gray-500 text-sm">Loading…</div>
          ) : reports.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500 text-sm">
              No reports for this filter.
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Reporter</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Target</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Reason</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Details</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Created</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{r.id}</td>
                      <td className="px-4 py-2">
                        {r.reporter
                          ? `${r.reporter.firstName || ''} ${r.reporter.lastName || ''}`.trim() || r.reporter.email
                          : r.reporterId}
                      </td>
                      <td className="px-4 py-2">
                        {r.targetType} #{r.targetId}
                      </td>
                      <td className="px-4 py-2">{r.reason}</td>
                      <td className="px-4 py-2 max-w-xs truncate" title={r.details || ''}>
                        {r.details || '—'}
                      </td>
                      <td className="px-4 py-2">{r.status}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                        {r.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReviewReport(r.id, 'actioned')}
                              className="inline-flex items-center px-2 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700 disabled:opacity-50"
                              disabled={actionBusy}
                            >
                              Actioned
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReviewReport(r.id, 'dismissed')}
                              className="inline-flex items-center px-2 py-1 rounded bg-gray-200 text-gray-800 text-xs hover:bg-gray-300 disabled:opacity-50"
                              disabled={actionBusy}
                            >
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
    {resetPasswordModal.show && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-xl font-bold mb-4">Reset Password</h3>
          <p className="text-gray-600 mb-4">
            Reset password for: <span className="font-semibold">{resetPasswordModal.email}</span>
          </p>
          <input
            type="text"
            placeholder="New Password (min 6 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
          />
          <div className="flex space-x-3">
            <button
              onClick={handleResetPassword}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Reset Password
            </button>
            <button
              onClick={() => {
                setResetPasswordModal({ show: false, userId: null, email: '' });
                setNewPassword('');
              }}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Sidebar - live snapshot */}
    <div className="lg:col-span-1 space-y-4">
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-900">Quick stats</h4>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="text-xs text-blue-600 hover:underline"
          >
            Refresh
          </button>
        </div>
        {analyticsLoading && !analytics ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : (
          <dl className="space-y-2 text-sm">
            {[
              ['Users', analytics?.totals?.users],
              ['Posts', analytics?.totals?.posts],
              ['Active (7d)', analytics?.recentActivity?.activeUsers],
              ['Premium', analytics?.systemHealth?.premiumUsers],
              ['Live now', analytics?.systemHealth?.liveNow ?? analytics?.systemHealth?.activeStreams],
              ['Pending reports', analytics?.systemHealth?.pendingReports],
              ['Messages', analytics?.totals?.messages],
              ['JonCoin txs', analytics?.totals?.joncoinTransactions],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-gray-600">{label}</dt>
                <dd className="font-semibold text-gray-900">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <h4 className="font-bold text-gray-900 mb-2">Shortcuts</h4>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => switchTab('users')}
            className="w-full text-left text-sm px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-800"
          >
            Manage users
          </button>
          <button
            type="button"
            onClick={() => switchTab('reports')}
            className="w-full text-left text-sm px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-800"
          >
            Review reports
          </button>
          <button
            type="button"
            onClick={() => switchTab('joncoin')}
            className="w-full text-left text-sm px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-800"
          >
            JonCoin pending
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
  );
}

function StatCard({ title, value, icon, color, subtitle }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-lg text-white`}>{icon}</div>
      </div>
    </div>
  );
}

function Pagination({ pagination, setPagination }) {
  if (!pagination.pages || pagination.pages <= 1) return null;

  return (
    <div className="flex items-center justify-between bg-white shadow rounded-lg px-4 py-3">
      <div className="text-sm text-gray-700">
        Page {pagination.page} of {pagination.pages}
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          disabled={pagination.page === 1}
          className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        <button
          onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          disabled={pagination.page === pagination.pages}
          className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
