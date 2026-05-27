// Helper për URL absolute/relative të fotos
const apiRoot = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api','') : '';
const getFullUrl = (url) => {
  if (!url) return '';
  const normalized = url.startsWith('https//')
    ? url.replace('https//', 'https://')
    : url.startsWith('http//')
      ? url.replace('http//', 'http://')
      : url;
    if (/^https?:\/\//.test(normalized)) return normalized;
    if (/(^|\/)default-avatar\.png$/i.test(normalized)) return '/default-avatar.svg';
  return apiRoot + (normalized.startsWith('/') ? normalized : '/' + normalized);
};
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { profileAPI } from '../services/api';
import { ClubBadge } from '../utils/clubLogos';

const BrowseProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ageGroupFilter, setAgeGroupFilter] = useState('all');

  const categories = [
    { id: 'all', label: 'All', icon: '👥', role: null },
    { id: 'athlete', label: 'Players', icon: '⚽', role: 'athlete' },
    { id: 'coach', label: 'Coaches', icon: '📋', role: 'coach' },
    { id: 'scout', label: 'Scouts', icon: '🔍', role: 'scout' },
    { id: 'referee', label: 'Referat', icon: '🧑‍⚖️', role: 'referee' },
    { id: 'club', label: 'Clubs', icon: '🏟️', role: 'club' },
    { id: 'manager', label: 'Managers', icon: '💼', role: 'manager' },
    { id: 'business', label: 'Businesses', icon: '🏢', role: 'business' },
    { id: 'media', label: 'Media', icon: '📺', role: 'media' },
  ];

  const ageGroups = [
    { id: 'all', label: 'All Ages', icon: '👥' },
    { id: 'U9', label: 'U9', icon: '🎯' },
    { id: 'U11', label: 'U11', icon: '🎯' },
    { id: 'U13', label: 'U13', icon: '🎯' },
    { id: 'U15', label: 'U15', icon: '🎯' },
    { id: 'U17', label: 'U17', icon: '🎯' },
    { id: 'U19', label: 'U19', icon: '🎯' },
    { id: 'U21', label: 'U21', icon: '🎯' },
    { id: 'U23', label: 'U23', icon: '🎯' },
    { id: 'Senior', label: 'Senior', icon: '⭐' },
  ];

  // Reset age group filter when changing category away from athlete
  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    if (categoryId !== 'athlete') {
      setAgeGroupFilter('all');
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    filterProfiles();
  }, [activeCategory, searchQuery, profiles, ageGroupFilter]);

  const fetchProfiles = async () => {
    try {
      const response = await profileAPI.getAllProfiles();
      setProfiles(response.data);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProfiles = () => {
    let filtered = profiles;

    // Filter by category
    if (activeCategory !== 'all') {
      const category = categories.find(c => c.id === activeCategory);
      filtered = filtered.filter(p => p.role === category.role);
    }

    // Filter by age group
    if (ageGroupFilter !== 'all') {
      filtered = filtered.filter(p => p.ageGroup === ageGroupFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
        p.club?.toLowerCase().includes(query) ||
        p.position?.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query)
      );
    }

    setFilteredProfiles(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Browse Profiles
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Discover players, coaches, scouts and clubs
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, club, position, location..."
          className="w-full px-6 py-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryChange(category.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === category.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <span className="text-xl">{category.icon}</span>
            <span>{category.label}</span>
            {category.id === 'all' && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {profiles.length}
              </span>
            )}
            {category.id !== 'all' && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeCategory === category.id 
                  ? 'bg-white/20 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                {profiles.filter(p => p.role === category.role).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Age Group Filter (Only for Athletes) */}
      {activeCategory === 'athlete' && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {ageGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => setAgeGroupFilter(group.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                ageGroupFilter === group.id
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <span>{group.icon}</span>
              <span>{group.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-gray-600 dark:text-gray-400">
          Showing <span className="font-semibold text-gray-900 dark:text-white">{filteredProfiles.length}</span> {activeCategory !== 'all' ? categories.find(c => c.id === activeCategory)?.label.toLowerCase() : 'profiles'}
        </p>
      </div>

      {/* Profiles Grid */}
      {filteredProfiles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProfiles.map(profile => (
            <div key={profile.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden relative flex flex-col">
              <div className="relative h-48 w-full overflow-hidden">
                {profile.profilePhoto ? (
                  <img
                    src={getFullUrl(profile.profilePhoto)}
                    alt={profile.firstName + ' ' + profile.lastName}
                    className="object-cover w-full h-full"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-gray-300 dark:bg-gray-700 text-3xl font-bold text-white select-none">
                    {`${(profile.firstName?.[0] || '').toUpperCase()}${(profile.lastName?.[0] || '').toUpperCase()}`}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="text-xl font-bold text-white drop-shadow-lg">{profile.firstName} {profile.lastName}</div>
                  <div className="text-white text-sm font-medium drop-shadow">{profile.position || '—'}</div>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-between p-4 bg-gray-900/90 text-white">
                <div className="mb-2">
                  <div className="text-sm opacity-80">Datëlindja: {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('sq-AL') : '—'} {profile.country ? `🌍 ${profile.country}` : ''}</div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link
                    to={`/profile/${profile.id}`}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium text-xs py-2 rounded-md transition text-center"
                  >
                    SHIKO PROFILIN
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No profiles found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
};

export default BrowseProfiles;
