import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import PostsProvider from './contexts/PostsContext';
import { CartProvider } from './contexts/CartContext';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import ParentVerification from './components/ParentVerification';
import ParentVerified from './components/ParentVerified';
import RegisterOnboarding, { isOnboardingPending } from './components/RegisterOnboarding';
import BottomNav from "./components/BottomNav";
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded route components to reduce initial bundle size
const Profile = lazy(() => import('./components/Profile'));
const BrowseProfiles = lazy(() => import('./components/BrowseProfiles'));
const Gallery = lazy(() => import('./components/Gallery'));
const Feed = lazy(() => import('./components/Feed'));
const Search = lazy(() => import('./components/SearchSimple'));
const Messaging = lazy(() => import('./components/Messaging'));
const Marketplace = lazy(() => import('./components/MarketplaceSimple'));
const WalletPage = lazy(() => import('./components/WalletPage'));
const Notifications = lazy(() => import('./components/Notifications'));
const Scouting = lazy(() => import('./components/Scouting'));
const Tournaments = lazy(() => import('./components/TournamentSimple'));
const Gamification = lazy(() => import('./components/Gamification'));
const Analytics = lazy(() => import('./components/Analytics'));
const Premium = lazy(() => import('./components/Premium'));
const Matches = lazy(() => import('./components/Matches'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ClubRoster = lazy(() => import('./components/ClubRoster'));
const Videos = lazy(() => import('./components/Videos'));
const VideoPlayer = lazy(() => import('./components/VideoPlayer'));
const YouTubeLiveTest = lazy(() => import('./components/YouTubeLiveTest'));
const LiveStreamViewer = lazy(() => import('./components/LiveStreamViewer'));
const StreamsPage = lazy(() => import('./components/StreamsPage'));
const EmbedOutboundCall = lazy(() => import('./components/EmbedOutboundCall'));
const EmbedIncomingCall = lazy(() => import('./components/EmbedIncomingCall'));
const EmbedGoLive = lazy(() => import('./components/EmbedGoLive'));
// Duplicate direct imports removed — components are lazy-loaded above
import XPNotificationManager from './components/XPNotificationManager';
import VideoCallManager from './components/VideoCallManager';
import VideoCallRoom from './components/VideoCallRoom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Splash from './components/Splash';
import AuthCallback from './components/AuthCallback';

// Hiq importin e applyBackgroundStyle
function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Hiq efektet dhe përdorimet e background-it nga userat
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
      <CartProvider>
      <PostsProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {user && <Navbar />}
          {user && <BottomNav />}
          {user && <XPNotificationManager />}
          {user && <VideoCallManager />}

          <main className={user ? "pt-16 pb-24 md:pb-0 px-4 max-w-7xl mx-auto" : ''}>
          <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
            <Routes>

            {/* AUTH */}
            <Route path="/login" element={user ? (isOnboardingPending() ? <Navigate to="/onboarding" /> : <Navigate to="/feed" />) : <Login />} />
            <Route path="/register" element={user ? (isOnboardingPending() ? <Navigate to="/onboarding" /> : <Navigate to="/feed" />) : <Register />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/feed" /> : <ForgotPassword />} />
            <Route path="/reset-password/:token" element={user ? <Navigate to="/feed" /> : <ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding" element={user ? <RegisterOnboarding /> : <Navigate to="/login" />} />
            <Route path="/parent-verification" element={user ? <ParentVerification /> : <Navigate to="/login" />} />
            <Route path="/parent-verified" element={<ParentVerified />} />

            {/* FEED */}
            <Route path="/feed" element={user ? (isOnboardingPending() ? <Navigate to="/onboarding" /> : <Feed />) : <Navigate to="/login" />} />

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
            <Route path="/embed-call" element={user ? <EmbedOutboundCall /> : <Navigate to="/login" />} />
            <Route path="/embed-incoming-call" element={user ? <EmbedIncomingCall /> : <Navigate to="/login" />} />
            <Route path="/embed-go-live" element={user ? <EmbedGoLive /> : <Navigate to="/login" />} />
            <Route path="/marketplace" element={user ? <Marketplace /> : <Navigate to="/login" />} />
            <Route path="/notifications" element={user ? <Notifications /> : <Navigate to="/login" />} />
            <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
            <Route path="/scouting" element={user ? <Scouting /> : <Navigate to="/login" />} />
            <Route path="/streams" element={user ? <StreamsPage /> : <Navigate to="/login" />} />
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
            <Route path="/youtube-test" element={user ? <YouTubeLiveTest /> : <Navigate to="/login" />} />
            <Route path="/live/:streamId" element={user ? <LiveStreamViewer /> : <Navigate to="/login" />} />

            {/* WALLET PAGE */}
            <Route path="/wallet" element={user ? <WalletPage /> : <Navigate to="/login" />} />

            {/* ROOT - show splash first */}
            <Route path="/" element={<Splash />} />

            </Routes>
          </Suspense>
        </main>
        </div>
      </PostsProvider>
      </CartProvider>
    </ErrorBoundary>
  );
}

export default App;
