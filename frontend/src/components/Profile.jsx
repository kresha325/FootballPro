import React, { useEffect, useRef, useState } from 'react';
import { getJonCoinBalance } from '../services/joncoin';
import { useParams, useNavigate } from 'react-router-dom';
import { profileAPI, galleryAPI, subscriptionsAPI, messagingAPI, sponsorAPI, streamsAPI, liveStreamAPI } from '../services/api';
// import userStreamsAPI from '../services/userStreamsAPI';
import Videos from './Videos';
import { usePosts } from '../contexts/PostsContext';
import EditProfile from './EditProfile';
import { useAuth } from '../contexts/AuthContext';
import PlayerProfile from './profiles/PlayerProfile';
import CoachProfile from './profiles/CoachProfile';
import ScoutProfile from './profiles/ScoutProfile';
import ClubProfile from './profiles/ClubProfile';
import ManagerProfile from './profiles/ManagerProfile';
import BusinessProfile from './profiles/BusinessProfile';
import LigaProfile from './profiles/LigaProfile';
import FederationProfile from './profiles/FederationProfile';
import ProfileSelector from './profiles/ProfileSelector';
import { ClubBadge } from '../utils/clubLogos';
import { isUserSponsored } from '../utils/sponsor';
import TransferHistory from './TransferHistory';
import VideoCallSimple from './VideoCallSimple';

// Helper to get full URL for images/videos
const apiRoot = import.meta.env.VITE_API_URL?.replace('/api','') || '';
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

// Komponenti Chat Live për modalin e stream-it
function LiveStreamChat({ streamId, userId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    // Fetch messages
    fetch(`/api/live-chat/${streamId}`)
      .then(res => res.json())
      .then(setMessages);
    // Optional: Polling for new messages every 2s
    const interval = setInterval(() => {
      fetch(`/api/live-chat/${streamId}`)
        .then(res => res.json())
        .then(setMessages);
    }, 2000);
    return () => clearInterval(interval);
  }, [streamId]);

  const sendMessage = () => {
    if (!input.trim()) return;
    fetch('/api/live-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamId, userId, message: input })
    })
      .then(res => res.json())
      .then(() => {
        setInput('');
        fetch(`/api/live-chat/${streamId}`)
          .then(res => res.json())
          .then(setMessages);
      });
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 8, maxHeight: 300, overflowY: 'auto', background: '#fff' }}>
      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Chat Live</div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 'bold' }}>{msg.userId}:</span> {msg.message}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Shkruaj mesazhin..."
          style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button
          onClick={sendMessage}
          style={{ marginLeft: 8, padding: '6px 12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4 }}
        >
          Dërgo
        </button>
      </div>
    </div>
  );
}

// Komponenti Reactions/Emoji për modalin e stream-it
function LiveStreamReactions({ streamId, userId }) {
  const emojis = ['👍', '❤️', '😂', '🔥', '👏'];
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    fetch(`/api/live-reaction/${streamId}`)
      .then(res => res.json())
      .then(setReactions);
    const interval = setInterval(() => {
      fetch(`/api/live-reaction/${streamId}`)
        .then(res => res.json())
        .then(setReactions);
    }, 2000);
    return () => clearInterval(interval);
  }, [streamId]);

  const sendReaction = emoji => {
    fetch('/api/live-reaction/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamId, userId, emoji })
    })
      .then(res => res.json())
      .then(() => {
        fetch(`/api/live-reaction/${streamId}`)
          .then(res => res.json())
          .then(setReactions);
      });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Reactions</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {emojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            style={{ fontSize: 22, padding: '4px 10px', border: 'none', background: '#f0f0f0', borderRadius: 6, cursor: 'pointer' }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: 60, overflowY: 'auto', fontSize: 16 }}>
        {reactions.slice(-10).map((r, idx) => (
          <span key={idx} style={{ marginRight: 6 }}>{r.emoji}</span>
        ))}
      </div>
    </div>
  );
}

