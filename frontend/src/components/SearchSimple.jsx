import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchAPI, profileAPI } from '../services/api';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SearchSimple() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const navigate = useNavigate();

  useEffect(() => {
    if (activeTab === 'users' && !query) {
      fetchAllUsers();
    }
  }, [activeTab]);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await profileAPI.getAllProfiles();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) {
      fetchAllUsers();
      return;
    }

    setLoading(true);
    try {
      const response = await searchAPI.search(query);
      if (response.data.users) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role) => {
    const icons = {
      athlete: '⚽',
      coach: '👨‍🏫',
      scout: '🔍',
      manager: '📋',
      club: '🏟️',
      federation: '🏛️',
      media: '📺',
      business: '💼',
    };
    return icons[role] || '👤';
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Kërko</h1>
        <p className="text-gray-600 dark:text-gray-400">Gjej lojtarë, trajnerë, skautë dhe më shumë</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kërko për emër, pozicion, klub..."
            className="w-full px-6 py-4 pl-14 text-lg border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Kërko
          </button>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {users.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {query ? `Rezultate për "${query}"` : 'Të gjithë përdoruesit'}
                </h2>
                <span className="text-gray-600 dark:text-gray-400">
                  {users.length} {users.length === 1 ? 'rezultat' : 'rezultate'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((user) => (
                  <Link
                    key={user.id}
                    to={`/profile/${user.id}`}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all p-6 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex flex-col items-center text-center">
                      {/* Avatar */}
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-bold text-3xl mb-4 shadow-lg">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>

                      {/* Name */}
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {user.firstName} {user.lastName}
                      </h3>

                      {/* Role */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{getRoleIcon(user.role)}</span>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 capitalize">
                          {user.role}
                        </span>
                      </div>

                      {/* Bio/Position */}
                      {user.Profile?.bio && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                          {user.Profile.bio}
                        </p>
                      )}

                      {user.Profile?.position && (
                        <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold mb-2">
                          {user.Profile.position}
                        </div>
                      )}

                      {/* Club */}
                      {user.Profile?.club && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          🏟️ {user.Profile.club}
                        </p>
                      )}

                      {/* Location */}
                      {(user.Profile?.city || user.Profile?.country) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          📍 {[user.Profile.city, user.Profile.country].filter(Boolean).join(', ')}
                        </p>
                      )}

                      {/* View Profile Button */}
                      <button className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                        Shiko Profilin
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {query ? 'Nuk u gjet asgjë' : 'Fillo kërkimin'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {query
                  ? 'Provo me fjalë kyçe të tjera'
                  : 'Shkruaj diçka në search bar për të filluar'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
