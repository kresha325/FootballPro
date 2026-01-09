import Modal from './Modal';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  ChartBarIcon,
  UserGroupIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  MapPinIcon,
  TrophyIcon,
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

const Analytics = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [followerGrowth, setFollowerGrowth] = useState([]);
  const [engagementRate, setEngagementRate] = useState([]);
  const [period, setPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [dashboardRes, growthRes, rateRes] = await Promise.all([
        api.get(`/analytics/dashboard?period=${period}`),
        api.get(`/analytics/follower-growth?period=${period}`),
        api.get(`/analytics/engagement-rate?period=${period}`),
      ]);
      setAnalytics(dashboardRes.data);
      setFollowerGrowth(growthRes.data);
      setEngagementRate(rateRes.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, change, color }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {change !== undefined && (
            <div className="flex items-center mt-2">
              {change >= 0 ? (
                <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {Math.abs(change)}%
              </span>
              <span className="text-xs text-gray-500 ml-1">vs last week</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-8 w-8 text-white" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }


  const positionData = analytics?.audience?.positions
    ? Object.entries(analytics.audience.positions).map(([name, value]) => ({ name, value }))
    : [];

  const locationData = analytics?.audience?.locations
    ? Object.entries(analytics.audience.locations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }))
    : [];

  const activityData = Array.isArray(analytics.activityByHour)
    ? analytics.activityByHour.map(item => ({
        hour: `${item.hour}:00`,
        posts: item.count,
      }))
    : [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-blue-100 mt-2">Track your performance and audience insights</p>

        {/* Period Selector */}
        <div className="mt-6 flex gap-2">
          {['7', '30', '90'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === p
                  ? 'bg-white text-blue-600'
                  : 'bg-blue-700 text-white hover:bg-blue-600'
              }`}
            >
              {p} Days
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={UserGroupIcon}
            label="Followers"
            value={analytics.overview.totalFollowers}
            change={analytics.growth?.followers?.change ?? 0}
            color="bg-blue-500"
          />
          <StatCard
            icon={HeartIcon}
            label="Total Likes"
            value={analytics.overview.totalLikes}
            change={analytics.growth?.likes?.change ?? 0}
            color="bg-red-500"
          />
          <StatCard
            icon={ChatBubbleLeftIcon}
            label="Comments"
            value={analytics.overview.totalComments}
            color="bg-green-500"
          />
          <StatCard
            icon={EyeIcon}
            label="Profile Views"
            value={analytics.overview.profileViews}
            color="bg-purple-500"
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {analytics.overview.totalPosts}
                </p>
              </div>
              <ChartBarIcon className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Following</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {analytics.overview.totalFollowing}
                </p>
              </div>
              <UserGroupIcon className="h-8 w-8 text-indigo-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Engagement Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {analytics.overview.engagementRate}
                </p>
              </div>
              <TrophyIcon className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Follower Growth Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Follower Growth</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={followerGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Engagement Rate Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Rate</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={engagementRate}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} name="Rate" />
                <Line type="monotone" dataKey="likes" stroke="#EF4444" strokeWidth={2} name="Likes" />
                <Line type="monotone" dataKey="comments" stroke="#F59E0B" strokeWidth={2} name="Comments" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Post Type Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Post Type Performance</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    name: 'With Image',
                    posts: analytics.postTypePerformance.withImage.count,
                    avgLikes: parseFloat(analytics.postTypePerformance.withImage.avgLikes),
                  },
                  {
                    name: 'Text Only',
                    posts: analytics.postTypePerformance.withoutImage.count,
                    avgLikes: parseFloat(analytics.postTypePerformance.withoutImage.avgLikes),
                  },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#3B82F6" />
                <YAxis yAxisId="right" orientation="right" stroke="#10B981" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="posts" fill="#3B82F6" name="Posts Count" />
                <Bar yAxisId="right" dataKey="avgLikes" fill="#10B981" name="Avg Likes" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Activity by Hour */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-gray-600" />
              Activity by Hour
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="posts" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Audience Demographics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Position Distribution */}
          {positionData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Followers by Position
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={positionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {positionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Location Distribution */}
          {locationData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPinIcon className="h-5 w-5 mr-2 text-gray-600" />
                Top Locations
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={locationData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#EC4899" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Posts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Posts</h2>
          <div className="space-y-4">
            {analytics.topPosts.map((post, index) => (
              <div
                key={post.customId ? `analyticspost-${post.customId}` : `analyticspost-${post.id}-${post.createdAt}`}
                className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                {/* Show image if present and not a video file */}
                {post.imageUrl && !post.imageUrl.match(/\.(mp4|mov|avi|webm)$/i) && (
                  <img
                    src={`${import.meta.env.VITE_API_URL.replace('/api','')}${post.imageUrl}`}
                    alt="Post"
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                )}
                {/* Show video if present */}
                {(post.videoUrl || (post.imageUrl && post.imageUrl.match(/\.(mp4|mov|avi|webm)$/i))) && (
                  <video
                    src={`${import.meta.env.VITE_API_URL.replace('/api','')}${post.videoUrl || post.imageUrl}`}
                    controls
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  {/* Show content if exists, otherwise only show (pa përmbajtje) if no image/video */}
                  <div className="mb-2">
                    {post.content && post.content.trim() ? (
                      <p className="text-gray-900 whitespace-pre-line">{post.content}</p>
                    ) : (!post.imageUrl && !post.videoUrl) ? (
                      <p className="italic text-gray-400">(pa përmbajtje)</p>
                    ) : null}
                  </div>
                  {/* Show image if present and not a video file */}
                  {post.imageUrl && !post.imageUrl.match(/\.(mp4|mov|avi|webm)$/i) && (
                    <img
                      src={`${import.meta.env.VITE_API_URL.replace('/api','')}${post.imageUrl}`}
                      alt="Post"
                      className="w-full h-auto object-cover rounded mb-4"
                    />
                  )}
                  {/* Show video if present */}
                  {(post.videoUrl || (post.imageUrl && post.imageUrl.match(/\.(mp4|mov|avi|webm)$/i))) && (
                    <video
                      src={`${import.meta.env.VITE_API_URL.replace('/api','')}${post.videoUrl || post.imageUrl}`}
                      controls
                      className="w-full h-auto object-cover rounded mb-4"
                    />
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span className="flex items-center">
                      <HeartIcon className="h-4 w-4 mr-1 text-red-500" />
                      {post.likesCount} likes
                    </span>
                    <span className="flex items-center">
                      <ChatBubbleLeftIcon className="h-4 w-4 mr-1 text-blue-500" />
                      {post.commentsCount} comments
                    </span>
                    <span className="text-gray-500">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                    {/* Show post URL if available */}
                    <span className="text-xs text-blue-700 break-all">
                      {post.id && (
                        <a href={`/post/${post.id}`} target="_blank" rel="noopener noreferrer" className="underline">/post/{post.id}</a>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          <Modal
            isOpen={showModal}
            onRequestClose={() => setShowModal(false)}
            contentLabel="Post Details"
            ariaHideApp={false}
            className="fixed inset-0 flex items-center justify-center z-50"
            overlayClassName="fixed inset-0 bg-black bg-opacity-50 z-40"
          >
            {selectedPost && (
              <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative">
                <button
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"
                  onClick={() => setShowModal(false)}
                >
                  &times;
                </button>
                <h3 className="text-lg font-semibold mb-2">Post i plotë</h3>
                {selectedPost.imageUrl && !selectedPost.imageUrl.match(/\.(mp4|mov|avi|webm)$/i) && (
                  <img
                    src={`${import.meta.env.VITE_API_URL.replace('/api','')}${selectedPost.imageUrl}`}
                    alt="Post"
                    className="w-full h-auto object-cover rounded mb-4"
                  />
                )}
                {(selectedPost.videoUrl || (selectedPost.imageUrl && selectedPost.imageUrl.match(/\.(mp4|mov|avi|webm)$/i))) && (
                  <video
                    src={`${import.meta.env.VITE_API_URL.replace('/api','')}${selectedPost.videoUrl || selectedPost.imageUrl}`}
                    controls
                    className="w-full h-auto object-cover rounded mb-4"
                  />
                )}
                <p className="mb-2">{selectedPost.content || <span className="italic text-gray-400">(pa përmbajtje)</span>}</p>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span><HeartIcon className="h-4 w-4 mr-1 text-red-500 inline" /> {selectedPost.likesCount} likes</span>
                  <span><ChatBubbleLeftIcon className="h-4 w-4 mr-1 text-blue-500 inline" /> {selectedPost.commentsCount} comments</span>
                  <span className="text-gray-500">{new Date(selectedPost.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </Modal>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