// Komponenti Invite Guests për modalin e stream-it
function LiveStreamGuests({ streamId, userId }) {
  const [guests, setGuests] = useState([]);
  const [inviteId, setInviteId] = useState('');

  useEffect(() => {
    fetch(`/api/live-stream-guest/${streamId}`)
      .then(res => res.json())
      .then(setGuests);
    const interval = setInterval(() => {
      fetch(`/api/live-stream-guest/${streamId}`)
        .then(res => res.json())
        .then(setGuests);
    }, 2000);
    return () => clearInterval(interval);
  }, [streamId]);

  const inviteGuest = () => {
    if (!inviteId.trim()) return;
    fetch('/api/live-stream-guest/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamId, userId: inviteId, invitedBy: userId })
    })
      .then(res => res.json())
      .then(() => {
        setInviteId('');
        fetch(`/api/live-stream-guest/${streamId}`)
          .then(res => res.json())
          .then(setGuests);
      });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Fto Guests</div>
      <div style={{ display: 'flex', marginBottom: 8 }}>
        <input
          value={inviteId}
          onChange={e => setInviteId(e.target.value)}
          placeholder="ID e userit për ftesë"
          style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button
          onClick={inviteGuest}
          style={{ marginLeft: 8, padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4 }}
        >
          Fto
        </button>
      </div>
      <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: 15 }}>
        {guests.map(g => (
          <div key={g.id} style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 'bold' }}>{g.userId}</span> - {g.status}
          </div>
        ))}
      </div>
    </div>
  );
}

