import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Cog6ToothIcon, ChartBarIcon, TrophyIcon, VideoCameraIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { notificationsAPI } from '../services/api';

function Navbar() {
  const { user, logout, darkMode, toggleDarkMode } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">

        {/* LOGO */}
        <Link to="/feed" className="text-2xl font-bold text-primary">
          JonSport
        </Link>

        {/* RIGHT SECTION: Search + Dark Mode + Burger Menu */}
        <div className="flex items-center gap-3">
          
          {/* SEARCH */}
          <Link
            to="/search"
            className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Search"
          >
            <span className="text-2xl">🔍</span>
          </Link>

          {/* DARK MODE TOGGLE */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            <span className="text-2xl">{darkMode ? '☀️' : '🌙'}</span>
          </button>

          {/* BURGER MENU BUTTON */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="relative p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            {!isMenuOpen && unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* BURGER MENU SIDEBAR */}
      <div className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}>
        <div className="p-6 space-y-6">
          
          {/* MENU ITEMS */}
          <div className="space-y-2">
            
            {/* Notifications */}
            <Link 
              to="/notifications" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl">🔔</span>
              <span className="font-medium">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[1.5rem] text-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Messages */}
            <Link 
              to="/messaging" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl">💬</span>
              <span className="font-medium">Messages</span>
            </Link>

            {/* Browse Profiles */}
            <Link 
              to="/profiles" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl">👥</span>
              <span className="font-medium">Browse Profiles</span>
            </Link>

            {/* Analytics */}
            <Link 
              to="/analytics" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChartBarIcon className="h-6 w-6" />
              <span className="font-medium">Analytics</span>
            </Link>

            {/* Gamification */}
            <Link 
              to="/gamification" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <TrophyIcon className="h-6 w-6" />
              <span className="font-medium">Gamification</span>
            </Link>

            {/* Videos */}
            <Link 
              to="/videos" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <VideoCameraIcon className="h-6 w-6" />
              <span className="font-medium">Videos</span>
            </Link>

            {/* Matches */}
            <Link 
              to="/matches" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl">⚽</span>
              <span className="font-medium">Matches</span>
            </Link>

            {/* Scouting (for scouts) */}
            {user?.role === 'scout' && (
              <Link 
                to="/scouting" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-2xl">🔍</span>
                <span className="font-medium">Scouting</span>
              </Link>
            )}

            {/* Club Roster (for clubs) */}
            {user?.role === 'club' && (
              <Link 
                to="/club-roster" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-colors"
              >
                <span className="text-2xl">👥</span>
                <span className="font-medium">Club Roster</span>
              </Link>
            )}

            {/* Admin Dashboard (for admins) */}
            {user?.role === 'admin' && (
              <Link 
                to="/admin" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <span className="text-2xl">🔐</span>
                <span className="font-medium">Admin Dashboard</span>
              </Link>
            )}

            {/* Premium */}
            <Link 
              to="/premium" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-colors"
            >
              <span className="text-2xl">👑</span>
              <span className="font-medium">Go Premium</span>
            </Link>

            {/* Settings */}
            <Link 
              to="/settings" 
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-2xl">⚙️</span>
              <span className="font-medium">Settings</span>
            </Link>

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                setIsMenuOpen(false);
                navigate('/login');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <span className="text-2xl">🚪</span>
              <span className="font-medium">Logout</span>
            </button>

          </div>
        </div>
      </div>

      {/* OVERLAY */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 top-16 bg-black/50 z-40"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}
    </nav>
  );
}

export default Navbar;
