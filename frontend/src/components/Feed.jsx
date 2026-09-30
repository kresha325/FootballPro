import { useState, useEffect, useRef, useMemo } from 'react';
import ListSearchBar from './ListSearchBar';
import { filterBySearch } from '../utils/listSearch';
import { postsAPI, sponsorAPI, profileAPI } from '../services/api';
// import streamsAPI from '../services/streamsAPI';
import { useAuth } from '../contexts/AuthContext';
import { usePosts } from '../contexts/PostsContext';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FacebookShareButton, TwitterShareButton, WhatsappShareButton, FacebookIcon, TwitterIcon, WhatsappIcon } from 'react-share';

import AdSlider from './AdSlider';
import SponsorBanner from './SponsorBanner.jsx';
import UserCardsSection from './UserCardsSection';
import FeedLiveNow from './FeedLiveNow';
import FeedScoutingReport from './FeedScoutingReport';
import AiSuggestCaptionButton from './ai/AiSuggestCaptionButton';
import StadiumStrip from './StadiumStrip';
import VerifiedBadge from './VerifiedBadge';
import PersonName from './PersonName';
import { API, matchesAPI } from '../services/api';
import { ArrowRightIcon, ChartBarIcon, MagnifyingGlassIcon, PlusIcon, TrophyIcon, UserGroupIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

const Feed = () => {
  const { user } = useAuth();
  const apiRoot = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api','')
    : '';
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

  // Convert Cloudinary-hosted images to browser-friendly formats automatically
  // e.g. change
  // https://res.cloudinary.com/xxx/image/upload/v123/.../file.heic
  // to
  // https://res.cloudinary.com/xxx/image/upload/f_auto,q_auto/v123/.../file.heic
  const getCloudinarySafeUrl = (url) => {
    if (!url) return '';
    try {
      if (url.includes('res.cloudinary.com') && url.includes('/image/upload/')) {
        return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
      }
    } catch {
      // fall through
    }
    return url;
  };
  const navigate = useNavigate();
  const { 
    allPosts, 
    likedPosts, 
    postComments, 
    loading: postsLoading,
    error: postsError,
    fetchPosts, 
    toggleLike, 
    fetchComments, 
    addComment,
    // addPost // removed unused variable
  } = usePosts();
  
  const [searchParams] = useSearchParams();
  // const [streams, setStreams] = useState([]);
  // const [streamsLoading, setStreamsLoading] = useState(true);
  const highlightedPostId = searchParams.get('post');
  const postRefs = useRef({});
  
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [sharingPost, setSharingPost] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [location, setLocation] = useState('');
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [commentInputs, setCommentInputs] = useState({});
  const [deletingPost, setDeletingPost] = useState(null);
  const [deletingComment, setDeletingComment] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editFile, setEditFile] = useState(null);
  const [editFilePreview, setEditFilePreview] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [feedSearch, setFeedSearch] = useState('');
  // feed filter is controlled from Navbar (reads/writes localStorage)

  // Sponsor state per post
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [activeSponsorPost, setActiveSponsorPost] = useState(null);
  // sponsorData: { [userId]: [sponsor, ...] } (DEPRECATED, now use post.sponsors)
  const [sponsorData] = useState({}); // removed unused setSponsorData
  //useEffect(() => { ... });
  const [tempSponsor, setTempSponsor] = useState({ name: '', link: '', image: null, imagePreview: null });

  const handleSponsorImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setTempSponsor(prev => ({ ...prev, image: file, imagePreview: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const openSponsorModal = (postId) => {
    setActiveSponsorPost(postId);
    setShowSponsorModal(true);
    // Prefill if exists
    if (sponsorData[postId]) {
      setTempSponsor({ ...sponsorData[postId] });
    } else {
      setTempSponsor({ name: '', link: '', image: null, imagePreview: null });
    }
  };

  const closeSponsorModal = () => {
    setShowSponsorModal(false);
    setActiveSponsorPost(null);
    setTempSponsor({ name: '', link: '', image: null, imagePreview: null });
  };

  // Trending tournaments (sidebar)
  const [trending, setTrending] = useState([]);
  const [trendingError, setTrendingError] = useState(false);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [matchesError, setMatchesError] = useState(false);
  const [performanceSummary, setPerformanceSummary] = useState(null);
  const [performanceError, setPerformanceError] = useState(false);
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await API.get('/tournaments/trending?status=open');
        setTrending(res.data || []);
      } catch (err) {
        setTrendingError(true);
        console.error('Error fetching trending tournaments:', err);
      }
    };
    fetchTrending();
  }, []);

  useEffect(() => {
    let cancelled = false;
    matchesAPI.getMatches()
      .then((res) => {
        if (cancelled) return;
        const now = Date.now();
        const upcoming = (Array.isArray(res.data) ? res.data : [])
          .filter((match) => !['finished', 'ongoing'].includes(match.status) && new Date(match.matchDate).getTime() >= now)
          .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
        setUpcomingMatches(upcoming);
      })
      .catch(() => { if (!cancelled) setMatchesError(true); });
    return () => { cancelled = true; };
  }, []);

  // My tournaments (sidebar): tournaments where user is creator or participant
  const [myTournaments, setMyTournaments] = useState([]);
  useEffect(() => {
    if (!user) return;
    const fetchMine = async () => {
      try {
        const res = await API.get('/tournaments');
        const list = (res.data || []).filter(t => {
          const isCreator = t.creatorId === user.id;
          const isParticipant = (t.participants || []).some(p => p.id === user.id);
          return isCreator || isParticipant;
        });
        setMyTournaments(list.slice(0, 6));
      } catch (err) {
        console.error('Error fetching my tournaments:', err);
      }
    };
    fetchMine();
  }, [user]);

  const saveSponsorData = async () => {
    if (!activeSponsorPost || !user) return;
    // Always use the logged-in user's id for sponsor creation
    const userId = user.id;
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('name', tempSponsor.name);
    formData.append('link', tempSponsor.link);
    // Dates + 1y Premium are set automatically by the API
    if (tempSponsor.image instanceof File) {
      formData.append('image', tempSponsor.image);
    }
    try {
      await sponsorAPI.createSponsor(formData);
      // Fetch updated sponsors for the post
      await sponsorAPI.getSponsorsByPost(activeSponsorPost);
      // const sponsors = res.data.map(s => ({
      //   name: s.name,
      //   link: s.link,
      //   image: s.image,
      //   imagePreview: s.image,
      //   id: s.id,
      //   startDate: s.startDate,
      //   endDate: s.endDate
      // }));
      // Update the post's sponsors in allPosts
      // setAllPosts is not defined or used elsewhere, so this is removed
    } catch {
      // handle error
    }
    closeSponsorModal();
  };
  useEffect(() => {
    const initialFollowedOnly = (() => { try { return localStorage.getItem('feed_followed_only') === 'true'; } catch { return false; }})();
    fetchPosts({ followedOnly: initialFollowedOnly });
  }, [fetchPosts]);

  // Note: feed filter UI moved to Navbar; Navbar updates localStorage and calls fetchPosts.

  // Scroll to highlighted post
  useEffect(() => {
    console.log('useEffect triggered:', { highlightedPostId, postsLength: allPosts.length });
    
    if (highlightedPostId && allPosts.length > 0) {
      // Open comments for highlighted post
      const postIdNum = parseInt(highlightedPostId);
      console.log('Setting expanded comments for post:', postIdNum);
      
      setExpandedComments(prev => {
        const newSet = new Set(prev);
        newSet.add(postIdNum);
        return newSet;
      });
      
      // Scroll to post after a delay to ensure rendering
      setTimeout(() => {
        const postElement = postRefs.current[highlightedPostId];
        console.log('Scrolling to post element:', postElement);
        
        if (postElement) {
          postElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }, 800);
    }
  }, [highlightedPostId, allPosts]);

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Je i sigurt që do ta fshish këtë postim?')) return;
    
    setDeletingPost(postId);
    try {
      await postsAPI.deletePost(postId);
      const followedOnly = (() => { try { return localStorage.getItem('feed_followed_only') === 'true'; } catch { return false; }})();
      await fetchPosts({ followedOnly });
      alert('Postimi u fshi!');
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Nuk u fshi postimi');
    } finally {
      setDeletingPost(null);
    }
  };

  const openEditPost = (post) => {
    setEditingPost(post);
    setEditContent(post.content || '');
    setEditLocation(post.location || '');
    setEditFile(null);
    setEditFilePreview(post.imageUrl || post.videoUrl || null);
  };

  const closeEditPost = () => {
    setEditingPost(null);
    setEditContent('');
    setEditLocation('');
    setEditFile(null);
    setEditFilePreview(null);
  };

  const handleEditFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = String(file.type || '').startsWith('video/');
    const maxBytes = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(isVideo ? 'Videoja është shumë e madhe (max 100MB).' : 'Fotoja është shumë e madhe (max 10MB).');
      e.target.value = '';
      return;
    }
    setEditFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setEditFilePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSaveEditPost = async (e) => {
    e.preventDefault();
    if (!editingPost) return;
    if (!editContent.trim() && !editFile && !editFilePreview) {
      alert('Postimi duhet të ketë tekst ose media.');
      return;
    }
    setSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append('content', editContent);
      formData.append('location', editLocation.trim());
      if (editFile) {
        if (String(editFile.type || '').startsWith('video/')) {
          formData.append('video', editFile);
        } else {
          formData.append('image', editFile);
        }
      }
      await postsAPI.updatePost(editingPost.id, formData);
      closeEditPost();
      const followedOnly = (() => { try { return localStorage.getItem('feed_followed_only') === 'true'; } catch { return false; }})();
      await fetchPosts({ followedOnly });
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Nuk u përditësua postimi');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId, postId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    setDeletingComment(commentId);
    try {
      await postsAPI.deleteComment(commentId);
      await fetchComments(postId); // Refresh comments
      alert('Comment deleted successfully!');
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    } finally {
      setDeletingComment(null);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const isVideo = String(file.type || '').startsWith('video/');
      const maxBytes = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxBytes) {
        alert(
          isVideo
            ? 'Videoja është shumë e madhe. Maksimumi është 100MB.'
            : 'Fotoja është shumë e madhe. Maksimumi është 10MB.'
        );
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !selectedFile) return;

    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('content', newPost);
      if (selectedFile) {
        if (String(selectedFile.type || '').startsWith('video/')) {
          formData.append('video', selectedFile);
        } else {
          formData.append('image', selectedFile);
        }
      }
      if (location.trim()) {
        formData.append('location', location.trim());
      }
      await postsAPI.createPost(formData);
      setNewPost('');
      setSelectedFile(null);
      setFilePreview(null);
      setLocation('');
      setShowLocationInput(false);
      const followedOnly = (() => { try { return localStorage.getItem('feed_followed_only') === 'true'; } catch { return false; }})();
      await fetchPosts({ followedOnly }); // Refresh to get new post with counts (respect current filter)
    } catch (error) {
      console.error('Error creating post:', error);
      const status = error?.response?.status;
      const msg = error?.response?.data?.msg || error?.response?.data?.error;
      if (status === 413) {
        alert(msg || 'Skedari është shumë i madh. Foto max 10MB, video max 100MB.');
      } else {
        alert(msg || 'Dështoi publikimi i postimit. Provo përsëri.');
      }
    } finally {
      setPosting(false);
    }
  };

  const toggleComments = (postId) => {
    const expanded = new Set(expandedComments);
    if (expanded.has(postId)) {
      expanded.delete(postId);
    } else {
      expanded.add(postId);
      // Fetch comments if not already loaded
      if (!postComments[postId]) {
        fetchComments(postId);
      }
    }
    setExpandedComments(expanded);
  };

  const handleComment = async (postId) => {
    const content = commentInputs[postId];
    if (!content?.trim()) return;
    
    await addComment(postId, content);
    setCommentInputs({ ...commentInputs, [postId]: '' });
  };

  const displayPosts = useMemo(
    () =>
      filterBySearch(allPosts, feedSearch, (post) => [
        post.content,
        post.location,
        post.author?.firstName,
        post.author?.lastName,
        post.User?.firstName,
        post.User?.lastName,
      ]),
    [allPosts, feedSearch]
  );

  const role = String(user?.role || '').toLowerCase();
  useEffect(() => {
    if (!user?.id || !['athlete', 'player', 'coach'].includes(role)) return undefined;
    let cancelled = false;
    profileAPI.getProfileTournamentSummary(user.id)
      .then((res) => { if (!cancelled) setPerformanceSummary(res?.data?.totals || null); })
      .catch(() => { if (!cancelled) setPerformanceError(true); });
    return () => { cancelled = true; };
  }, [user?.id, role]);

  const roleName = ({ athlete: 'Player', player: 'Player', scout: 'Scout', club: 'Club', coach: 'Coach', manager: 'Manager', admin: 'Admin', federation: 'Federation' })[role] || 'Member';
  const quickActions = ['scout', 'manager', 'federation'].includes(role)
    ? [{ label: 'Discover talent', to: '/profiles', icon: <UserGroupIcon className="h-4 w-4" /> }, { label: 'Scouting workspace', to: '/scouting', icon: <MagnifyingGlassIcon className="h-4 w-4" /> }, { label: 'Messages', to: '/messaging', icon: <VideoCameraIcon className="h-4 w-4" /> }]
    : role === 'club'
      ? [{ label: 'Club roster', to: '/club-roster', icon: <UserGroupIcon className="h-4 w-4" /> }, { label: 'Recruit players', to: '/profiles', icon: <MagnifyingGlassIcon className="h-4 w-4" /> }, { label: 'Matches', to: '/matches', icon: <TrophyIcon className="h-4 w-4" /> }]
      : role === 'coach'
        ? [{ label: 'Team players', to: '/profiles', icon: <UserGroupIcon className="h-4 w-4" /> }, { label: 'Matches', to: '/matches', icon: <TrophyIcon className="h-4 w-4" /> }, { label: 'Performance', to: '/analytics', icon: <ChartBarIcon className="h-4 w-4" /> }]
        : role === 'admin'
          ? [{ label: 'Admin dashboard', to: '/admin', icon: <ChartBarIcon className="h-4 w-4" /> }, { label: 'Profiles', to: '/profiles', icon: <UserGroupIcon className="h-4 w-4" /> }, { label: 'Tournaments', to: '/tournaments', icon: <TrophyIcon className="h-4 w-4" /> }]
          : [{ label: 'Complete your profile', to: `/profile/${user?.id}`, icon: <UserGroupIcon className="h-4 w-4" /> }, { label: 'Explore opportunities', to: '/tournaments', icon: <TrophyIcon className="h-4 w-4" /> }, { label: 'Watch highlights', to: '/videos', icon: <VideoCameraIcon className="h-4 w-4" /> }];

  if (postsLoading) {
    return <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_19rem]" aria-label="Duke ngarkuar dashboard-in">
      <div className="space-y-4"><div className="xt-skeleton h-44 rounded-2xl" /><div className="xt-skeleton h-24 rounded-2xl" /><div className="xt-skeleton h-72 rounded-2xl" /><div className="xt-skeleton h-48 rounded-2xl" /></div>
      <div className="hidden space-y-4 lg:block"><div className="xt-skeleton h-48 rounded-2xl" /><div className="xt-skeleton h-52 rounded-2xl" /><div className="xt-skeleton h-40 rounded-2xl" /></div>
    </div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:py-7">

      <header className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_top_right,rgba(217,164,65,.14),transparent_45%),linear-gradient(145deg,#121c2a,#0b111a)] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[var(--xt-color-gold-bright)]">{roleName} dashboard · X TALENTI</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Mirë se erdhe, {user?.firstName || roleName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">Shiko aktivitetin e fundit, zbulo talentin që po kërkon dhe vazhdo hapin tënd të radhës në futboll.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.slice(0, 2).map(({ label, to, icon }) => <Link key={to} to={to} className="btn btn-quiet min-h-11 text-sm">{icon}{label}</Link>)}
            <button type="button" onClick={() => document.getElementById('new-post')?.focus()} className="btn btn-primary min-h-11 text-sm"><PlusIcon className="h-4 w-4" />Ndaj përditësim</button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {quickActions.map(({ label, to }) => <Link key={to} to={to} className="xt-badge hover:border-[var(--xt-color-gold)] hover:text-white">{label}<ArrowRightIcon className="h-3 w-3" /></Link>)}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Përmbledhje e aktivitetit">
        <div className="xt-stat-card flex items-center justify-between gap-3 bg-white dark:bg-[#121c2a]">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Përditësime në feed</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{displayPosts.length}</p>
          </div>
          <ChartBarIcon className="h-5 w-5 text-[var(--xt-color-gold)]" />
        </div>
        <div className="xt-stat-card flex items-center justify-between gap-3 bg-white dark:bg-[#121c2a]">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ndeshje të ardhshme</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{matchesError ? '—' : upcomingMatches.length}</p>
          </div>
          <TrophyIcon className="h-5 w-5 text-[var(--xt-color-gold)]" />
        </div>
        <div className="xt-stat-card flex items-center justify-between gap-3 bg-white dark:bg-[#121c2a]">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Turne të listuara</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{trendingError ? '—' : trending.length}</p>
          </div>
          <UserGroupIcon className="h-5 w-5 text-[var(--xt-color-gold)]" />
        </div>
      </section>

      {['athlete', 'player', 'coach'].includes(role) && <section className="xt-card mb-6 bg-white p-4 dark:bg-[#0d1420] sm:p-5" aria-labelledby="performance-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold)]">Your progress</p><h2 id="performance-title" className="mt-1 text-lg text-slate-900 dark:text-white">Përmbledhje e performancës</h2></div><Link to={`/profile/${user?.id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--xt-color-gold-bright)]">Profili im <ArrowRightIcon className="h-4 w-4" /></Link></div>
        {performanceError ? <p className="text-sm text-slate-500 dark:text-slate-400">Statistikat nuk mund të ngarkoheshin.</p> : !performanceSummary ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Duke ngarkuar statistikat">{Array.from({ length: 4 }, (_, index) => <div key={index} className="xt-skeleton h-16 rounded-xl" />)}</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Gola', performanceSummary.scorerGoals], ['Asistime', performanceSummary.scorerAssists], ['Pikë', performanceSummary.points], ['Turne', performanceSummary.tournamentsPlayed]].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#121c2a]">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{Number(value) || 0}</p>
            </div>
          ))}
        </div>}
      </section>}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* Main Feed Content */}
        <div className="min-w-0 space-y-5">

      {/* Feed Toggle moved to Navbar */}

      {/* Player Cards Section */}
      <section aria-labelledby="featured-talents-title">
        <div className="xt-section-header mb-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold)]">Discover</p><h2 id="featured-talents-title" className="mt-1 text-lg text-[var(--xt-color-text)]">Talente të veçuara</h2></div>
          <Link to="/profiles" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--xt-color-gold-bright)]">Të gjithë <ArrowRightIcon className="h-4 w-4" /></Link>
        </div>
        <UserCardsSection />
      </section>

      <section aria-labelledby="featured-clubs-title">
        <div className="xt-section-header mb-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold)]">Club network</p><h2 id="featured-clubs-title" className="mt-1 text-lg text-[var(--xt-color-text)]">Klube të veçuara</h2></div>
          <Link to="/profiles" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--xt-color-gold-bright)]">Zbulo klube <ArrowRightIcon className="h-4 w-4" /></Link>
        </div>
        <UserCardsSection role="club" />
      </section>

      {['federation', 'scout', 'manager'].includes(String(user?.role || '').toLowerCase()) ? (
        <FeedScoutingReport />
      ) : null}

      <FeedLiveNow />

      <section aria-labelledby="activity-title">
      <div className="xt-section-header mb-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold)]">Community</p><h2 id="activity-title" className="mt-1 text-lg text-[var(--xt-color-text)]">Aktiviteti i fundit</h2></div>
        <span className="xt-badge">{displayPosts.length} përditësime</span>
      </div>
      <ListSearchBar
        value={feedSearch}
        onChange={setFeedSearch}
        placeholder="Kërko postime në feed…"
      />
      {postsError && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--xt-color-danger)]/35 bg-[var(--xt-color-danger)]/5 p-4 text-sm" role="alert"><span>{postsError}</span><button type="button" onClick={() => {
        const followedOnly = (() => { try { return localStorage.getItem('feed_followed_only') === 'true'; } catch { return false; } })();
        fetchPosts({ followedOnly });
      }} className="btn btn-quiet min-h-10 text-xs">Provo përsëri</button></div>}

      {/* Create Post Form (flat background, no grid overlay) */}
      <div className="xt-card mb-5 p-4 sm:p-5">
        <div className="relative">
        <form onSubmit={handleCreatePost}>
          <label htmlFor="new-post" className="sr-only">Çfarë po mendon?</label>
          <div className="relative mx-auto max-w-3xl">
              <textarea
                id="new-post"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Shkruaj postimin tënd..."
                className="input min-h-24 resize-y rounded-xl p-4 text-sm"
                rows="3"
                style={{ minHeight: 96 }}
              />
          </div>
          
          {/* File Preview */}
          {filePreview && (
            <div className="mt-3 relative">
              {selectedFile && String(selectedFile.type || '').startsWith('video/') ? (
                <video src={filePreview} controls className="max-h-64 rounded-lg w-full bg-black" />
              ) : (
                <img src={filePreview} alt="Preview" className="max-h-64 rounded-lg" />
              )}
              <button
                type="button"
                onClick={removeFile}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
              >
                ✕
              </button>
    </div>
          )}
          
          {/* Action Buttons */}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <AiSuggestCaptionButton
                hints={{
                  topic: newPost.trim().slice(0, 80) || 'futboll',
                  hasMedia: Boolean(selectedFile),
                  location: location.trim() || undefined,
                  role: user?.role,
                }}
                onCaption={(caption) => setNewPost((prev) => (prev.trim() ? `${prev.trim()} ${caption}` : caption))}
              />
              {/* Photo/Video Upload */}
              <label className="btn btn-quiet min-h-11 cursor-pointer text-sm">
                <VideoCameraIcon className="h-4 w-4 text-[var(--xt-color-gold)]" />
                Foto ose video
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
              </label>
              
              {/* Emoji Picker (custom, football only) */}
              <div className="relative inline-block">
                <button
                  type="button"
                  className="btn btn-quiet min-h-11"
                  title="Add emoji"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                >
                  <span className="text-sm">Emoji</span>
                </button>
                {showEmojiPicker && (
                  <div className="absolute z-50 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2 flex flex-wrap gap-2 w-64">
                    {['⚽','🥅','🥇','🏆','🏟️','👟','🧤','🎽','🚩','🟩'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="text-2xl hover:scale-125 transition-transform"
                        onClick={() => {
                          setNewPost(newPost + emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Location */}
              <button
                type="button"
                className="btn btn-quiet min-h-11"
                title="Add location"
                onClick={() => setShowLocationInput((prev) => !prev)}
              >
                <span className="text-sm">Vendndodhje</span>
              </button>
              {showLocationInput && (
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Vendndodhja (p.sh. Prishtinë, Stadiumi X...)"
                  className="input min-w-[180px]"
                />
              )}
            </div>
            
            <button
              type="submit"
              disabled={posting || (!newPost.trim() && !selectedFile)}
              className="btn btn-primary w-full sm:w-auto"
              aria-describedby="post-button-desc"
            >
              {posting ? 'Duke postuar...' : 'Posto'}
            </button>
          </div>
          <div id="post-button-desc" className="sr-only">Publiko postimin për ta ndarë me të tjerët</div>
        </form>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {!displayPosts.length && <div className="xt-empty-state xt-card"><div className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[var(--xt-color-gold)]"><MagnifyingGlassIcon className="h-6 w-6" /></div><h3 className="text-base text-[var(--xt-color-text)]">Nuk ka përditësime për këtë kërkim</h3><p className="max-w-sm text-sm">Provo një fjalë tjetër ose ndiq profile që feed-i yt të bëhet më relevant.</p><Link to="/profiles" className="btn btn-outline">Zbulo talente</Link></div>}
        {displayPosts.map((post, index) => (
          <div 
            key={post.id}
            ref={(el) => postRefs.current[post.id] = el}
            className={
              [
                highlightedPostId === String(post.id) ? 'animate-pulse-once' : ''
              ].join(' ')
            }
          >
            {/* Post Content */}
              {/* Post Content */}
              <article className={`xt-card flex-1 p-4 transition-colors sm:p-5 ${post.sponsors?.length > 0 ? 'border-[var(--xt-color-gold)]/40 bg-[var(--xt-color-surface-raised)]' : ''} ${highlightedPostId === String(post.id) ? 'ring-2 ring-[var(--xt-color-gold)]' : ''}`}>
                {post.sponsors?.length > 0 && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="xt-badge xt-badge-gold">Sponsored</span>
                  </div>
                )}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div 
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity" 
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/profile/${post.userId}`);
                    }}
                    style={{ touchAction: 'manipulation' }}
                  >
                    {(post.author?.profilePhoto || (user && post.userId === user.id && user.profilePhoto)) ? (
                      <img
                        src={
                          post.author?.profilePhoto
                            ? getCloudinarySafeUrl(getFullUrl(post.author.profilePhoto))
                            : getCloudinarySafeUrl(getFullUrl(user.profilePhoto))
                        }
                        alt={post.author?.firstName || user?.firstName || 'User'}
                        className="h-10 w-10 rounded-full border border-white/15 object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="xt-avatar h-10 w-10">
                        {`${post.author?.firstName?.charAt(0).toUpperCase() || user?.firstName?.charAt(0).toUpperCase() || 'U'}${post.author?.lastName?.charAt(0).toUpperCase() || user?.lastName?.charAt(0).toUpperCase() || ''}`}
                      </div>
                    )}
                    <div className="ml-3 min-w-0">
                      <p className="inline-flex items-center gap-1 font-semibold text-[var(--xt-color-text)] hover:underline">
                        <PersonName>
                          {post.author?.firstName && post.author?.lastName
                            ? `${post.author.firstName} ${post.author.lastName}`
                            : 'I panjohur'}
                        </PersonName>
                        <VerifiedBadge verified={post.author?.verified} size="sm" />
                      </p>
                      <p className="text-xs text-[var(--xt-color-text-subtle)]">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {/* Sponsor Banner inline with user info */}
                  {post.sponsors?.length > 0 && (
                    <div className="ml-4">
                      <SponsorBanner sponsors={post.sponsors} compact />
                    </div>
                  )}
                </div>
                {user && post.userId === user.id && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openSponsorModal(post.id)}
                      className="btn btn-quiet min-h-10 px-3 text-xs"
                      title="Sponsorizo këtë post"
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditPost(post)}
                      className="grid h-10 w-10 place-items-center rounded-lg text-[var(--xt-color-text-muted)] hover:bg-white/5 hover:text-white"
                      title="Ndrysho postimin"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletingPost === post.id}
                      className="grid h-10 w-10 place-items-center rounded-lg text-[var(--xt-color-danger)] hover:bg-white/5 disabled:opacity-50"
                      title="Fshi postimin"
                    >
                      {deletingPost === post.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                )}
                    {/* Sponsor Modal */}
                    {showSponsorModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
                          <button
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl"
                            onClick={closeSponsorModal}
                            aria-label="Mbyll"
                          >
                            &times;
                          </button>
                          <h2 className="text-xl font-bold mb-4 text-orange-600">Shto Sponsor për Postin</h2>
                          <form
                            onSubmit={e => {
                              e.preventDefault();
                              saveSponsorData();
                              closeSponsorModal();
                            }}
                            className="space-y-4"
                          >
                            <div>
                              <label className="block text-sm font-medium mb-1">Emri i Firmës</label>
                              <input
                                type="text"
                                className="w-full border rounded px-3 py-2"
                                value={tempSponsor.name}
                                onChange={e => setTempSponsor({ ...tempSponsor, name: e.target.value })}
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Linku</label>
                              <input
                                type="url"
                                className="w-full border rounded px-3 py-2"
                                value={tempSponsor.link}
                                onChange={e => setTempSponsor({ ...tempSponsor, link: e.target.value })}
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Logo/Fotografia</label>
                              <input
                                type="file"
                                accept="image/*"
                                className="w-full"
                                onChange={handleSponsorImage}
                              />
                              {tempSponsor.imagePreview && (
                                <img src={tempSponsor.imagePreview} alt="Preview" className="mt-2 h-16 object-contain rounded border" />
                              )}
                            </div>
                            <button
                              type="submit"
                              className="w-full bg-orange-600 text-white py-2 rounded font-semibold hover:bg-orange-700 transition"
                            >
                              Ruaj Sponsorin
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
              </div>
              <p className="mb-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--xt-color-text)]">{post.content}</p>
              {post.location && (
                <div className="flex items-center text-blue-600 dark:text-blue-400 mb-2 gap-1">
                  <span className="text-lg">📍</span>
                  {post.locationLat && post.locationLng ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${post.locationLat},${post.locationLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium underline hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      {post.location}
                    </a>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium underline hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      {post.location}
                    </a>
                  )}
                </div>
              )}
              {post.imageUrl && !post.imageUrl.match(/\.(mp4|mov|avi|webm)$/i) && (
                <img 
                  src={getCloudinarySafeUrl(getFullUrl(post.imageUrl))}
                  alt="Post content" 
                  className="w-full h-auto max-h-[min(80vh,48rem)] rounded-lg mb-4 object-contain bg-slate-100 dark:bg-slate-800/60"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    console.error('Post image failed to load:', post.imageUrl);
                    e.target.style.display = 'none';
                  }}
                />
              )}
              {(post.videoUrl || (post.imageUrl && post.imageUrl.match(/\.(mp4|mov|avi|webm)$/i))) && (
                <video 
                  src={getCloudinarySafeUrl(getFullUrl(post.videoUrl || post.imageUrl))}
                  controls 
                  preload="metadata"
                  className="w-full h-auto max-h-[min(80vh,48rem)] rounded-lg mb-4 object-contain bg-black"
                  onError={(e) => {
                    console.error('Post video failed to load:', post.videoUrl || post.imageUrl);
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                  <div className="relative inline-block">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
                        likedPosts.has(post.id) ? 'border-rose-400/30 bg-rose-500/10 text-rose-300' : 'border-white/10 bg-white/[.03] text-[var(--xt-color-text-muted)] hover:bg-white/[.07]'
                      }`}
                      aria-label={likedPosts.has(post.id) ? `Hiq pëlqimin për postimin e ${post.author?.username || 'I panjohur'}` : `Pëlqe postimin e ${post.author?.username || 'I panjohur'}`}
                      onContextMenu={e => { e.preventDefault(); setShowEmojiPicker(post.id); }}
                    >
                      <span>{post.emoji || '👍'}</span>
                      <span>{post.likes || 0}</span>
                    </button>
                    {showEmojiPicker === post.id && (
                      <div className="absolute z-10 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2 flex flex-wrap gap-2 w-64">
                        {['⚽','🥅','🥇','🏆','🏟️','👟','🧤','🎽','🚩','🟩'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="text-2xl hover:scale-125 transition-transform"
                            onClick={() => {
                              // You may want to update the like emoji in state or backend here
                              post.emoji = emoji;
                              setShowEmojiPicker(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[.03] px-3 text-sm text-[var(--xt-color-text-muted)] hover:bg-white/[.07]"
                    aria-label={`Komento postimin e ${post.author?.username || 'I panjohur'}`}
                  >
                    <span>💬</span>
                    <span>{post.comments || 0}</span>
                  </button>
                  <button
                    onClick={() => setSharingPost(post.id)}
                    className="flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[.03] px-3 text-sm text-[var(--xt-color-text-muted)] hover:bg-white/[.07]"
                    aria-label={`Ndaj postimin e ${post.author?.username || 'I panjohur'}`}
                    title="Ndaj"
                  >
                    <span className="text-sm">Ndaj</span>
                  </button>
                </div>
              </div>
            </article>
            
            {/* Share Modal */}
            {sharingPost === post.id && (
              <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4" role="dialog" aria-labelledby="share-dialog-title" aria-describedby="share-dialog-desc">
                <p id="share-dialog-title" className="text-sm text-gray-600 dark:text-gray-400 mb-2">Ndaje këtë postim:</p>
                <div id="share-dialog-desc" className="sr-only">Opsionet e ndarjes për postimin</div>
                <div className="flex space-x-2">
                  <FacebookShareButton url={`${window.location.origin}/post/${post.id}`} quote={post.content}>
                    <FacebookIcon size={32} round />
                  </FacebookShareButton>
                  <TwitterShareButton url={`${window.location.origin}/post/${post.id}`} title={post.content}>
                    <TwitterIcon size={32} round />
                  </TwitterShareButton>
                  <WhatsappShareButton url={`${window.location.origin}/post/${post.id}`} title={post.content}>
                    <WhatsappIcon size={32} round />
                  </WhatsappShareButton>
                </div>
                <button
                  onClick={() => setSharingPost(null)}
                  className="mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  aria-label="Mbyll opsionet e ndarjes"
                >
                  Mbyll
                </button>
              </div>
            )}

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
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 dark:text-white text-sm inline-flex items-center gap-1">
                                <PersonName>
                                  {comment.User ? `${comment.User.firstName} ${comment.User.lastName}` : 'I panjohur'}
                                </PersonName>
                                <VerifiedBadge verified={comment.User?.verified} size="sm" />
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(comment.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {user && comment.userId === user.id && (
                              <button
                                onClick={() => handleDeleteComment(comment.id, post.id)}
                                disabled={deletingComment === comment.id}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 text-xs"
                                title="Fshi komentin"
                              >
                                {deletingComment === comment.id ? '⏳' : '🗑️'}
                              </button>
                            )}
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
            {/* Ad space between posts */}
            {(index + 1) % 3 === 0 && (
              <AdSlider />
            )}
          </div>
        ))}
      </div>
      </section>

    {editingPost && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg relative p-6">
          <button
            type="button"
            className="absolute top-2 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-2xl"
            onClick={closeEditPost}
            aria-label="Mbyll"
          >
            &times;
          </button>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Ndrysho postimin</h2>
          <form onSubmit={handleSaveEditPost} className="space-y-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-3"
              placeholder="Shkruaj postimin…"
            />
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-3"
              placeholder="Lokacioni (opsionale)"
            />
            {editFilePreview && (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                {editFile && String(editFile.type || '').startsWith('video/') ? (
                  <video src={editFilePreview} controls className="w-full max-h-56 object-contain bg-black" />
                ) : String(editFilePreview).match(/\.(mp4|mov|webm)(\?|$)/i) ||
                  (editingPost?.videoUrl && !editFile) ? (
                  <video
                    src={getFullUrl(editFilePreview)}
                    controls
                    className="w-full max-h-56 object-contain bg-black"
                  />
                ) : (
                  <img
                    src={getCloudinarySafeUrl(getFullUrl(editFilePreview))}
                    alt="Preview"
                    className="w-full max-h-56 object-contain"
                  />
                )}
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer">
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleEditFileSelect} />
              Ndrysho foton / videon
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeEditPost}
                className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Anulo
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingEdit ? 'Duke ruajtur…' : 'Ruaj'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

        </div>
    <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
      <section className="xt-card p-4" aria-labelledby="matches-widget-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--xt-color-gold)]">On the pitch</p><h2 id="matches-widget-title" className="mt-1 text-base">Ndeshjet e ardhshme</h2></div>
          <Link to="/matches" aria-label="Shiko të gjitha ndeshjet" className="grid h-10 w-10 place-items-center rounded-lg text-[var(--xt-color-gold-bright)] hover:bg-white/5"><ArrowRightIcon className="h-4 w-4" /></Link>
        </div>
        {matchesError ? <p className="text-sm text-[var(--xt-color-text-muted)]">Ndeshjet nuk mund të ngarkoheshin.</p> : upcomingMatches.length ? <ul className="space-y-2">{upcomingMatches.slice(0, 4).map((match) => <li key={match.id} className="rounded-xl border border-white/10 bg-white/[.025] p-3">
          <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span className="truncate">{match.homeUser ? `${match.homeUser.firstName || ''} ${match.homeUser.lastName || ''}`.trim() : `Ekipi ${match.homeUserId}`}</span><span className="text-xs font-bold text-[var(--xt-color-gold-bright)]">VS</span><span className="truncate text-right">{match.awayUser ? `${match.awayUser.firstName || ''} ${match.awayUser.lastName || ''}`.trim() : (match.awayUserId ? `Ekipi ${match.awayUserId}` : 'TBD')}</span></div>
          <p className="mt-2 text-xs text-[var(--xt-color-text-subtle)]">{new Date(match.matchDate).toLocaleString()} {match.Tournament?.name ? `· ${match.Tournament.name}` : ''}</p>
        </li>)}</ul> : <p className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-sm text-[var(--xt-color-text-muted)]">Nuk ka ndeshje të planifikuara tani.</p>}
        <Link to="/matches" className="btn btn-quiet mt-3 w-full text-sm">Kalendari i ndeshjeve</Link>
      </section>

      <section className="xt-card p-4" aria-labelledby="tournaments-widget-title">
        <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--xt-color-gold)]">Competition</p><h2 id="tournaments-widget-title" className="mt-1 text-base">Turne aktive</h2></div><TrophyIcon className="h-5 w-5 text-[var(--xt-color-gold)]" /></div>
        {trendingError ? <p className="text-sm text-[var(--xt-color-text-muted)]" role="status">Turnetë nuk mund të ngarkoheshin.</p> : trending.length ? <ul className="space-y-2">{trending.slice(0, 4).map((t) => <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/5"><span className="min-w-0 truncate text-sm font-medium">{t.name}</span><span className="xt-badge shrink-0">{t.participants?.length || 0} lojtarë</span></li>)}</ul> : <div className="xt-empty-state px-2 py-4"><p className="text-sm">Nuk ka turne aktive për momentin.</p></div>}
        <Link to="/tournaments" className="btn btn-quiet mt-3 w-full text-sm">Shfleto turnetë</Link>
      </section>

      {myTournaments.length > 0 && <section className="xt-card p-4" aria-labelledby="my-tournaments-title"><h2 id="my-tournaments-title" className="mb-3 text-base">Turnetë e mia</h2><ul className="space-y-2">{myTournaments.slice(0, 3).map((t) => <li key={t.id}><Link to="/tournaments" className="flex min-h-10 items-center justify-between gap-2 rounded-lg px-2 text-sm text-[var(--xt-color-text-muted)] hover:bg-white/5 hover:text-white"><span className="truncate">{t.name}</span><ArrowRightIcon className="h-4 w-4 shrink-0" /></Link></li>)}</ul></section>}

      <section className="xt-card p-4" aria-labelledby="quick-actions-title"><h2 id="quick-actions-title" className="mb-3 text-base">Veprime të shpejta</h2><ul className="space-y-1">{quickActions.map(({ label, to, icon }) => <li key={to}><Link to={to} className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm text-[var(--xt-color-text-muted)] hover:bg-white/5 hover:text-[var(--xt-color-gold-bright)]">{icon}{label}</Link></li>)}</ul></section>
      <StadiumStrip />
    </aside>
  </div>
</div>
  );
};

export default Feed;
