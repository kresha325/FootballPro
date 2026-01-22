import { useState, useEffect, useRef } from 'react';
import { postsAPI, sponsorAPI } from '../services/api';
// import streamsAPI from '../services/streamsAPI';
import { useAuth } from '../contexts/AuthContext';
import { usePosts } from '../contexts/PostsContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FacebookShareButton, TwitterShareButton, WhatsappShareButton, FacebookIcon, TwitterIcon, WhatsappIcon } from 'react-share';

import AdSlider from './AdSlider';
import SponsorBanner from './SponsorBanner.jsx';
import UserCardsSection from './UserCardsSection';

const Feed = () => {
  const { user } = useAuth();
  const apiRoot = import.meta.env.VITE_API_URL.replace('/api','');
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
  const navigate = useNavigate();
  const { 
    allPosts, 
    likedPosts, 
    postComments, 
    loading: postsLoading,
    fetchPosts, 
    toggleLike, 
    fetchComments, 
    addComment,
    addPost
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

  // Sponsor state per post
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [activeSponsorPost, setActiveSponsorPost] = useState(null);
  // sponsorData: { [userId]: [sponsor, ...] } (DEPRECATED, now use post.sponsors)
  const [sponsorData, setSponsorData] = useState({});
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

  const saveSponsorData = async () => {
    if (!activeSponsorPost || !user) return;
    // Always use the logged-in user's id for sponsor creation
    const userId = user.id;
    // Set startDate now, endDate +365 days
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 365);
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('name', tempSponsor.name);
    formData.append('link', tempSponsor.link);
    formData.append('startDate', now.toISOString());
    formData.append('endDate', end.toISOString());
    if (tempSponsor.image instanceof File) {
      formData.append('image', tempSponsor.image);
    }
    try {
      await sponsorAPI.createSponsor(formData);
      // Fetch updated sponsors for the post
      const res = await sponsorAPI.getSponsorsByPost(activeSponsorPost);
      const sponsors = res.data.map(s => ({
        name: s.name,
        link: s.link,
        image: s.image,
        imagePreview: s.image,
        id: s.id,
        startDate: s.startDate,
        endDate: s.endDate
      }));
      // Update the post's sponsors in allPosts
      setAllPosts(prevPosts => prevPosts.map(post =>
        post.id === activeSponsorPost
          ? { ...post, sponsors }
          : post
      ));
    } catch (err) {
      // handle error
    }
    closeSponsorModal();
  };
  useEffect(() => {
    fetchPosts();
    // Stream/livestream fetch removed
    // Auto-refresh është hequr për performancë më të mirë
    // Useri mund të refresh manualisht nëse dëshiron
  }, [fetchPosts]);

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
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    
    setDeletingPost(postId);
    try {
      await postsAPI.deletePost(postId);
      await fetchPosts(); // Refresh posts
      alert('Post deleted successfully!');
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    } finally {
      setDeletingPost(null);
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
      if (file.size > 100000000) { // 100MB
        alert('File size must be less than 100MB');
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
        formData.append('image', selectedFile);
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
      fetchPosts(); // Refresh to get new post with counts
    } catch (error) {
      console.error('Error creating post:', error);
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

  if (postsLoading) {
    return <div className="flex justify-center items-center h-64 text-gray-600 dark:text-gray-400">Loading posts...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed Content */}
        <div className="lg:col-span-2">


      {/* Player Cards Section */}
      <UserCardsSection />

      {/* Create Post Form */}
      <div
        className="rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700"
        style={{
          backgroundImage: "linear-gradient(180deg, #101214 0%, #1f242b 55%, #0f3d1c 100%)",
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 1px, transparent 1px, transparent 16px), repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 1px, transparent 1px, transparent 16px)",
            opacity: 0.35,
            pointerEvents: 'none'
          }}
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-16"
          style={{
            backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.5) 100%)",
            pointerEvents: 'none'
          }}
        />
        <div className="relative">
        <form onSubmit={handleCreatePost}>
          <label htmlFor="new-post" className="sr-only">What's on your mind?</label>
          <div className="rounded-lg border-4 border-white/80 bg-white/90 shadow-inner p-2">
            <textarea
              id="new-post"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Shoot you penalty"
              className="w-full p-3 border border-white/60 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-white/80 bg-white/95 text-gray-900 placeholder-gray-500"
              rows="3"
              style={{
                backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 14px), repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 14px)",
                backgroundSize: 'auto',
              }}
            />
          </div>
          
          {/* File Preview */}
          {filePreview && (
            <div className="mt-3 relative">
              <img src={filePreview} alt="Preview" className="max-h-64 rounded-lg" />
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
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Photo/Video Upload */}
              <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-md bg-white/90 text-gray-900 hover:bg-white transition">
                <span className="text-xl">⚽</span>
                <span className="text-sm font-medium">Shoot</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              
              {/* Emoji Picker (custom, football only) */}
              <div className="relative inline-block">
                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-white/90 text-gray-900 hover:bg-white transition"
                  title="Add emoji"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                >
                  <span className="text-xl">😊</span>
                </button>
                {showEmojiPicker && (
                  <div className="absolute z-10 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2 flex flex-wrap gap-2 w-64">
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
                className="px-3 py-2 rounded-md bg-white/90 text-gray-900 hover:bg-white transition"
                title="Add location"
                onClick={() => setShowLocationInput((prev) => !prev)}
              >
                <span className="text-xl">📍</span>
              </button>
              {showLocationInput && (
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Vendndodhja (p.sh. Prishtinë, Stadiumi X...)"
                  className="ml-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ minWidth: 180 }}
                />
              )}
            </div>
            
            <button
              type="submit"
              disabled={posting || (!newPost.trim() && !selectedFile)}
              className="bg-yellow-400 text-black px-6 py-2 rounded-md hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              aria-describedby="post-button-desc"
            >
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
          <div id="post-button-desc" className="sr-only">Submit your post to share with others</div>
        </form>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-6">
        {allPosts.map((post, index) => (
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
              <div className={`flex-1 rounded-lg shadow-md p-6 border 
                ${highlightedPostId === String(post.id)
                  ? 'border-blue-500 dark:border-blue-400 ring-4 ring-blue-200 dark:ring-blue-900'
                  : 'border-gray-200 dark:border-gray-700'}
              `}
              style={{}}
            >
                {post.sponsors?.length > 0 && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-base font-bold animate-pulse" style={{ color: '#FFD700', letterSpacing: '1px', textShadow: '0 0 8px #FFD700, 0 0 2px #fff' }}>Sponsored</span>
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
                            ? getFullUrl(post.author.profilePhoto)
                            : getFullUrl(user.profilePhoto)
                        }
                        alt={post.author?.firstName || user?.firstName || 'User'}
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                        loading="lazy"
                        decoding="async"
                        onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {`${post.author?.firstName?.charAt(0).toUpperCase() || user?.firstName?.charAt(0).toUpperCase() || 'U'}${post.author?.lastName?.charAt(0).toUpperCase() || user?.lastName?.charAt(0).toUpperCase() || ''}`}
                      </div>
                    )}
                    <div className="ml-3">
                      <p className="font-semibold text-gray-900 dark:text-white hover:underline">
                        {post.author?.firstName && post.author?.lastName 
                          ? `${post.author.firstName} ${post.author.lastName}` 
                          : 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
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
                      onClick={() => openSponsorModal(post.id)}
                      className="text-orange-500 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 border border-orange-300 rounded px-2 py-1 text-xs"
                      title="Sponsorizo këtë post"
                    >
                      S
                    </button>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletingPost === post.id}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                      title="Delete post"
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
              <p className="text-gray-800 dark:text-gray-200 mb-4">{post.content}</p>
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
                  src={getFullUrl(post.imageUrl)}
                  alt="Post content" 
                  className="w-full rounded-lg mb-4 max-h-96 object-cover"
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
                  src={getFullUrl(post.videoUrl || post.imageUrl)}
                  controls 
                  preload="metadata"
                  className="w-full rounded-lg mb-4 max-h-96"
                  onError={(e) => {
                    console.error('Post video failed to load:', post.videoUrl || post.imageUrl);
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative inline-block">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-md ${
                        likedPosts.has(post.id) ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      aria-label={likedPosts.has(post.id) ? `Unlike post by ${post.author?.username || 'Unknown'}` : `Like post by ${post.author?.username || 'Unknown'}`}
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
                    className="flex items-center space-x-1 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600" 
                    aria-label={`Comment on post by ${post.author?.username || 'Unknown'}`}
                  >
                    <span>💬</span>
                    <span>{post.comments || 0}</span>
                  </button>
                  <button
                    onClick={() => setSharingPost(post.id)}
                    className="flex items-center space-x-1 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                    aria-label={`Share post by ${post.author?.username || 'Unknown'}`}
                  >
                    <span>📤</span>
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Share Modal */}
            {sharingPost === post.id && (
              <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4" role="dialog" aria-labelledby="share-dialog-title" aria-describedby="share-dialog-desc">
                <p id="share-dialog-title" className="text-sm text-gray-600 dark:text-gray-400 mb-2">Share this post:</p>
                <div id="share-dialog-desc" className="sr-only">Share options for the post</div>
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
                  aria-label="Close share options"
                >
                  Close
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
                              <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                {comment.User ? `${comment.User.firstName} ${comment.User.lastName}` : 'Unknown'}
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
                                title="Delete comment"
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
        {allPosts.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No posts yet. Be the first to share something!
          </div>
        )}
      </div>
    </div>

    {/* Sidebar - Marketing Spaces */}
    <div className="lg:col-span-1 space-y-4 hidden lg:block">
      {/* Sticky Sidebar */}
      <div className="sticky top-4 space-y-4">
        {/* Ad 1 - Premium Subscription */}
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg p-4 text-white shadow-lg">
          <div className="text-3xl mb-2">⭐</div>
          <h3 className="font-bold mb-2">Go Premium</h3>
          <p className="text-sm mb-3">Unlock exclusive features and remove ads</p>
          <button className="w-full bg-white text-orange-600 py-2 rounded-md font-semibold hover:bg-orange-50 transition">
            Upgrade
          </button>
        </div>

        {/* Ad 2 - Trending Tournaments */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <span>🔥</span> Trending Tournaments
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600">🏆</span>
              <span className="text-gray-700 dark:text-gray-300">Champions League</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">🏆</span>
              <span className="text-gray-700 dark:text-gray-300">Local Cup Finals</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-purple-600">🏆</span>
              <span className="text-gray-700 dark:text-gray-300">Youth Tournament</span>
            </div>
          </div>
          <button className="w-full mt-3 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition text-sm">
            View All
          </button>
        </div>

        {/* Ad 3 - Sponsor Banner */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-r from-red-500 to-pink-600 p-3 text-white text-center">
            <h4 className="font-bold">⚽ Featured Sponsor</h4>
          </div>
          <div className="p-4 text-center">
            <div className="bg-gray-100 dark:bg-gray-700 h-32 rounded flex items-center justify-center mb-3">
              <span className="text-5xl">🎯</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Your brand could be here</p>
            <button className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition text-sm">
              Advertise
            </button>
          </div>
        </div>

        {/* Ad 4 - Quick Stats */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <h4 className="font-bold text-gray-900 dark:text-white mb-3">📈 Platform Stats</h4>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Active Users</span>
              <span className="font-semibold">10,234</span>
            </div>
            <div className="flex justify-between">
              <span>Daily Posts</span>
              <span className="font-semibold">1,432</span>
            </div>
            <div className="flex justify-between">
              <span>Tournaments</span>
              <span className="font-semibold">87</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  );
};

export default Feed;