const Profile = () => {
    // const [streams, setStreams] = useState([]);
    // const [streamsLoading, setStreamsLoading] = useState(true);
  const { id } = useParams();
  // Fix ReferenceError: sponsorList is not defined
  const [sponsorList, setSponsorList] = useState([]);
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const [editingSponsorId, setEditingSponsorId] = useState(null);
  const [editingSponsor, setEditingSponsor] = useState({ name: '', link: '' });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    allPosts, 
    likedPosts, 
    postComments, 
    fetchUserPosts, 
    toggleLike, 
    fetchComments, 
    addComment 
  } = usePosts();

  const fetchUserPostsRef = useRef(fetchUserPosts);
  useEffect(() => {
    fetchUserPostsRef.current = fetchUserPosts;
  }, [fetchUserPosts]);

  const [profile, setProfile] = useState(null);
  const [jonCoinBalance, setJonCoinBalance] = useState(0);
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(null);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [commentInputs, setCommentInputs] = useState({});
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDescription, setLiveDescription] = useState('');
  const [liveIsPublic, setLiveIsPublic] = useState(false);
  const [liveStreamId, setLiveStreamId] = useState(null);
  const [stats, setStats] = useState({
    posts: 0,
    followers: 0,
    following: 0,
  });
  // Shtojme state per modalin e fotos full screen
  const [fullScreenImage, setFullScreenImage] = useState(null);

  // Set gallery image as profile or cover photo

  const setAsProfilePhoto = async (imageUrl, type) => {
    try {
      const formData = new FormData();
      // Only prepend apiRoot if imageUrl is relative
      const fetchUrl = getFullUrl(imageUrl);
      const response = await fetch(fetchUrl);
      const blob = await response.blob();
      const filename = imageUrl.split('/').pop();
      const file = new File([blob], filename, { type: blob.type });

      if (type === 'profile') {
        formData.append('profilePhoto', file);
      } else {
        formData.append('coverPhoto', file);
      }

      await profileAPI.updateProfile(formData);

      // Refresh profile
      const res = await profileAPI.getProfile(id);
      setProfile(res.data);
    } catch (error) {
      console.error('Error setting photo:', error);
      alert('Failed to update photo');
    }
  };

  // Fshi item nga galeria (brenda komponentit, ku `galleryAPI` dhe `setGallery` ekzistojnë)
  const handleDeleteGalleryItem = async (itemId, e) => {
    e?.stopPropagation && e.stopPropagation();
    if (!window.confirm('A jeni i sigurt që doni ta fshini këtë media?')) return;
    try {
      const res = await galleryAPI.deleteMedia(itemId);
      if (res.status === 200) {
        setGallery((g) => g.filter((item) => item.id !== itemId));
        alert('Media u fshi me sukses!');
      } else {
        alert('Fshirja dështoi!');
      }
    } catch (err) {
      console.error('Delete gallery item error:', err);
      alert('Fshirja dështoi!');
    }
  };

  // Funksion për butonin e mesazheve (duhet të jetë brenda komponentit që të përdorë state profile)
  const handleMessage = async () => {
    if (profile && profile.id) {
      try {
        // Thirr API për të marrë ose krijuar bisedën
        const res = await messagingAPI.getOrCreateConversation(profile.id);
        const conversation = res.data;
        if (conversation && conversation.id) {
          navigate(`/messaging?conversationId=${conversation.id}`);
        } else {
          alert('Could not start conversation.');
        }
      } catch (err) {
        console.error('Error opening/creating conversation:', err);
        alert('Failed to open or create conversation.');
      }
    }
  };

  const userId = user?.id || profile?.id || null;

  const getLiveStreamShareLink = (streamId) => {
    if (!streamId) return window.location.href;
    return `${window.location.origin}/live/${streamId}`;
  };

  const handleStartLiveStream = async (e) => {
    e.preventDefault();
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
        // Keep compatibility with deployments that still use /live-stream.
        res = await liveStreamAPI.start(payload);
      }

      const createdId =
        res?.data?.id ||
        res?.data?.stream?.id ||
        res?.data?.liveStream?.id ||
        null;

      if (!createdId) {
        throw new Error('Stream was created but no stream ID was returned.');
      }

      try {
        await streamsAPI.startStream(createdId);
      } catch (_startErr) {
        // Some deployments may already create live streams directly.
      }

      setLiveStreamId(createdId);
      alert('Live stream started. You can now share the link.');
    } catch (err) {
      console.error('Failed to start live stream:', err);
      alert('Failed to start live stream. Please try again.');
    }
  };

  const fetchSponsors = async (userId) => {
    if (!userId) return;
    setSponsorLoading(true);
    try {
      const res = await sponsorAPI.getSponsorsByUser(userId);
      setSponsorList(res.data || []);
    } catch (err) {
      setSponsorList([]);
    } finally {
      setSponsorLoading(false);
    }
  };

  const handleEditSponsor = (sponsor) => {
    setEditingSponsorId(sponsor.id);
    setEditingSponsor({ name: sponsor.name || '', link: sponsor.link || '' });
  };

  const handleCancelEditSponsor = () => {
    setEditingSponsorId(null);
    setEditingSponsor({ name: '', link: '' });
  };

  const handleSaveSponsor = async () => {
    if (!editingSponsorId) return;
    try {
      const res = await sponsorAPI.updateSponsor(editingSponsorId, {
        name: editingSponsor.name,
        link: editingSponsor.link,
      });
      setSponsorList((prev) => prev.map(s => (s.id === editingSponsorId ? res.data : s)));
      handleCancelEditSponsor();
    } catch (err) {
      alert('Ndryshimi i sponsorit dështoi.');
    }
  };

  const handleDeleteSponsor = async (sponsorId) => {
    if (!window.confirm('A jeni i sigurt që doni ta fshini sponsorin?')) return;
    try {
      await sponsorAPI.deleteSponsor(sponsorId);
      setSponsorList((prev) => prev.filter(s => s.id !== sponsorId));
    } catch (err) {
      alert('Fshirja e sponsorit dështoi.');
    }
  };
  // Fetch streams for user (removed)
  // useEffect(() => {
  //   if (!id) return;
  //   setStreamsLoading(true);
  //   userStreamsAPI.getUserStreams(id)
  //     .then(setStreams)
  //     .catch(() => setStreams([]))
  //     .finally(() => setStreamsLoading(false));
  // }, [id]);

  // Fetch profile and related data
  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      try {
        const res = await profileAPI.getProfile(id);
        setProfile(res.data);

        // Fetch user posts using context
        await fetchUserPostsRef.current(id);

        // Fetch user gallery
        try {
          const galleryRes = await galleryAPI.getUserGallery(id);
          setGallery(galleryRes.data);
        } catch (err) {
          console.log('Gallery fetch error:', err);
          setGallery([]);
        }

        // Set stats
        setStats(prev => ({
          ...prev,
          followers: res.data.followers || 0,
          following: res.data.following || 0,
        }));

        await fetchSponsors(id);

        // Fetch JonCoin balance
        const balance = await getJonCoinBalance(id);
        setJonCoinBalance(Number(balance) || 0);
      } catch (err) {
        console.error('PROFILE FETCH ERROR:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  useEffect(() => {
    if (!id || !user || user.id === parseInt(id)) return;
    const checkStatus = async () => {
      try {
        const followStatusRes = await profileAPI.checkFollowStatus(id);
        setIsFollowing(followStatusRes.data.isFollowing);
      } catch (err) {
        console.error('Error checking follow status:', err);
      }
    };
    checkStatus();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    const userPostsData = allPosts.filter(post => post.userId === parseInt(id));
    setStats(prev => ({ ...prev, posts: userPostsData.length }));
  }, [id, allPosts]);

  // Follow/Unfollow handlers
  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await profileAPI.unfollowUser(id);
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await profileAPI.followUser(id);
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
      // Refresh profile to get accurate counts from server
      const res = await profileAPI.getProfile(id);
      setStats({
        posts: stats.posts,
        followers: res.data.followers || 0,
        following: res.data.following || 0,
      });
    } catch (error) {
      console.error('Follow error:', error);
      alert(error.response?.data?.msg || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  // Role-based profile component renderer
  const renderProfileContent = () => {
    if (!profile) return null;
    return <ProfileSelector user={profile.User ? profile.User : profile} profile={profile} isOwner={isOwner} />;
  };

  // Helper functions for role logic
  const ENTE_ROLES = ['business', 'federation', 'media', 'club'];
  const INDIVID_ROLES = ['athlete', 'coach', 'scout', 'manager', 'referee'];

  function isEnte(role) {
    return ENTE_ROLES.includes(role);
  }
  function isIndivid(role) {
    return INDIVID_ROLES.includes(role);
  }
  function isAdmin(role) {
    return role === 'admin';
  }

    // Handler for file input change (cover)
    const handleCoverFileChange = async (e) => {
      if (e.target.files && e.target.files[0]) {
        try {
          const formData = new FormData();
          formData.append('coverPhoto', e.target.files[0]);
          await profileAPI.updateProfile(formData);
          const res = await profileAPI.getProfile(id);
          setProfile(res.data);
        } catch (err) {
          alert('Nuk u ruajt fotoja!');
        }
      }
    };




  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>

    </div>
  );
  
  if (!profile) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-xl text-gray-500">Profile not found</p>
    </div>
  );

  const isOwner = user?.id === profile.id;
  const tabs = [
    { key: 'overview', label: '🏠 Overview' },
    { key: 'posts', label: '📝 Posts' },
    { key: 'gallery', label: '🖼️ Gallery' },
    { key: 'videos', label: '🎥 Videos' },
    { key: 'about', label: 'ℹ️ About' },
    { key: 'contact', label: '✉️ Contact' },
  ];
  if (isOwner) {
    tabs.push({ key: 'sponsors', label: '🤝 Sponsors' });
  }

  return (
    <div className="max-w-6xl mx-auto">

      {/* Cover Photo */}
      <div className="h-64 bg-gradient-to-r from-blue-500 to-purple-600 relative flex items-center justify-center overflow-hidden">
        {profile.coverPhoto && (
          <img
            src={getFullUrl(profile.coverPhoto)}
            alt="Cover"
            className="w-full h-full object-cover bg-black/10 rounded-md"
            loading="lazy"
            decoding="async"
            style={{ background: '#f3f4f6' }}
          />
        )}
        {/* Upload cover photo button (only for owner) */}
        {isOwner && (
          <div className="absolute bottom-4 right-4">
            <input type="file" accept="image/*" onChange={handleCoverFileChange} className="hidden" id="cover-upload-input" />
            <label htmlFor="cover-upload-input" className="cursor-pointer bg-blue-500 text-white px-3 py-1 rounded text-sm shadow">Ndrysho Cover</label>
          </div>
        )}
      </div>

      {/* Profile Header */}
      <div className={`shadow mt-28 ${sponsorList.length > 0 ? 'bg-green-100 border-green-300 border-2' : 'bg-white dark:bg-gray-800'}` }>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-20 pb-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 overflow-hidden shadow-lg flex items-center justify-center">
                {profile.profilePhoto ? (
                  <img
                    src={getFullUrl(profile.profilePhoto)}
                    alt={`${profile.firstName} ${profile.lastName}`}
                    className="w-full h-full object-cover bg-white"
                    loading="lazy"
                    decoding="async"
                    style={{ background: '#f3f4f6' }}
                    onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-5xl font-bold">
                    {`${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`}
                  </div>
                )}
              </div>
              {/* Verified Badge */}
              {profile.verified && (
                <div className="absolute bottom-2 right-2 bg-blue-600 rounded-full p-1.5 border-2 border-white dark:border-gray-800">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Name, JonCoin Balance, and Stats */}
            <div className="flex-1 md:ml-6 mt-4 md:mt-0 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {profile.firstName} {profile.lastName}
                </h1>
                {profile.verified && (
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {sponsorList.length > 0 && (
                  <span className="text-xs font-bold animate-pulse" style={{ color: '#22c55e', letterSpacing: '1px', textShadow: '0 0 8px #bbf7d0, 0 0 2px #fff' }}>Sponsored</span>
                )}
                {/* JonCoin Balance */}
                {jonCoinBalance !== null && (
                  <span className="ml-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1" title="JonCoin Balance">
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" stroke="gold" strokeWidth="2" fill="yellow" /><text x="10" y="15" textAnchor="middle" fontSize="10" fill="#b45309" fontWeight="bold">JC</text></svg>
                    {jonCoinBalance} JonCoin
                    <span className="text-xs text-gray-500 ml-1">(1 JonCoin = 1€)</span>
                  </span>
                )}
              </div>
              
              {/* Bio */}
              {profile.bio && (
                <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-2xl">
                  {profile.bio.length > 120 ? `${profile.bio.substring(0, 120)}...` : profile.bio}
                </p>
              )}
              
              <div className="flex items-center justify-center md:justify-start gap-2 mt-3 text-gray-600 dark:text-gray-400 flex-wrap">
                {profile.age && profile.ageGroup && (
                  <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    🎂 {profile.age} years ({profile.ageGroup})
                  </span>
                )}
                {profile.position && (
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    ⚽ {profile.position}
                  </span>
                )}
                {profile.club && (
                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                    {profile.clubLogo ? (
                      <img
                        src={getFullUrl(profile.clubLogo)}
                        alt={profile.club}
                        className="w-6 h-6 rounded-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <ClubBadge clubName={profile.club} size="sm" />
                    )}
                    {profile.club}
                  </span>
                )}
                {profile.stats?.jerseyNumber && (
                  <span className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                    #{profile.stats.jerseyNumber}
                  </span>
                )}
                {profile.city && (
                  <span className="flex items-center gap-1 text-sm">
                    📍 {profile.city}{profile.country && `, ${profile.country}`}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-center md:justify-start gap-6 mt-10">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.posts}</div>
                  <div className="text-sm text-gray-500">Posts</div>
                </div>
                <div className="text-center cursor-pointer hover:text-blue-600 transition">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.followers}</div>
                  <div className="text-sm text-gray-500">Followers</div>
                </div>
                <div className="text-center cursor-pointer hover:text-blue-600 transition">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.following}</div>
                  <div className="text-sm text-gray-500">Following</div>
                </div>
              </div>
              
              {/* Social Links */}
              {(profile.contact?.instagram || profile.contact?.twitter || profile.contact?.facebook) && (
                <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                  {profile.contact.instagram && (
                    <a 
                      href={`https://instagram.com/${profile.contact.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                      aria-label="Instagram"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </a>
                  )}
                  {profile.contact.twitter && (
                    <a 
                      href={`https://twitter.com/${profile.contact.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-blue-500 text-white rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                      aria-label="Twitter"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                      </svg>
                    </a>
                  )}
                  {profile.contact.facebook && (
                    <a 
                      href={`https://facebook.com/${profile.contact.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-blue-700 text-white rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                      aria-label="Facebook"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 md:mt-4 flex gap-2">
              {isOwner && (
                <button
                  onClick={() => setShowLiveModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Go Live
                </button>
              )}
              {/* Butoni Edit Profile */}
              {isOwner ? (
                <button
                  onClick={() => setEditOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition shadow-md hover:shadow-lg"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`${
                      isFollowing 
                        ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } px-6 py-2 rounded-lg font-medium transition shadow-md hover:shadow-lg disabled:opacity-50`}
                  >
                    {followLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
                  </button>
                  <button 
                    onClick={handleMessage}
                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-6 py-2 rounded-lg font-medium transition shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    <span className="hidden md:inline">Message</span>
                  </button>
                  <button 
                    onClick={() => setShowVideoCall(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition shadow-md hover:shadow-lg flex items-center gap-2"
                    title="Start Video Call"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span className="hidden md:inline">Video Call</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="max-w-6xl mx-auto mt-6 px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content - Tabs */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-8 px-6 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-4 font-medium capitalize transition whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className={activeTab === 'overview' ? '' : 'p-6'}>
            {activeTab === 'overview' && renderProfileContent()}
            
            {activeTab === 'posts' && (
              <div className="space-y-4">
                {allPosts.filter(post => post.userId === parseInt(id)).length > 0 ? (
                  allPosts.filter(post => post.userId === parseInt(id)).map((post) => (
                    <div
                      key={post.id}
                      className={`border dark:border-gray-700 rounded-lg p-4 ${post.sponsors?.length > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''}`}
                    >
                      {/* Post Content */}
                      {post.content && (
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-gray-900 dark:text-white">{post.content}</p>
                          <button
                            title="Fun emoji action"
                            className="ml-2 text-xl hover:scale-125 transition-transform"
                            onClick={() => alert('🎉 Emoji fun!')}
                          >
                            🎉
                          </button>
                        </div>
                      )}
                      
                      {/* Post Image */}
                      {post.imageUrl && (
                        <div className="mt-3 rounded-lg overflow-hidden">
                          <img 
                            src={getFullUrl(post.imageUrl)}
                            alt="Post" 
                            className="w-full h-auto object-cover"
                            loading="lazy"
                            decoding="async"
                            onDoubleClick={() => setFullScreenImage(post.imageUrl)}
                          />
                        </div>
                      )}
                      
                      {/* Post Video */}
                      {post.videoUrl && (
                        <div className="mt-3 rounded-lg overflow-hidden">
                          <video 
                            src={getFullUrl(post.videoUrl)}
                            controls 
                            preload="metadata"
                            className="w-full h-auto"
                          />
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-4 mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <button
                          onClick={() => toggleLike(post.id)}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${
                            likedPosts.has(post.id)
                              ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <span>👍</span>
                          <span>{post.likes || 0}</span>
                        </button>
                        <button
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center space-x-1 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                        >
                          <span>💬</span>
                          <span>{post.comments || 0}</span>
                        </button>
                        <span className="text-sm text-gray-500 ml-auto">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Comments Section */}
                      {expandedComments.has(post.id) && (
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                          {/* Comment Input */}
                          <div className="flex gap-2 mb-4">
                            <input
                              type="text"
                              value={commentInputs[post.id] || ''}
                              onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                              onKeyPress={(e) => e.key === 'Enter' && handleComment(post.id)}
                              placeholder="Shkruaj një koment..."
                              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleComment(post.id)}
                              disabled={!commentInputs[post.id]?.trim()}
                              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                              Dërgo
                            </button>
                          </div>

                          {/* Comments List */}
                          <div className="space-y-3">
                            {postComments[post.id]?.length > 0 ? (
                              postComments[post.id].map((comment) => (
                                <div key={comment.id} className="flex gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                  <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                      {comment.User?.firstName?.[0] || 'U'}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                        {comment.User ? `${comment.User.firstName} ${comment.User.lastName}` : 'Unknown'}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(comment.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-gray-800 dark:text-gray-200 text-sm">{comment.content}</p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
                                Nuk ka komente ende. Bëhu i pari që komenton!
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No posts yet</p>
                )}
              </div>
            )}

            {activeTab === 'gallery' && (
              <div>
                {gallery.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gallery.map((item) => (
                      <div 
                        key={item.id} 
                        className="group relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer"
                        onClick={() => item.imageUrl && setSelectedGalleryImage(item)}
                      >
                        {/* Show image only for image extensions */}
                        {item.imageUrl && item.imageUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                          <div className="aspect-video relative">
                            <img
                              src={getFullUrl(item.imageUrl)}
                              alt={item.title || 'Gallery item'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('❌ Profile Gallery - Image failed:', item.imageUrl);
                                console.error('Full item:', item);
                              }}
                              onLoad={() => console.log('✅ Profile Gallery - Image loaded:', item.imageUrl)}
                            />
                            {item.title && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                                <h4 className="text-white font-semibold">{item.title}</h4>
                                {item.description && (
                                  <p className="text-white/80 text-sm mt-1 line-clamp-2">{item.description}</p>
                                )}
                              </div>
                            )}
                            {/* Butoni Fshi - vetëm për pronarin */}
                            {isOwner && (
                              <button
                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg z-10"
                                title="Fshi këtë media"
                                onClick={(e) => handleDeleteGalleryItem(item.id, e)}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        ) : item.imageUrl && item.imageUrl.match(/\.(mp4|mov|avi|webm)$/i) ? (
                          <div className="aspect-video relative">
                            <video
                              src={getFullUrl(item.imageUrl)}
                              controls
                              className="w-full h-full object-cover"
                            />
                            {item.title && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pointer-events-none">
                                <h4 className="text-white font-semibold">{item.title}</h4>
                                {item.description && (
                                  <p className="text-white/80 text-sm mt-1 line-clamp-2">{item.description}</p>
                                )}
                              </div>
                            )}
                            {/* Butoni Fshi - vetëm për pronarin */}
                            {isOwner && (
                              <button
                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg z-10"
                                title="Fshi këtë media"
                                onClick={(e) => handleDeleteGalleryItem(item.id, e)}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        ) : item.videoUrl ? (
                          <div className="aspect-video relative">
                            <video
                              src={getFullUrl(item.videoUrl)}
                              controls
                              className="w-full h-full object-cover"
                            />
                            {item.title && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pointer-events-none">
                                <h4 className="text-white font-semibold">{item.title}</h4>
                                {item.description && (
                                  <p className="text-white/80 text-sm mt-1 line-clamp-2">{item.description}</p>
                                )}
                              </div>
                            )}
                            {/* Butoni Fshi - vetëm për pronarin */}
                            {isOwner && (
                              <button
                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg z-10"
                                title="Fshi këtë media"
                                onClick={(e) => handleDeleteGalleryItem(item.id, e)}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="aspect-video flex items-center justify-center bg-gray-200 dark:bg-gray-600">
                            <span className="text-gray-400">📁</span>
                            {/* Butoni Fshi - vetëm për pronarin */}
                            {isOwner && (
                              <button
                                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg z-10"
                                title="Fshi këtë media"
                                onClick={(e) => handleDeleteGalleryItem(item.id, e)}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Show date */}
                        <div className="p-3 border-t border-gray-200 dark:border-gray-600">
                          <span className="text-xs text-gray-500">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📸</div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">No gallery items yet</p>
                    {isOwner && (
                      <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                        Upload photos and videos from the Gallery page
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'videos' && (
              <div>
                {/* Videot e ruajtura live */}
                {profile?.liveVideos?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-2">Live Videos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {profile.liveVideos.map((video, idx) => (
                        <div key={idx} className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shadow">
                          <video src={getFullUrl(video.url)} controls poster={getFullUrl(video.thumbnail)} className="w-full h-auto" />
                          <div className="p-3">
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{video.title}</h4>
                            <span className="text-xs text-gray-500">{video.duration} min</span>
                            <span className="block text-xs text-gray-400 mt-1">{new Date(video.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Videos userId={id} onlyUserVideos />
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-6">
                {/* Transfer History */}
                {(profile.role === 'athlete' || profile.role === 'coach') && (
                  <TransferHistory userId={profile.userId || profile.id} isOwner={isOwner} />
                )}

                {profile.bio && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Bio</h3>
                    <p className="text-gray-600 dark:text-gray-400">{profile.bio}</p>
                  </div>
                )}
                
                <div>
                  <h3 className="font-semibold text-lg mb-2">Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.city && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">📍</span>
                        <span>{profile.city}{profile.country && `, ${profile.country}`}</span>
                      </div>
                    )}
                    {profile.position && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">⚽</span>
                        <span>{profile.position}</span>
                      </div>
                    )}
                    {profile.club && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">🏆</span>
                        {profile.clubLogo ? (
                          <img
                            src={getFullUrl(profile.clubLogo)}
                            alt={profile.club}
                            className="w-6 h-6 rounded-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                        <span>{profile.club}</span>
                      </div>
                    )}
                    {profile.stats?.preferredFoot && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">🦶</span>
                        <span>Preferred Foot: {profile.stats.preferredFoot}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {profile.stats?.height && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-blue-600">{profile.stats.height} cm</div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">Height</div>
                  </div>
                )}
                {profile.stats?.weight && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-green-600">{profile.stats.weight} kg</div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">Weight</div>
                  </div>
                )}
                {profile.stats?.jerseyNumber && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                    <div className="text-3xl font-bold text-purple-600">#{profile.stats.jerseyNumber}</div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">Jersey Number</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="space-y-4">
                {(profile.User?.email || profile.email) && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📧</span>
                    <span>{profile.User?.email || profile.email}</span>
                  </div>
                )}
                {profile.contact?.phone && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <span>{profile.contact.phone}</span>
                  </div>
                )}
                {profile.contact?.instagram && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📷</span>
                    <a href={`https://instagram.com/${profile.contact.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {profile.contact.instagram}
                    </a>
                  </div>
                )}
                {profile.contact?.twitter && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🐦</span>
                    <a href={`https://twitter.com/${profile.contact.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {profile.contact.twitter}
                    </a>
                  </div>
                )}
                {profile.contact?.facebook && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👤</span>
                    <a href={profile.contact.facebook.startsWith('http') ? profile.contact.facebook : `https://facebook.com/${profile.contact.facebook}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Facebook Profile
                    </a>
                  </div>
                )}
                {!profile.User?.email && !profile.email && !profile.contact?.phone && !profile.contact?.instagram && !profile.contact?.twitter && !profile.contact?.facebook && (
                  <p className="text-center text-gray-500 py-8">No contact information available</p>
                )}
              </div>
            )}

            {activeTab === 'sponsors' && isOwner && (
              <div className="space-y-4">
                {sponsorLoading ? (
                  <p className="text-gray-500 dark:text-gray-400">Duke ngarkuar sponsorët...</p>
                ) : sponsorList.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">Nuk ke sponsorë ende.</p>
                ) : (
                  sponsorList.map((sponsor) => (
                    <div key={sponsor.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                        {sponsor.image ? (
                          <img
                            src={getFullUrl(sponsor.image)}
                            alt={sponsor.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="text-2xl">🎯</span>
                        )}
                      </div>

                      <div className="flex-1">
                        {editingSponsorId === sponsor.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingSponsor.name}
                              onChange={(e) => setEditingSponsor({ ...editingSponsor, name: e.target.value })}
                              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="Emri i firmës"
                            />
                            <input
                              type="url"
                              value={editingSponsor.link}
                              onChange={(e) => setEditingSponsor({ ...editingSponsor, link: e.target.value })}
                              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="Linku"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{sponsor.name}</div>
                            {sponsor.link && (
                              <a
                                href={sponsor.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                {sponsor.link}
                              </a>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {sponsor.startDate ? `Start: ${new Date(sponsor.startDate).toLocaleDateString()}` : ''}
                              {sponsor.endDate ? ` • End: ${new Date(sponsor.endDate).toLocaleDateString()}` : ''}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {editingSponsorId === sponsor.id ? (
                          <>
                            <button
                              onClick={handleSaveSponsor}
                              className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700"
                            >
                              Ruaj
                            </button>
                            <button
                              onClick={handleCancelEditSponsor}
                              className="px-3 py-1 rounded bg-gray-200 text-gray-900 text-sm hover:bg-gray-300"
                            >
                              Anulo
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditSponsor(sponsor)}
                              className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                            >
                              Ndrysho
                            </button>
                            <button
                              onClick={() => handleDeleteSponsor(sponsor.id)}
                              className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                            >
                              Fshi
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gallery Image Modal */}
      {selectedGalleryImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedGalleryImage(null)}
        >
          <div className="relative max-w-6xl max-h-screen" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedGalleryImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition z-10"
            >
              ✕
            </button>
            <img
              src={getFullUrl(selectedGalleryImage.imageUrl)}
              alt={selectedGalleryImage.title}
              className="max-w-full max-h-screen object-contain rounded-lg"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6 rounded-b-lg">
              {selectedGalleryImage.title && (
                <h3 className="text-xl font-bold text-white mb-2">{selectedGalleryImage.title}</h3>
              )}
              {selectedGalleryImage.description && (
                <p className="text-white/90 mb-4">{selectedGalleryImage.description}</p>
              )}
              
              {/* Action Buttons - Only show for owner */}
              {isOwner && (
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => setAsProfilePhoto(selectedGalleryImage.imageUrl, 'profile')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
                  >
                    📷 Set as Profile Photo
                  </button>
                  <button
                    onClick={() => setAsProfilePhoto(selectedGalleryImage.imageUrl, 'cover')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition"
                  >
                    🖼️ Set as Cover Photo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editOpen && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl"
              onClick={() => setEditOpen(false)}
              aria-label="Mbyll"
            >
              &times;
            </button>
            <EditProfile
              user={profile}
              onClose={() => setEditOpen(false)}
            />
          </div>
        </div>
      )}

      {showVideoCall && profile && (
        <VideoCallSimple
          targetUser={{
            id: profile.id,
            firstName: profile.firstName,
            lastName: profile.lastName,
            profilePhoto: profile.profilePhoto
          }}
          onClose={() => setShowVideoCall(false)}
        />
      )}

      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} alt="Full Screen" className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl" />
          <button
            className="absolute top-6 right-8 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-4 py-2"
            onClick={() => setFullScreenImage(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Modal për live stream */}
      {isOwner && showLiveModal && (
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
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium mt-2">Start Live</button>
              <button type="button" onClick={() => setShowLiveModal(false)} className="ml-2 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-medium mt-2">Cancel</button>
            </form>

            {liveStreamId ? (
              <>
                {/* Share Link */}
                <button
                  onClick={() => {
                    const link = getLiveStreamShareLink(liveStreamId);
                    navigator.clipboard.writeText(link);
                    alert('Linku u kopjua!');
                  }}
                  style={{ marginTop: '10px', padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }}
                >
                  Kopjo Linkun e Stream-it
                </button>

                {/* Chat Live */}
                <LiveStreamChat streamId={liveStreamId} userId={userId} />

                {/* Reactions/Emoji */}
                <LiveStreamReactions streamId={liveStreamId} userId={userId} />

                {/* Invite Guests */}
                <LiveStreamGuests streamId={liveStreamId} userId={userId} />
              </>
            ) : null}
          </div>
        </div>
      )}

        </div>
        </div>

      </div>
  );
}
export default Profile;