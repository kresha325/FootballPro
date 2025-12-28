import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { profileAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ClubBadge } from '../utils/clubLogos';

const BrowseProfiles = () => {
  const { darkMode } = useAuth();
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
    { id: 'club', label: 'Clubs', icon: '🏟️', role: 'club' },
    { id: 'manager', label: 'Managers', icon: '💼', role: 'manager' },
    { id: 'business', label: 'Businesses', icon: '🏢', role: 'business' },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProfiles.map((profile) => (
            <Link
              key={profile.id}
              to={`/profile/${profile.id}`}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:scale-105"
            >
              {/* Cover Photo */}
              <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 relative">
                {profile.coverPhoto && (
                  <img 
                    src={profile.coverPhoto} 
                    alt="Cover" 
                    className="w-full h-full object-cover"
                  />
                )}
                {/* Category Badge */}
                <div className="absolute top-2 right-2">
                  <span className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1">
                    {categories.find(c => c.role === profile.role)?.icon}
                    {categories.find(c => c.role === profile.role)?.label}
                  </span>
                </div>
              </div>

              {/* Profile Content */}
              <div className="p-5 -mt-10">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 overflow-hidden mb-4 shadow-lg">
                  {profile.profilePhoto ? (
                    <img 
                      src={profile.profilePhoto} 
                      alt={`${profile.firstName} ${profile.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-2xl font-bold">
                      {profile.firstName?.[0]}{profile.lastName?.[0]}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                    {profile.firstName} {profile.lastName}
                  </h3>
                  {profile.verified && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-1 text-sm mb-4">
                  {profile.age && profile.ageGroup && (
                    <p className="text-purple-600 dark:text-purple-400 flex items-center gap-1 font-medium">
                      <span>🎂</span> {profile.age} years ({profile.ageGroup})
                    </p>
                  )}
                  {profile.role === 'coach' && profile.coachCategory && (
                    <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                      <span>📋</span> {profile.coachCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                  )}
                  {profile.role === 'coach' && profile.coachAffiliation && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <span>{profile.coachAffiliation === 'club' ? '🏟️' : profile.coachAffiliation === 'personal_trainer' ? '👤' : '⚡'}</span> 
                      {profile.coachAffiliation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                  )}
                  {profile.position && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <span>⚽</span> {profile.position}
                    </p>
                  )}
                  {profile.club && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <ClubBadge clubName={profile.club} size="sm" />
                      <span>{profile.club}</span>
                    </p>
                  )}
                  {profile.city && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <span>📍</span> {profile.city}
                    </p>
                  )}
                </div>

                {/* Bio Preview */}
                {profile.bio && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                    {profile.bio}
                  </p>
                )}

                {/* View Profile Button */}
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition">
                  View Profile
                </button>
              </div>
            </Link>
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
