import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { PostsProvider } from './contexts/PostsContext';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Profile from './components/Profile';
import BrowseProfiles from './components/BrowseProfiles';
import Gallery from './components/Gallery';
import Feed from './components/Feed';
import Search from './components/SearchSimple';
import Messaging from './components/MessagingSimple';
import Marketplace from './components/MarketplaceSimple';
import Notifications from './components/Notifications';
import BottomNav from "./components/BottomNav";
import Settings from './components/Settings';
import Scouting from './components/Scouting';
import ErrorBoundary from './components/ErrorBoundary';
import Streams from './components/StreamsSimple';
import Tournaments from './components/TournamentSimple';
import Analytics from './components/Analytics';
import Gamification from './components/Gamification';
import Premium from './components/Premium';
import Matches from './components/Matches';
import AdminDashboard from './components/AdminDashboard';
import ClubRoster from './components/ClubRoster';
import Videos from './components/Videos';
import VideoPlayer from './components/VideoPlayer';
import XPNotificationManager from './components/XPNotificationManager';
import VideoCallManager from './components/VideoCallManager';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

import { useEffect } from 'react';
function App() {
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = 'FootballPro';
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-center">
        <div className="w-full max-w-md">
          <Skeleton height={40} className="mb-4" />
          <Skeleton height={20} count={3} />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <PostsProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {user && <Navbar />}
          {user && <BottomNav />}
          {user && <XPNotificationManager />}
          {user && <VideoCallManager />}

          <main className={user ? "pt-16 px-4 max-w-7xl mx-auto" : ''}>
          <Routes>

            {/* AUTH */}
            <Route path="/login" element={user ? <Navigate to="/feed" /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/feed" /> : <Register />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/feed" /> : <ForgotPassword />} />
            <Route path="/reset-password/:token" element={user ? <Navigate to="/feed" /> : <ResetPassword />} />

            {/* FEED */}
            <Route path="/feed" element={user ? <Feed /> : <Navigate to="/login" />} />

            {/* PROFILI IM (pa ID) */}
            <Route
              path="/profile"
              element={
                user
                  ? <Navigate to={`/profile/${user.id}`} />
                  : <Navigate to="/login" />
              }
            />

            {/* PROFILI PUBLIK */}
            <Route
              path="/profile/:id"
              element={user ? <Profile /> : <Navigate to="/login" />}
            />

            {/* BROWSE PROFILES */}
            <Route path="/profiles" element={user ? <BrowseProfiles /> : <Navigate to="/login" />} />

            {/* TJERAT */}
            <Route path="/gallery" element={user ? <Gallery /> : <Navigate to="/login" />} />
            <Route path="/gallery/:id" element={user ? <Gallery /> : <Navigate to="/login" />} />
            <Route path="/search" element={user ? <Search /> : <Navigate to="/login" />} />
            <Route path="/messaging" element={user ? <Messaging /> : <Navigate to="/login" />} />
            <Route path="/marketplace" element={user ? <Marketplace /> : <Navigate to="/login" />} />
            <Route path="/notifications" element={user ? <Notifications /> : <Navigate to="/login" />} />
            <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
            <Route path="/scouting" element={user ? <Scouting /> : <Navigate to="/login" />} />
            <Route path="/streams" element={user ? <Streams /> : <Navigate to="/login" />} />
            <Route path="/tournaments" element={user ? <Tournaments /> : <Navigate to="/login" />} />
            <Route path="/analytics" element={user ? <Analytics /> : <Navigate to="/login" />} />
            <Route path="/gamification" element={user ? <Gamification /> : <Navigate to="/login" />} />
            <Route path="/gamification/:userId" element={user ? <Gamification /> : <Navigate to="/login" />} />
            <Route path="/premium" element={user ? <Premium /> : <Navigate to="/login" />} />
            <Route path="/matches" element={user ? <Matches /> : <Navigate to="/login" />} />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/feed" />} />
            <Route path="/club-roster" element={user?.role === 'club' ? <ClubRoster /> : <Navigate to="/feed" />} />
            <Route path="/videos" element={user ? <Videos /> : <Navigate to="/login" />} />
            <Route path="/video/:id" element={user ? <VideoPlayer /> : <Navigate to="/login" />} />

            {/* ROOT */}
            <Route path="/" element={<Navigate to={user ? "/feed" : "/login"} />} />

          </Routes>
        </main>
        </div>
      </PostsProvider>
    </ErrorBoundary>
  );
}

export default App;
