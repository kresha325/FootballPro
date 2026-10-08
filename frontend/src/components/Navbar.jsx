import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import NotificationBell from './NotificationBell';
import { Cog6ToothIcon, ChartBarIcon, TrophyIcon, VideoCameraIcon, Bars3Icon, XMarkIcon, MagnifyingGlassIcon, HomeIcon, ShoppingBagIcon, BellIcon, ChatBubbleLeftRightIcon, UsersIcon, BuildingOffice2Icon, LockClosedIcon, SparklesIcon, MegaphoneIcon, ArrowRightOnRectangleIcon, CalendarDaysIcon, GiftIcon } from '@heroicons/react/24/outline';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePosts } from '../contexts/PostsContext';
import { liveStreamAPI, messagingAPI, notificationsAPI, profileAPI, streamsAPI } from '../services/api';
import { confirmGoLiveInBrowser } from '../utils/goLiveConfirm';
import { navigateToEmbedGoLive } from '../utils/goLiveNavigate';
import { normalizeYoutubeChannelId } from '../utils/youtubeChannel';
import { APP_BRAND_NAME, APP_BRAND_WORDMARK, APP_LOGO_SRC } from '../config/branding';
import { hasTier } from '../utils/subscriptionAccess';




function Navbar() {
  const { user, logout } = useAuth();
  const { totalPieces } = useCart();
  const cartBadge = totalPieces > 0 ? (totalPieces > 99 ? '99+' : String(totalPieces)) : null;
  const navigate = useNavigate();
  const rawApiUrl = import.meta.env.VITE_API_URL || '';
  const apiRoot = rawApiUrl ? rawApiUrl.replace('/api','') : '';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0); // notifications (pa DM)
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDescription, setLiveDescription] = useState('');
  const [liveIsPublic, setLiveIsPublic] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [activeLiveStreamId, setActiveLiveStreamId] = useState(null);
  const [isEndingLive, setIsEndingLive] = useState(false);
  const livePreviewRef = useRef(null);
  // Feed toggle (My / All)
  const { fetchPosts } = usePosts();
  const initialFollowedOnly = (() => {
    try { return localStorage.getItem('feed_followed_only') === 'true'; } catch (e) { return false; }
  })();
  const [followedOnly, setFollowedOnly] = useState(initialFollowedOnly);

  const fetchHeaderBadges = useCallback(async () => {
    try {
      const [notifRes, msgRes] = await Promise.all([
        notificationsAPI.getUnreadCount(),
        messagingAPI.getUnreadCount(),
      ]);
      const notifCount = Number(
        notifRes?.data?.count ?? notifRes?.data?.unreadCount ?? notifRes?.data?.unread ?? 0
      );
      const messageCount = Number(
        msgRes?.data?.count ?? msgRes?.data?.unreadCount ?? msgRes?.data?.unread ?? 0
      );
      setUnreadCount(Number.isFinite(notifCount) ? Math.max(0, notifCount) : 0);
      setMessagesUnread(Number.isFinite(messageCount) ? Math.max(0, messageCount) : 0);
      window.dispatchEvent(
        new CustomEvent('messaging-unread-count', {
          detail: { count: Number.isFinite(messageCount) ? Math.max(0, messageCount) : 0 },
        })
      );
    } catch (error) {
      console.error('Error fetching header badges:', error);
    }
  }, []);

  const burgerBadgeTotal = (Number(unreadCount) || 0) + (Number(messagesUnread) || 0);

  useEffect(() => {
    if (!user) return undefined;
    void fetchHeaderBadges();
    const interval = setInterval(() => {
      void fetchHeaderBadges();
    }, 30000);
    return () => clearInterval(interval);
  }, [user, fetchHeaderBadges]);

  useEffect(() => {
    if (!user) return undefined;
    const onNotif = (event) => {
      const count = Number(event?.detail?.count);
      if (Number.isFinite(count)) {
        setUnreadCount(Math.max(0, count));
        return;
      }
      void fetchHeaderBadges();
    };
    const onBump = () => {
      void fetchHeaderBadges();
    };
    window.addEventListener('messaging-unread-changed', onBump);
    window.addEventListener('notifications-unread-changed', onNotif);
    return () => {
      window.removeEventListener('messaging-unread-changed', onBump);
      window.removeEventListener('notifications-unread-changed', onNotif);
    };
  }, [user, fetchHeaderBadges]);

  const handleStartLiveStream = async (e) => {
    e.preventDefault();
    if (!hasTier(user, 'pro')) {
      alert('Live streaming kërkon planin Pro.');
      navigate('/premium');
      return;
    }
    if (!cameraReady) {
      alert('Open camera first before starting live.');
      return;
    }

    let youtubeChannelId = null;
    try {
      const prof = await profileAPI.getMyProfile();
      youtubeChannelId = normalizeYoutubeChannelId(prof?.data?.youtubeChannelId);
    } catch {
      /* ignore */
    }

    if (
      !confirmGoLiveInBrowser({
        title: liveTitle?.trim() || 'Live Stream',
        youtubeChannelId,
      })
    ) {
      return;
    }

    try {
      const payload = {
        title: liveTitle?.trim() || 'Live Stream',
        description: liveDescription?.trim() || '',
        isPublic: !!liveIsPublic,
      };

      let res;
      try {
        res = await streamsAPI.createStream({ ...payload, isPremium: false, playbackSource: 'livekit' });
      } catch {
        res = await liveStreamAPI.start(payload);
      }

      const createdId =
        res?.data?.id ||
        res?.data?.stream?.id ||
        res?.data?.liveStream?.id ||
        null;

      if (!createdId) {
        throw new Error('Stream creation returned no stream id');
      }

      try {
        await streamsAPI.startStream(createdId);
      } catch {
        /* stream may already be live */
      }

      setActiveLiveStreamId(createdId);
      stopCameraPreview();
      setShowLiveModal(false);
      navigateToEmbedGoLive(navigate, {
        streamId: createdId,
        title: payload.title,
        description: payload.description,
      });
    } catch (err) {
      console.error('Failed to start live stream:', err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.msg ||
        'Nuk u arrit nisja e transmetimit live. Ju lutem provoni përsëri.';
      alert(msg);
      if (err?.response?.data?.code === 'PLAN_REQUIRED') navigate('/premium');
    }
  };

  const stopCameraPreview = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCameraReady(false);
    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null;
    }
  };

  const handleEndLiveStream = async () => {
    if (!activeLiveStreamId) return;

    setIsEndingLive(true);
    try {
      await streamsAPI.endStream(activeLiveStreamId);
      setActiveLiveStreamId(null);
      alert('Transmetimi live përfundoi.');
    } catch (err) {
      console.error('Failed to end live stream:', err);
      alert('Nuk u arrit përfundimi i transmetimit live. Ju lutem provoni përsëri.');
    } finally {
      setIsEndingLive(false);
    }
  };

  const handleOpenCameraFirst = useCallback(async () => {
    if (cameraReady) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraStream(stream);
      setCameraReady(true);
      if (livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        await livePreviewRef.current.play?.();
      }
    } catch (err) {
      console.error('Camera open failed:', err);
      alert('Leja për kamerë/mikrofon është e detyrueshme.');
    }
  }, [cameraReady]);

  useEffect(() => {
    if (!showLiveModal || !cameraStream || !livePreviewRef.current) return;
    livePreviewRef.current.srcObject = cameraStream;
    livePreviewRef.current.play?.().catch(() => {});
  }, [showLiveModal, cameraStream]);

  // Allow other components to open the Go Live modal via a window event
  useEffect(() => {
    const openHandler = async (event) => {
      setShowLiveModal(true);
      if (event?.detail?.openCameraFirst) {
        await handleOpenCameraFirst();
      }
    };
    window.addEventListener('open-live-modal', openHandler);
    return () => window.removeEventListener('open-live-modal', openHandler);
  }, [handleOpenCameraFirst]);

  useEffect(() => {
    if (!showLiveModal) {
      stopCameraPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLiveModal]);

  useEffect(() => {
    return () => {
      stopCameraPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeMenu = useCallback(() => {
    menuButtonRef.current?.focus();
    setIsMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen, closeMenu]);



  return (
    <nav className="xt-app-nav fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-6">

        {/* LOGO: mark + TALENTI */}
        <Link
          to="/feed"
          className="flex min-w-0 items-center gap-1.5"
          aria-label={APP_BRAND_NAME}
        >
          <img
            src={APP_LOGO_SRC}
            alt=""
            className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
            width={40}
            height={40}
            decoding="async"
          />
          <span className="truncate text-xl font-extrabold uppercase tracking-[.16em] text-[var(--xt-color-text)] sm:text-2xl">
            {APP_BRAND_WORDMARK}
          </span>
        </Link>

        {/* RIGHT SECTION: Search + Dark Mode + Burger Menu */}
        <div className="flex items-center gap-3">
          
          {/* SEARCH */}
          <Link
            to="/search"
            className="grid h-11 w-11 place-items-center rounded-lg text-[var(--xt-color-text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--xt-color-gold-bright)]"
            aria-label="Search"
          >
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </Link>

          {/* Dark mode toggle removed (available in Settings) */}

          {/* BURGER MENU BUTTON */}
          {/* FEED TOGGLE: compact My / All */}
          <div className="flex items-center ml-1">
            <button
              onClick={() => {
                const newVal = true;
                try { localStorage.setItem('feed_followed_only', newVal ? 'true' : 'false'); } catch { /* private mode */ }
                setFollowedOnly(newVal);
                fetchPosts({ followedOnly: newVal });
              }}
              className={`min-h-10 px-3 text-sm font-medium rounded-l-lg border transition-colors ${followedOnly ? 'bg-[var(--xt-color-gold)] text-[#101114] border-[var(--xt-color-gold)]' : 'bg-[var(--xt-color-surface)] text-[var(--xt-color-text-muted)] border-white/15'}`}
              aria-pressed={followedOnly}
              aria-label="Show My feed"
            >
              My
            </button>
            <button
              onClick={() => {
                const newVal = false;
                try { localStorage.setItem('feed_followed_only', newVal ? 'true' : 'false'); } catch { /* private mode */ }
                setFollowedOnly(newVal);
                fetchPosts({ followedOnly: newVal });
              }}
              className={`min-h-10 px-3 text-sm font-medium rounded-r-lg border transition-colors ${!followedOnly ? 'bg-[var(--xt-color-gold)] text-[#101114] border-[var(--xt-color-gold)]' : 'bg-[var(--xt-color-surface)] text-[var(--xt-color-text-muted)] border-white/15'}`}
              aria-pressed={!followedOnly}
              aria-label="Show All feed"
            >
              All
            </button>
          </div>

          {/* Profile — vetëm desktop (mobile: bottom nav) */}
          {user ? (
            <Link
              to={`/profile/${user.id}`}
              className="hidden md:flex items-center rounded-full ring-2 ring-white/15 hover:ring-[var(--xt-color-gold)] transition-all"
              aria-label="Profile"
            >
              {user.profilePhoto && typeof user.profilePhoto === 'string' && user.profilePhoto.trim() !== '' ? (
                <img
                  src={getFullUrl(user.profilePhoto)}
                  alt="Profile"
                  className="w-9 h-9 rounded-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/default-avatar.svg';
                  }}
                />
              ) : (
                <div className="xt-avatar h-9 w-9 text-sm">
                  {user.firstName?.[0]}
                </div>
              )}
            </Link>
          ) : null}

          <NotificationBell unreadCount={unreadCount} />

          <button
            ref={menuButtonRef}
            onClick={() => {
              const next = !isMenuOpen;
              if (next) setIsMenuOpen(true);
              else closeMenu();
              if (next) void fetchHeaderBadges();
            }}
            className="relative grid h-11 w-11 place-items-center rounded-lg text-[var(--xt-color-text-muted)] transition-colors hover:bg-white/10 hover:text-[var(--xt-color-gold-bright)]"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
            aria-controls="authenticated-navigation-menu"
            type="button"
          >
            {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            {!isMenuOpen && burgerBadgeTotal > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {burgerBadgeTotal > 9 ? '9+' : burgerBadgeTotal}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* BURGER MENU SIDEBAR — mobile: plot lartësinë, me scroll, mbi bottom nav */}
      <nav
        id="authenticated-navigation-menu"
        aria-label="Navigimi i llogarisë"
        aria-hidden={!isMenuOpen}
        inert={!isMenuOpen}
        className={`xt-account-drawer fixed top-16 right-0 z-[60] h-[calc(100vh-4rem)] w-80 max-w-[min(20rem,100vw)] transform overflow-y-auto overscroll-contain border-l border-white/10 bg-[#08111f]/[.98] shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        } bottom-0 h-[calc(100vh-4rem)]`}
      >
        <div className="p-6 space-y-6 pb-28">
          
          {/* MENU ITEMS */}
          <div className="space-y-2">

            {/* Navigim kryesor — desktop (mobile: bottom nav) */}
            <div className="hidden md:block space-y-2 pb-4 mb-2 border-b border-white/10">
              <Link
                to="/feed"
                onClick={() => closeMenu()}
                className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
              >
                <HomeIcon className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Ballina</span>
              </Link>

              <Link
                to="/marketplace"
                onClick={() => closeMenu()}
                className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
              >
                <ShoppingBagIcon className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Tregu</span>
                {cartBadge ? (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[1.5rem] text-center">
                    {cartBadge}
                  </span>
                ) : null}
              </Link>

              <Link
                to="/tournaments"
                onClick={() => closeMenu()}
                className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
              >
                <TrophyIcon className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Turnetë</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  window.dispatchEvent(new CustomEvent('open-live-modal', { detail: { openCameraFirst: true } }));
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors"
              >
                <VideoCameraIcon className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Dil LIVE</span>
              </button>
            </div>

            {/* Tournaments — mobile (desktop: seksioni më sipër) */}
            <Link
              to="/tournaments"
              onClick={() => closeMenu()}
              className="md:hidden xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <TrophyIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Turnetë</span>
            </Link>
            
            {/* Notifications */}
            <Link 
              to="/notifications" 
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <BellIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Njoftimet</span>
              {unreadCount > 0 && (
                <span className="xt-drawer-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Messages */}
            <Link 
              to="/messaging" 
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Mesazhet</span>
              {messagesUnread > 0 && (
                <span className="xt-drawer-badge">
                  {messagesUnread > 99 ? '99+' : messagesUnread}
                </span>
              )}
            </Link>

            {/* Browse Profiles */}
            <Link 
              to="/profiles" 
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <UsersIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Shfleto Profilet</span>
            </Link>

            {/* Insights (Analitika + Gamifikim) */}
            <Link 
              to="/insights" 
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <ChartBarIcon className="h-6 w-6" />
              <span className="font-medium">Insights</span>
            </Link>

            {/* Videos */}
            <Link 
              to="/videos" 
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <VideoCameraIcon className="h-6 w-6" />
              <span className="font-medium">Videot</span>
            </Link>

            {/* Matches */}
            <Link 
              to="/matches" 
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <CalendarDaysIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Ndeshjet</span>
            </Link>
            <Link
              to="/competitions"
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <TrophyIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Garat</span>
            </Link>
            <Link
              to="/calendar"
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <CalendarDaysIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Kalendari</span>
            </Link>

            {/* Scouting (scout + club) */}
            {(user?.role === 'scout' || user?.role === 'club' || user?.role === 'manager') && (
              <Link 
                to="/scouting" 
                onClick={() => closeMenu()}
                className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
              >
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Scouting</span>
              </Link>
            )}

            {/* Club Roster (for clubs) */}
            {user?.role === 'club' && (
              <Link 
                to="/club-roster" 
                onClick={() => closeMenu()}
                className="xt-drawer-link flex items-center gap-3 rounded-lg border border-[var(--xt-color-gold)]/40 bg-white/5 p-3 text-[var(--xt-color-gold-bright)] transition-colors hover:bg-white/10"
              >
                <BuildingOffice2Icon className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Formacioni i Klubit</span>
              </Link>
            )}

            {/* Admin Dashboard (for admins) */}
            {user?.role === 'admin' && (
              <Link 
                to="/admin" 
                onClick={() => closeMenu()}
                className="xt-drawer-link flex items-center gap-3 rounded-lg border border-red-400/40 bg-white/5 p-3 text-red-300 transition-colors hover:bg-white/10"
              >
                <LockClosedIcon className="h-5 w-5" aria-hidden="true" />
                <span className="font-medium">Paneli i Adminit</span>
              </Link>
            )}


            {/* Premium */}
            <Link 
              to="/premium" 
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 rounded-lg border border-[var(--xt-color-gold)]/40 bg-white/5 p-3 text-[var(--xt-color-gold-bright)] transition-colors hover:bg-white/10"
            >
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Kalo në Premium</span>
            </Link>

            {/* Sponsorë */}
            <Link
              to="/sponsors"
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <GiftIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Sponsorë</span>
            </Link>

            {/* Reklama */}
            <Link
              to="/ads"
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <MegaphoneIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Reklama</span>
            </Link>

            {/* Settings */}
            <Link 
              to="/settings" 
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Cilësimet</span>
            </Link>

            <Link
              to="/help"
              onClick={() => closeMenu()}
              className="xt-drawer-link flex items-center gap-3 p-3 rounded-lg transition-colors"
            >
              <SparklesIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Ndihmë & Info</span>
            </Link>

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                closeMenu();
                navigate('/login');
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
              <span className="font-medium">Dil</span>
            </button>

          </div>
        </div>
      </nav>

      {/* OVERLAY */}
      {isMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 top-16 z-40 cursor-default bg-black/50"
          aria-label="Mbyll menunë"
          onClick={() => closeMenu()}
        />
      )}

      {/* Go Live button removed from top navbar — use BottomNav button instead */}

      {/* Modal për live stream */}
      {user && showLiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start md:items-center justify-center z-50 overflow-y-auto p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Nis transmetim live</h2>
            <form onSubmit={handleStartLiveStream}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Titulli</label>
                <input type="text" value={liveTitle} onChange={e => setLiveTitle(e.target.value)} required className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Përshkrimi</label>
                <textarea value={liveDescription} onChange={e => setLiveDescription(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Publik</label>
                <input type="checkbox" checked={liveIsPublic} onChange={e => setLiveIsPublic(e.target.checked)} />
              </div>
              <button
                type="button"
                onClick={handleOpenCameraFirst}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium mt-1"
              >
                {cameraReady ? 'Kamera gati' : 'Hap kamerën fillimisht'}
              </button>
              {cameraStream ? (
                <div className="mt-3">
                  <video ref={livePreviewRef} autoPlay muted playsInline className="w-full rounded border" />
                </div>
              ) : null}
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium mt-2">Nis LIVE</button>
              {activeLiveStreamId ? (
                <button
                  type="button"
                  onClick={handleEndLiveStream}
                  disabled={isEndingLive}
                  className="ml-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium mt-2"
                >
                  {isEndingLive ? 'Duke përfunduar...' : 'Përfundo LIVE aktual'}
                </button>
              ) : null}
              <button type="button" onClick={() => { stopCameraPreview(); setShowLiveModal(false); }} className="ml-2 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium mt-2">Anulo</button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
