import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Cog6ToothIcon, ChartBarIcon, TrophyIcon, VideoCameraIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePosts } from '../contexts/PostsContext';
import { Room, createLocalTracks } from 'livekit-client';
import { liveStreamAPI, livekitAPI, messagingAPI, notificationsAPI, streamsAPI } from '../services/api';
import { APP_BRAND_NAME } from '../config/branding';




function Navbar() {
  const { user, logout } = useAuth();
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
    return apiRoot + (normalized.startsWith('/') ? normalized : '/' + normalized);
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const livekitRoomRef = useRef(null);
  const livekitTracksRef = useRef([]);
  // Feed toggle (My / All)
  const { fetchPosts } = usePosts();
  const initialFollowedOnly = (() => {
    try { return localStorage.getItem('feed_followed_only') === 'true'; } catch (e) { return false; }
  })();
  const [followedOnly, setFollowedOnly] = useState(initialFollowedOnly);


  useEffect(() => {
    if (user) {
      fetchHeaderBadges();
      const interval = setInterval(fetchHeaderBadges, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const onBump = () => {
      void fetchHeaderBadges();
    };
    window.addEventListener('messaging-unread-changed', onBump);
    return () => window.removeEventListener('messaging-unread-changed', onBump);
  }, [user]);

  const fetchHeaderBadges = async () => {
    try {
      const [notifRes, msgRes] = await Promise.all([
        notificationsAPI.getUnreadCount(),
        messagingAPI.getUnreadCount(),
      ]);
      setUnreadCount(notifRes.data.count || 0);
      setMessagesUnread(
        Number(msgRes?.data?.count ?? msgRes?.data?.unreadCount ?? msgRes?.data?.unread ?? 0)
      );
    } catch (error) {
      console.error('Error fetching header badges:', error);
    }
  };

  const handleStartLiveStream = async (e) => {
    e.preventDefault();
    if (!cameraReady) {
      alert('Open camera first before starting live.');
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
        res = await streamsAPI.createStream({ ...payload, isPremium: false });
      } catch (_streamErr) {
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
      } catch (_startErr) {}

      const roomName = `stream-${createdId}`;
      const tokenRes = await livekitAPI.createToken({
        roomName,
        participantName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || String(user?.id || 'streamer'),
        metadata: { streamId: createdId, role: 'broadcaster' },
        canPublish: true,
        canSubscribe: true,
      });

      const wsUrl = tokenRes?.data?.wsUrl;
      const token = tokenRes?.data?.token;

      if (!wsUrl || !token) {
        throw new Error('LiveKit token response is invalid');
      }

      const room = new Room();
      await room.connect(wsUrl, token, { autoSubscribe: true });
      const localTracks = await createLocalTracks({ audio: true, video: true });
      for (const track of localTracks) {
        await room.localParticipant.publishTrack(track);
      }
      livekitRoomRef.current = room;
      livekitTracksRef.current = localTracks;
      setActiveLiveStreamId(createdId);

      alert('Live stream started.');
      setShowLiveModal(false);
    } catch (err) {
      console.error('Failed to start live stream:', err);
      alert('Failed to start live stream. Please try again.');
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
      if (livekitTracksRef.current?.length) {
        livekitTracksRef.current.forEach((track) => {
          try {
            track.stop();
          } catch (_e) {}
        });
      }
      livekitTracksRef.current = [];

      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
      }

      await streamsAPI.endStream(activeLiveStreamId);
      setActiveLiveStreamId(null);
      alert('Live stream ended.');
    } catch (err) {
      console.error('Failed to end live stream:', err);
      alert('Failed to end live stream. Please try again.');
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
      alert('Camera/Microphone permission is required.');
    }
  }, [cameraReady]);

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
      if (livekitTracksRef.current?.length) {
        livekitTracksRef.current.forEach((track) => {
          try {
            track.stop();
          } catch (_e) {}
        });
        livekitTracksRef.current = [];
      }
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  return (
    <nav className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">

        {/* LOGO */}
        <Link to="/feed" className="text-2xl font-bold text-primary">
          {APP_BRAND_NAME}
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

          {/* Dark mode toggle removed (available in Settings) */}

          {/* BURGER MENU BUTTON */}
          {/* FEED TOGGLE: compact My / All */}
          <div className="flex items-center ml-1">
            <button
              onClick={() => {
                const newVal = true;
                try { localStorage.setItem('feed_followed_only', newVal ? 'true' : 'false'); } catch (e) {}
                setFollowedOnly(newVal);
                fetchPosts({ followedOnly: newVal });
              }}
              className={`px-2 py-1 text-sm rounded-l-md border ${followedOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              aria-pressed={followedOnly}
              aria-label="Show My feed"
            >
              My
            </button>
            <button
              onClick={() => {
                const newVal = false;
                try { localStorage.setItem('feed_followed_only', newVal ? 'true' : 'false'); } catch (e) {}
                setFollowedOnly(newVal);
                fetchPosts({ followedOnly: newVal });
              }}
              className={`px-2 py-1 text-sm rounded-r-md border ${!followedOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              aria-pressed={!followedOnly}
              aria-label="Show All feed"
            >
              All
            </button>
          </div>
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
              {messagesUnread > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[1.5rem] text-center">
                  {messagesUnread > 99 ? '99+' : messagesUnread}
                </span>
              )}
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

            {/* Shto Reklamë */}
            <button
              onClick={() => {
                // Dërgo event custom për të hapur modalin në AdSlider
                window.dispatchEvent(new CustomEvent('open-ad-modal'));
              }}
              className="flex items-center gap-3 p-3 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors mt-2 w-full"
            >
              <span className="text-2xl">📢</span>
              <span className="font-medium">Shto reklamë</span>
            </button>

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

      {/* Go Live button removed from top navbar — use BottomNav button instead */}

      {/* Modal për live stream */}
      {user && showLiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Start Live Stream</h2>
            <form onSubmit={handleStartLiveStream}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Title</label>
                <input type="text" value={liveTitle} onChange={e => setLiveTitle(e.target.value)} required className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={liveDescription} onChange={e => setLiveDescription(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Public</label>
                <input type="checkbox" checked={liveIsPublic} onChange={e => setLiveIsPublic(e.target.checked)} />
              </div>
              <button
                type="button"
                onClick={handleOpenCameraFirst}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium mt-1"
              >
                {cameraReady ? 'Camera ready' : 'Open camera first'}
              </button>
              {cameraStream ? (
                <div className="mt-3">
                  <video ref={livePreviewRef} autoPlay muted playsInline className="w-full rounded border" />
                </div>
              ) : null}
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium mt-2">Start Live</button>
              {activeLiveStreamId ? (
                <button
                  type="button"
                  onClick={handleEndLiveStream}
                  disabled={isEndingLive}
                  className="ml-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium mt-2"
                >
                  {isEndingLive ? 'Ending...' : 'End Current Live'}
                </button>
              ) : null}
              <button type="button" onClick={() => { stopCameraPreview(); setShowLiveModal(false); }} className="ml-2 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium mt-2">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
