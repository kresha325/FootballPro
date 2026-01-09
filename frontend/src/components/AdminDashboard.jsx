import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ role: '', verified: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [resetPasswordModal, setResetPasswordModal] = useState({ show: false, userId: null, email: '' });
  const [newPassword, setNewPassword] = useState('');

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
    }
  }, [activeTab, searchTerm, filters, pagination.page]);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/admin/analytics');
      setAnalytics(res.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchUsers = async () => {
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
      setUsers(res.data.users);
      setPagination(prev => ({ ...prev, total: res.data.total, pages: res.data.pages }));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm || undefined,
      };
      const res = await api.get('/admin/posts', { params });
      setPosts(res.data.posts);
      setPagination(prev => ({ ...prev, total: res.data.total, pages: res.data.pages }));
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleBanUser = async (userId) => {
    if (!window.confirm('Are you sure you want to ban this user?')) return;
    try {
      await api.post(`/admin/users/${userId}/ban`, { reason: 'Admin action' });
      fetchUsers();
    } catch (error) {
      console.error('Error banning user:', error);
    }
  };

  const handleVerifyUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/verify`);
      fetchUsers();
    } catch (error) {
      console.error('Error verifying user:', error);
    }
  };

  const handleTogglePremium = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/premium`);
      fetchUsers();
    } catch (error) {
      console.error('Error toggling premium:', error);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.delete(`/admin/posts/${postId}`);
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    try {
      await api.post(`/admin/users/${resetPasswordModal.userId}/reset-password`, { newPassword });
      alert('Password reset successfully!');
      setResetPasswordModal({ show: false, userId: null, email: '' });
      setNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password');
    }
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
      <div className="flex space-x-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('dashboard')}
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
          onClick={() => setActiveTab('users')}
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
          onClick={() => setActiveTab('content')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'content'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <DocumentTextIcon className="w-5 h-5 inline mr-2" />
          Content
        </button>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'dashboard' && analytics && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={analytics.totals.users}
              icon={<UsersIcon className="w-6 h-6" />}
              color="blue"
              subtitle={`${analytics.recentActivity.users} new this week`}
            />
            <StatCard
              title="Total Posts"
              value={analytics.totals.posts}
              icon={<DocumentTextIcon className="w-6 h-6" />}
              color="green"
              subtitle={`${analytics.recentActivity.posts} new this week`}
            />
            <StatCard
              title="Active Users"
              value={analytics.recentActivity.activeUsers}
              icon={<BoltIcon className="w-6 h-6" />}
              color="purple"
              subtitle="Last 7 days"
            />
            <StatCard
              title="Total Videos"
              value={analytics.totals.videos}
              icon={<PlayIcon className="w-6 h-6" />}
              color="red"
              subtitle={`${analytics.recentActivity.videos} new this week`}
            />
          </div>

          {/* System Health */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">System Health</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {analytics.systemHealth.activeStreams}
                </div>
                <div className="text-sm text-gray-600">Active Streams</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.systemHealth.processingVideos}
                </div>
                <div className="text-sm text-gray-600">Processing Videos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {analytics.systemHealth.verifiedUsers}
                </div>
                <div className="text-sm text-gray-600">Verified Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {analytics.systemHealth.premiumUsers}
                </div>
                <div className="text-sm text-gray-600">Premium Users</div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly User Registrations */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">User Registrations (Last 12 Months)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.monthlyUsers}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
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
                <BarChart data={analytics.dailyPosts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
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
                    {analytics.userRoles.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Posters */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Top 10 Posters</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {analytics.topPosters.map((poster, index) => (
                  <div key={poster.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {index + 1}
                      </div>
                      <span className="font-medium">{poster.name}</span>
                    </div>
                    <span className="text-gray-600">{poster.posts} posts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{analytics.totals.comments}</div>
              <div className="text-sm text-gray-600">Comments</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{analytics.totals.likes}</div>
              <div className="text-sm text-gray-600">Likes</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{analytics.totals.tournaments}</div>
              <div className="text-sm text-gray-600">Tournaments</div>
            </div>
            <div className="bg-white shadow rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{analytics.totals.matches}</div>
              <div className="text-sm text-gray-600">Matches</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
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
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="player">Player</option>
                <option value="coach">Coach</option>
                <option value="scout">Scout</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={filters.verified}
                onChange={(e) => setFilters({ ...filters, verified: e.target.value })}
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
                          src={u.Profile?.profilePicture || `https://ui-avatars.com/api/?name=${u.firstName}+${u.lastName}`}
                          alt={`${u.firstName} ${u.lastName}`}
                          className="w-10 h-10 rounded-full mr-3"
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
                        <option value="user">User</option>
                        <option value="player">Player</option>
                        <option value="coach">Coach</option>
                        <option value="scout">Scout</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
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
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      {!u.verified && (
                        <button
                          onClick={() => handleVerifyUser(u.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Verify User"
                        >
                          <CheckCircleIcon className="w-5 h-5 inline" />
                        </button>
                      )}
                      <button
                        onClick={() => setResetPasswordModal({ show: true, userId: u.id, email: u.email })}
                        className="text-blue-600 hover:text-blue-900"
                        title="Reset Password"
                      >
                        <BoltIcon className="w-5 h-5 inline" />
                      </button>
                      <button
                        onClick={() => handleTogglePremium(u.id)}
                        className="text-yellow-600 hover:text-yellow-900"
                        title={u.premium ? 'Remove Premium' : 'Make Premium'}
                      >
                        <ShieldCheckIcon className="w-5 h-5 inline" />
                      </button>
                      <button
                        onClick={() => handleBanUser(u.id)}
                        className="text-orange-600 hover:text-orange-900"
                        title="Ban User"
                      >
                        <XCircleIcon className="w-5 h-5 inline" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete User"
                      >
                        <TrashIcon className="w-5 h-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            {posts.map((post) => (
              <div key={post.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <img
                      src={
                        post.User?.Profile?.profilePicture ||
                        `https://ui-avatars.com/api/?name=${post.User?.firstName}+${post.User?.lastName}`
                      }
                      alt={`${post.User?.firstName} ${post.User?.lastName}`}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {post.User?.firstName} {post.User?.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{post.User?.email}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(post.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
                  {post.image && (
                    <img
                      src={`${import.meta.env.VITE_API_URL.replace('/api','')}${post.image}`}
                      alt="Post"
                      className="mt-4 rounded-lg max-h-96 object-cover"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <Pagination pagination={pagination} setPagination={setPagination} />
        </div>
      )}
    </div>

    {/* Reset Password Modal */}
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

    {/* Sidebar - Promotional Spaces */}
    <div className="lg:col-span-1 space-y-4">
      {/* Promo 1 - Analytics Tools */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="text-center">
          <div className="text-3xl mb-2">📊</div>
          <h4 className="font-bold text-gray-900 mb-2">Advanced Analytics</h4>
          <p className="text-xs text-gray-600 mb-3">Get deeper insights with premium tools</p>
          <button className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition text-sm">
            Learn More
          </button>
        </div>
      </div>

      {/* Promo 2 - Export Features */}
      <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg p-4 text-white text-center shadow-md">
        <div className="text-3xl mb-2">💾</div>
        <h4 className="font-bold mb-2">Export Reports</h4>
        <p className="text-xs mb-3">Download data in PDF, Excel, CSV formats</p>
        <button className="bg-white text-blue-600 px-4 py-2 rounded text-sm font-semibold hover:bg-blue-50 transition w-full">
          Upgrade
        </button>
      </div>

      {/* Promo 3 - Automation */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-3 text-white text-center">
          <h4 className="font-bold">⚡ Automation</h4>
        </div>
        <div className="p-4 text-center">
          <p className="text-xs text-gray-700 mb-3">Automate user management & content moderation</p>
          <button className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition text-sm">
            Enable Now
          </button>
        </div>
      </div>

      {/* Promo 4 - Support */}
      <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-300">
        <div className="text-3xl mb-2">🎧</div>
        <h4 className="font-bold text-gray-900 mb-2">Priority Support</h4>
        <p className="text-xs text-gray-600 mb-3">Get 24/7 dedicated support</p>
        <button className="w-full bg-gray-800 text-white py-2 rounded-md hover:bg-gray-900 transition text-sm">
          Contact Sales
        </button>
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
