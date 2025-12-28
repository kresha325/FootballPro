import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FunnelIcon, ArrowTrendingUpIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function Search() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [trendingUsers, setTrendingUsers] = useState([]);
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [suggestions, setSuggestions] = useState({ users: [], positions: [], clubs: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('discover');
  const [showFilters, setShowFilters] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [filters, setFilters] = useState({
    position: '',
    club: '',
    city: '',
    country: '',
    minAge: '',
    maxAge: '',
    sortBy: 'relevance',
  });

  const [postFilters, setPostFilters] = useState({
    dateRange: 'all',
    minLikes: '',
    sortBy: 'newest',
  });

  useEffect(() => {
    if (activeTab === 'discover') {
      fetchDiscovery();
    }
  }, [activeTab]);

  useEffect(() => {
    if (query.length >= 2) {
      fetchSuggestions();
    } else {
      setSuggestions({ users: [], positions: [], clubs: [] });
    }
  }, [query]);

  const fetchDiscovery = async () => {
    setLoading(true);
    try {
      const [trending, trendingUsersRes, recommended] = await Promise.all([
        api.get('/search/trending/posts'),
        api.get('/search/trending/users'),
        api.get('/search/recommended'),
      ]);
      setTrendingPosts(trending.data);
      setTrendingUsers(trendingUsersRes.data);
      setRecommendedUsers(recommended.data);
    } catch (err) {
      console.error('Fetch discovery error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await api.get(`/search/suggestions?q=${query}`);
      setSuggestions(response.data);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Fetch suggestions error:', err);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setShowSuggestions(false);
    setLoading(true);
    
    try {
      if (activeTab === 'users') {
        const params = new URLSearchParams({ q: query, ...filters });
        const response = await api.get(`/search/users?${params}`);
        setUsers(response.data.users);
      } else if (activeTab === 'posts') {
        const params = new URLSearchParams({ q: query, ...postFilters });
        const response = await api.get(`/search/posts?${params}`);
        setPosts(response.data.posts);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setUsers([]);
    setPosts([]);
    if (tab === 'discover') {
      fetchDiscovery();
    }
  };

  const selectSuggestion = (value, type) => {
    if (type === 'user') {
      setQuery(`${value.firstName} ${value.lastName}`);
    } else if (type === 'position') {
      setFilters(prev => ({ ...prev, position: value }));
      setActiveTab('users');
    } else if (type === 'club') {
      setFilters(prev => ({ ...prev, club: value }));
      setActiveTab('users');
    }
    setShowSuggestions(false);
    handleSearch();
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Search Bar */}
      <div className="mb-6 relative">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.length >= 2 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search for users, posts, positions, clubs..."
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {/* Autocomplete Suggestions */}
            {showSuggestions && (suggestions.users.length > 0 || suggestions.positions.length > 0 || suggestions.clubs.length > 0) && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {suggestions.users.length > 0 && (
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-500 px-2 mb-1">USERS</p>
                    {suggestions.users.map(user => (
                      <div
                        key={user.id}
                        onMouseDown={() => selectSuggestion(user, 'user')}
                        className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer"
                      >
                        {user.firstName} {user.lastName}
                      </div>
                    ))}
                  </div>
                )}
                {suggestions.positions.length > 0 && (
                  <div className="p-2 border-t">
                    <p className="text-xs font-semibold text-gray-500 px-2 mb-1">POSITIONS</p>
                    {suggestions.positions.map(pos => (
                      <div
                        key={pos}
                        onMouseDown={() => selectSuggestion(pos, 'position')}
                        className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer"
                      >
                        {pos}
                      </div>
                    ))}
                  </div>
                )}
                {suggestions.clubs.length > 0 && (
                  <div className="p-2 border-t">
                    <p className="text-xs font-semibold text-gray-500 px-2 mb-1">CLUBS</p>
                    {suggestions.clubs.map(club => (
                      <div
                        key={club}
                        onMouseDown={() => selectSuggestion(club, 'club')}
                        className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer"
                      >
                        {club}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-3 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <FunnelIcon className="w-5 h-5" />
            Filters
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 p-4 bg-white border rounded-lg shadow-lg">
            {activeTab === 'users' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Position"
                  value={filters.position}
                  onChange={(e) => setFilters({ ...filters, position: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Club"
                  value={filters.club}
                  onChange={(e) => setFilters({ ...filters, club: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="City"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Country"
                  value={filters.country}
                  onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Min Age"
                  value={filters.minAge}
                  onChange={(e) => setFilters({ ...filters, minAge: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Max Age"
                  value={filters.maxAge}
                  onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                  <option value="followers">Most Followers</option>
                  <option value="posts">Most Posts</option>
                </select>
              </div>
            )}
            
            {activeTab === 'posts' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <select
                  value={postFilters.dateRange}
                  onChange={(e) => setPostFilters({ ...postFilters, dateRange: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                </select>
                <input
                  type="number"
                  placeholder="Min Likes"
                  value={postFilters.minLikes}
                  onChange={(e) => setPostFilters({ ...postFilters, minLikes: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={postFilters.sortBy}
                  onChange={(e) => setPostFilters({ ...postFilters, sortBy: e.target.value })}
                  className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Newest</option>
                  <option value="likes">Most Liked</option>
                  <option value="comments">Most Comments</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-6">
          <button
            onClick={() => handleTabChange('discover')}
            className={`pb-3 px-2 font-medium flex items-center gap-2 ${
              activeTab === 'discover'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <SparklesIcon className="w-5 h-5" />
            Discover
          </button>
          <button
            onClick={() => handleTabChange('users')}
            className={`pb-3 px-2 font-medium ${
              activeTab === 'users'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => handleTabChange('posts')}
            className={`pb-3 px-2 font-medium ${
              activeTab === 'posts'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Posts
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Discover Tab */}
          {activeTab === 'discover' && (
            <div className="space-y-8">
              {/* Trending Posts */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ArrowTrendingUpIcon className="w-6 h-6 text-orange-500" />
                  Trending Posts
                </h2>
                <div className="grid gap-4">
                  {trendingPosts.map(post => (
                    <div key={post.id} className="bg-white rounded-lg shadow p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {post.User?.Profile?.profilePhoto ? (
                          <img
                            src={`${import.meta.env.VITE_API_URL}${post.User.Profile.profilePhoto}`}
                            alt={post.User.firstName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                            {post.User?.firstName?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <Link
                            to={`/profile/${post.User?.id}`}
                            className="font-semibold hover:underline"
                          >
                            {post.User?.firstName} {post.User?.lastName}
                          </Link>
                          {post.User?.Profile?.position && (
                            <p className="text-sm text-gray-500">{post.User.Profile.position}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-800 mb-2">{post.content}</p>
                      {post.imageUrl && (
                        <img
                          src={`${import.meta.env.VITE_API_URL}${post.imageUrl}`}
                          alt="Post"
                          className="rounded-lg w-full max-h-96 object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Trending Users */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <ArrowTrendingUpIcon className="w-6 h-6 text-red-500" />
                  Trending Users
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {trendingUsers.map(user => (
                    <div key={user.id} className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
                      {user.Profile?.profilePhoto ? (
                        <img
                          src={`${import.meta.env.VITE_API_URL}${user.Profile.profilePhoto}`}
                          alt={user.firstName}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
                          {user.firstName.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <Link
                          to={`/profile/${user.id}`}
                          className="font-semibold text-lg hover:underline"
                        >
                          {user.firstName} {user.lastName}
                        </Link>
                        {user.Profile?.position && (
                          <p className="text-sm text-gray-600">{user.Profile.position}</p>
                        )}
                        {user.Profile?.club && (
                          <p className="text-sm text-gray-500">{user.Profile.club}</p>
                        )}
                      </div>
                      <Link
                        to={`/profile/${user.id}`}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Users */}
              {recommendedUsers.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <SparklesIcon className="w-6 h-6 text-purple-500" />
                    Recommended For You
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    {recommendedUsers.map(user => (
                      <div key={user.id} className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
                        {user.Profile?.profilePhoto ? (
                          <img
                            src={`${import.meta.env.VITE_API_URL}${user.Profile.profilePhoto}`}
                            alt={user.firstName}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center text-2xl font-bold">
                            {user.firstName.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1">
                          <Link
                            to={`/profile/${user.id}`}
                            className="font-semibold text-lg hover:underline"
                          >
                            {user.firstName} {user.lastName}
                          </Link>
                          {user.Profile?.position && (
                            <p className="text-sm text-gray-600">{user.Profile.position}</p>
                          )}
                          {user.Profile?.city && (
                            <p className="text-sm text-gray-500">{user.Profile.city}</p>
                          )}
                        </div>
                        <Link
                          to={`/profile/${user.id}`}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="grid md:grid-cols-2 gap-4">
              {users.map(user => (
                <div key={user.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-4">
                    {user.Profile?.profilePhoto ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL}${user.Profile.profilePhoto}`}
                        alt={user.firstName}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-2xl font-bold">
                        {user.firstName.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <Link
                        to={`/profile/${user.id}`}
                        className="font-semibold text-lg hover:underline"
                      >
                        {user.firstName} {user.lastName}
                      </Link>
                      {user.Profile?.position && (
                        <p className="text-sm text-gray-600">{user.Profile.position}</p>
                      )}
                      {user.Profile?.club && (
                        <p className="text-sm text-gray-500">{user.Profile.club}</p>
                      )}
                      {user.Profile?.city && user.Profile?.country && (
                        <p className="text-xs text-gray-400">
                          {user.Profile.city}, {user.Profile.country}
                        </p>
                      )}
                    </div>
                    <Link
                      to={`/profile/${user.id}`}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
              {users.length === 0 && query && (
                <div className="col-span-2 text-center text-gray-500 py-12">
                  No users found
                </div>
              )}
            </div>
          )}

          {/* Posts Tab */}
          {activeTab === 'posts' && (
            <div className="grid gap-4">
              {posts.map(post => (
                <div key={post.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {post.User?.Profile?.profilePhoto ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL}${post.User.Profile.profilePhoto}`}
                        alt={post.User.firstName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                        {post.User?.firstName?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <Link
                        to={`/profile/${post.User?.id}`}
                        className="font-semibold hover:underline"
                      >
                        {post.User?.firstName} {post.User?.lastName}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-800 mb-2">{post.content}</p>
                  {post.imageUrl && (
                    <img
                      src={`${import.meta.env.VITE_API_URL}${post.imageUrl}`}
                      alt="Post"
                      className="rounded-lg w-full max-h-96 object-cover"
                    />
                  )}
                </div>
              ))}
              {posts.length === 0 && query && (
                <div className="text-center text-gray-500 py-12">No posts found</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
