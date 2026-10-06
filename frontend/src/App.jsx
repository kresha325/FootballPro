import React, { Suspense, useEffect } from 'react';
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
import WelcomeOnboarding, { isWelcomeOnboardingDone } from './components/WelcomeOnboarding';
import LandingPage from './components/LandingPage';
import BottomNav from "./components/BottomNav";
import Settings from './components/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import { lazyWithReload } from './utils/lazyWithReload';
import { PlatformProvider, MaintenanceBanner, FeatureGate } from './components/admin/platformState';

// Lazy-loaded route components to reduce initial bundle size
const Profile = lazyWithReload(() => import('./components/Profile'));
const BrowseProfiles = lazyWithReload(() => import('./components/BrowseProfiles'));
const Gallery = lazyWithReload(() => import('./components/Gallery'));
const Feed = lazyWithReload(() => import('./components/Feed'));
const Search = lazyWithReload(() => import('./components/GlobalSearch'));
const Messaging = lazyWithReload(() => import('./components/Messaging'));
const Marketplace = lazyWithReload(() => import('./components/MarketplaceSimple'));
const ProductPage = lazyWithReload(() => import('./components/marketplace/ProductPage'));
const CartPage = lazyWithReload(() => import('./components/marketplace/CartPage'));
const CheckoutPage = lazyWithReload(() => import('./components/marketplace/CheckoutPage'));
const OrdersPage = lazyWithReload(() => import('./components/marketplace/OrdersPage'));
const WalletPage = lazyWithReload(() => import('./components/WalletPage'));
const Notifications = lazyWithReload(() => import('./components/Notifications'));
const Scouting = lazyWithReload(() => import('./components/Scouting'));
const Tournaments = lazyWithReload(() => import('./components/TournamentSimple'));
const CompetitionCenter = lazyWithReload(() => import('./components/competitions/CompetitionCenter'));
const MatchCenterPage = lazyWithReload(() => import('./components/competitions/MatchCenterPage'));
const CalendarPage = lazyWithReload(() => import('./components/competitions/CalendarPage'));
const Gamification = lazyWithReload(() => import('./components/Gamification'));
const Analytics = lazyWithReload(() => import('./components/Analytics'));
const Premium = lazyWithReload(() => import('./components/Premium'));
const Matches = lazyWithReload(() => import('./components/Matches'));
const AdminShell = lazyWithReload(() => import('./components/admin/AdminShell'));
const ClubRoster = lazyWithReload(() => import('./components/ClubRoster'));
const Videos = lazyWithReload(() => import('./components/Videos'));
const VideoPlayer = lazyWithReload(() => import('./components/VideoPlayer'));
const LiveStreamViewer = lazyWithReload(() => import('./components/LiveStreamViewer'));
const StreamsPage = lazyWithReload(() => import('./components/StreamsPage'));
const LiveDiscovery = lazyWithReload(() => import('./components/LiveDiscovery'));
const EmbedOutboundCall = lazyWithReload(() => import('./components/EmbedOutboundCall'));
const LegalPage = lazyWithReload(() => import('./components/LegalPage'));
const PublicCvPage = lazyWithReload(() => import('./components/PublicCvPage'));
const SponsorsAdsHub = lazyWithReload(() => import('./components/SponsorsAdsHub'));
const InsightsHub = lazyWithReload(() => import('./components/InsightsHub'));
const AnalyticsCenter = lazyWithReload(() => import('./components/analytics/AnalyticsCenter'));
const EmbedIncomingCall = lazyWithReload(() => import('./components/EmbedIncomingCall'));
const EmbedGoLive = lazyWithReload(() => import('./components/EmbedGoLive'));
// Duplicate direct imports removed — components are lazy-loaded above
import XPNotificationManager from './components/XPNotificationManager';
import VideoCallManager from './components/VideoCallManager';
import AuthCallback from './components/AuthCallback';
import OAuthCodeRelay from './components/OAuthCodeRelay';
import { APP_BRAND_NAME } from './config/branding';

// Hiq importin e applyBackgroundStyle
function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isFullscreenRoute =
    location.pathname.startsWith('/embed-') ||
    /^\/live\/[^/]+/.test(location.pathname) ||
    /^\/cv\/[^/]+/.test(location.pathname);
  // Hiq efektet dhe përdorimet e background-it nga userat
  useEffect(() => {
    document.title = `${APP_BRAND_NAME} — Talent Has a Future`;
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--xt-color-canvas)] px-4" role="status" aria-label="Po ngarkohet aplikacioni">
        <div className="w-full max-w-md space-y-4" aria-hidden="true">
          <div className="xt-skeleton h-10 w-3/5" />
          <div className="space-y-2">
            <div className="xt-skeleton h-5 w-full" />
            <div className="xt-skeleton h-5 w-11/12" />
            <div className="xt-skeleton h-5 w-4/5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <CartProvider>
      <PostsProvider>
      <PlatformProvider>
        <div className={`min-h-screen bg-[var(--xt-color-canvas)] ${isFullscreenRoute ? 'live-fullscreen' : ''}`}>
          {user && !isFullscreenRoute && <Navbar />}
          <MaintenanceBanner />
          {user && !isFullscreenRoute && <BottomNav />}
          {user && <XPNotificationManager />}
          {user && <VideoCallManager />}

          <main
            className={
              user
                ? isFullscreenRoute
                  ? 'min-h-[100dvh] max-w-none mx-0 px-0 pt-0 pb-0'
                  : 'pt-16 pb-24 md:pb-0 px-4 max-w-7xl mx-auto'
                : ''
            }
          >
          <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
            <Routes>

            {/* AUTH */}
            <Route path="/login" element={user ? (isOnboardingPending() ? <Navigate to="/onboarding" /> : <Navigate to="/feed" />) : <Login />} />
            <Route path="/register" element={user ? (isOnboardingPending() ? <Navigate to="/onboarding" /> : <Navigate to="/feed" />) : <Register />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/feed" /> : <ForgotPassword />} />
            <Route path="/reset-password/:token" element={user ? <Navigate to="/feed" /> : <ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/facebook/callback" element={<OAuthCodeRelay provider="facebook" />} />
            <Route path="/auth/google/callback" element={<OAuthCodeRelay provider="google" />} />
            <Route path="/onboarding" element={user ? <RegisterOnboarding /> : <Navigate to="/login" />} />
            <Route path="/parent-verification" element={user ? <ParentVerification /> : <Navigate to="/login" />} />
            <Route path="/parent-verified" element={<ParentVerified />} />

            {/* Public digital CV (no login) */}
            <Route path="/cv/:id" element={<PublicCvPage />} />
            <Route path="/players/:id" element={user ? <Profile /> : <PublicCvPage />} />
            <Route path="/athletes/:id" element={user ? <Profile /> : <PublicCvPage />} />
            {/* Legacy / OG share path on SPA host → same public CV */}
            <Route path="/share/cv/:id" element={<PublicCvPage />} />

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
            <Route path="/marketplace" element={user ? <FeatureGate flag="MARKETPLACE"><Marketplace /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/marketplace/:productId" element={user ? <FeatureGate flag="MARKETPLACE"><ProductPage /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/cart" element={user ? <FeatureGate flag="MARKETPLACE"><CartPage /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/checkout" element={user ? <FeatureGate flag="MARKETPLACE"><CheckoutPage /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/orders" element={user ? <FeatureGate flag="MARKETPLACE"><OrdersPage /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/orders/:id" element={user ? <FeatureGate flag="MARKETPLACE"><OrdersPage /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/notifications" element={user ? <Notifications /> : <Navigate to="/login" />} />
            <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
            <Route path="/scouting" element={user ? <FeatureGate flag="SCOUTING"><Scouting /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/scouting/*" element={user ? <FeatureGate flag="SCOUTING"><Scouting /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/live" element={<FeatureGate flag="LIVE_STREAMING"><LiveDiscovery /></FeatureGate>} />
            <Route path="/streams" element={user ? <FeatureGate flag="LIVE_STREAMING"><StreamsPage /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/tournaments" element={user ? <Tournaments /> : <Navigate to="/login" />} />
            <Route path="/tournaments/:tournamentId" element={user ? <Tournaments /> : <Navigate to="/login" />} />
            <Route path="/competitions" element={<CompetitionCenter />} />
            <Route path="/competitions/:id" element={<CompetitionCenter section="overview" />} />
            <Route path="/competitions/:id/standings" element={<CompetitionCenter section="standings" />} />
            <Route path="/competitions/:id/fixtures" element={<CompetitionCenter section="fixtures" />} />
            <Route path="/competitions/:id/bracket" element={<CompetitionCenter section="bracket" />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/analytics" element={user ? <FeatureGate flag="ANALYTICS"><AnalyticsCenter /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/analytics/:section" element={user ? <FeatureGate flag="ANALYTICS"><AnalyticsCenter /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/gamification" element={user ? <InsightsHub /> : <Navigate to="/login" />} />
            <Route path="/gamification/:userId" element={user ? <Gamification /> : <Navigate to="/login" />} />
            <Route path="/insights" element={user ? <InsightsHub /> : <Navigate to="/login" />} />
            <Route path="/premium" element={user ? <FeatureGate flag="PREMIUM"><Premium /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/sponsors" element={user ? <SponsorsAdsHub /> : <Navigate to="/login" />} />
            <Route path="/ads" element={user ? <SponsorsAdsHub /> : <Navigate to="/login" />} />
            <Route path="/matches" element={user ? <Matches /> : <Navigate to="/login" />} />
            <Route path="/matches/:id" element={<MatchCenterPage />} />
            <Route path="/admin/*" element={user?.role === 'admin' ? <AdminShell /> : <Navigate to="/feed" />} />
            <Route path="/club-roster" element={user?.role === 'club' ? <ClubRoster /> : <Navigate to="/feed" />} />
            <Route path="/videos" element={user ? <Videos /> : <Navigate to="/login" />} />
            <Route path="/video/:id" element={user ? <VideoPlayer /> : <Navigate to="/login" />} />
            <Route path="/live/:streamId" element={<FeatureGate flag="LIVE_STREAMING"><LiveStreamViewer /></FeatureGate>} />

            {/* WALLET PAGE */}
            <Route path="/wallet" element={user ? <FeatureGate flag="JONCOIN"><WalletPage /></FeatureGate> : <Navigate to="/login" />} />
            <Route path="/community-guidelines" element={<LegalPage kind="community-guidelines" />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="/cookies" element={<LegalPage kind="cookies" />} />
            <Route path="/help" element={<LegalPage kind="help" />} />
            <Route path="/about" element={<LegalPage kind="about" />} />
            <Route path="/data" element={<LegalPage kind="data" />} />
            <Route path="/legal" element={<LegalPage kind="help" />} />

            {/* ROOT - landing page e re, ose feed nëse je i loguar */}
            <Route path="/welcome" element={user ? <Navigate to="/feed" /> : <WelcomeOnboarding />} />
            <Route
              path="/"
              element={
                user ? (
                  <Navigate to="/feed" />
                ) : isWelcomeOnboardingDone() ? (
                  <LandingPage />
                ) : (
                  <Navigate to="/welcome" replace />
                )
              }
            />

            </Routes>
          </Suspense>
        </main>
        </div>
      </PlatformProvider>
      </PostsProvider>
      </CartProvider>
    </ErrorBoundary>
  );
}

export default App;
