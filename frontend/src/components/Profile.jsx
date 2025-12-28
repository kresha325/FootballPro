import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { profileAPI, galleryAPI, subscriptionsAPI, messagingAPI } from '../services/api';
import { usePosts } from '../contexts/PostsContext';
import EditProfile from './EditProfile';
import { useAuth } from '../contexts/AuthContext';
import PlayerProfile from './profiles/PlayerProfile';
import CoachProfile from './profiles/CoachProfile';
import ScoutProfile from './profiles/ScoutProfile';
import ClubProfile from './profiles/ClubProfile';
import ManagerProfile from './profiles/ManagerProfile';
import BusinessProfile from './profiles/BusinessProfile';
import { ClubBadge } from '../utils/clubLogos';
import TransferHistory from './TransferHistory';
import VideoCallSimple from './VideoCallSimple';

const Profile = () => {
  const { id } = useParams();
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

  const [profile, setProfile] = useState(null);
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
  const [stats, setStats] = useState({
    posts: 0,
    followers: 0,
    following: 0,
  });

  // Set gallery image as profile or cover photo
  const setAsProfilePhoto = async (imageUrl, type) => {
    try {
      const formData = new FormData();
      // Fetch the image as blob and append to FormData
      const response = await fetch(`http://192.168.100.57:5098${imageUrl}`);
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
      
      setSelectedGalleryImage(null);
      alert(`${type === 'profile' ? 'Profile' : 'Cover'} photo updated!`);
    } catch (error) {
      console.error('Error setting photo:', error);
      alert('Failed to update photo');
    }
  };

  // Comment handlers
  const toggleComments = (postId) => {
    const expanded = new Set(expandedComments);
    if (expanded.has(postId)) {
      expanded.delete(postId);
    } else {
      expanded.add(postId);
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

  // Message handler
  const handleMessage = async () => {
    try {
      const response = await messagingAPI.getOrCreateConversation(id);
      navigate('/messaging', { state: { conversationId: response.data.id } });
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Failed to start conversation');
    }
  };

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
    switch (profile.role) {
      case 'athlete':
        return <PlayerProfile profile={profile} stats={stats} isOwner={isOwner} />;
      case 'coach':
        return <CoachProfile profile={profile} stats={stats} isOwner={isOwner} />;
      case 'scout':
        return <ScoutProfile profile={profile} stats={stats} isOwner={isOwner} />;
      case 'club':
        return <ClubProfile profile={profile} stats={stats} isOwner={isOwner} />;
      case 'manager':
        return <ManagerProfile profile={profile} stats={stats} isOwner={isOwner} />;
      case 'business':
        return <BusinessProfile profile={profile} stats={stats} isOwner={isOwner} />;
      default:
        return (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No specialized profile view for this role
          </div>
        );
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      try {
        const res = await profileAPI.getProfile(id);
        setProfile(res.data);
        
        // Fetch user posts using context
        await fetchUserPosts(id);
        
        // Filter posts for this user
        const userPostsData = allPosts.filter(post => post.userId === parseInt(id));
        
        // Fetch user gallery
        try {
          const galleryRes = await galleryAPI.getUserGallery(id);
          setGallery(galleryRes.data);
        } catch (err) {
          console.log('Gallery fetch error:', err);
          setGallery([]);
        }
        
        // Set stats
        setStats({
          posts: userPostsData.length,
          followers: res.data.followers || 0,
          following: res.data.following || 0,
        });

        // Check follow status if viewing another user's profile
        if (user && user.id !== parseInt(id)) {
          try {
            const followStatusRes = await profileAPI.checkFollowStatus(id);
            setIsFollowing(followStatusRes.data.isFollowing);
          } catch (err) {
            console.error('Error checking follow status:', err);
          }
        }
      } catch (err) {
        console.error('PROFILE FETCH ERROR:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id, fetchUserPosts, allPosts]);

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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Top Marketing Banner */}
      <div className="mb-4 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg p-4 text-white text-center shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold">🏆 Boost Your Football Career!</h3>
            <p className="text-sm mt-1">Get noticed by scouts worldwide - Premium Profile Features</p>
          </div>
          <button 
            onClick={() => window.location.href = '/premium'}
            className="bg-white text-teal-600 px-6 py-2 rounded-md font-semibold hover:bg-gray-100 transition"
          >
            Upgrade Now
          </button>
        </div>
      </div>

      {/* Cover Photo */}
      <div className="h-64 bg-gradient-to-r from-blue-500 to-purple-600 relative">
        {profile.coverPhoto && (
          <img
            src={`http://192.168.100.57:5098${profile.coverPhoto}`}
            alt="Cover" 
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-20 pb-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 overflow-hidden shadow-lg">
                {profile.profilePhoto ? (
                  <img
                    src={`http://192.168.100.57:5098${profile.profilePhoto}`}
                    alt={`${profile.firstName} ${profile.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center text-5xl font-bold">
                    {profile.firstName[0]}{profile.lastName[0]}
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

            {/* Name and Stats */}
            <div className="flex-1 md:ml-6 mt-4 md:mt-0 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {profile.firstName} {profile.lastName}
                </h1>
                {profile.verified && (
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
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
                    <ClubBadge clubName={profile.club} size="sm" />
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
              <div className="flex items-center justify-center md:justify-start gap-6 mt-4">
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
            <div className="mt-4 md:mt-0">
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
              {['overview', 'posts', 'gallery', 'about', 'contact'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 font-medium capitalize transition whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {tab}
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
                    <div key={post.id} className="border dark:border-gray-700 rounded-lg p-4">
                      {/* Post Content */}
                      {post.content && (
                        <p className="text-gray-900 dark:text-white mb-3">{post.content}</p>
                      )}
                      
                      {/* Post Image */}
                      {post.imageUrl && (
                        <div className="mt-3 rounded-lg overflow-hidden">
                          <img 
                            src={`http://192.168.100.57:5098${post.imageUrl}`}
                            alt="Post" 
                            className="w-full h-auto object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Post Video */}
                      {post.videoUrl && (
                        <div className="mt-3 rounded-lg overflow-hidden">
                          <video 
                            src={`http://192.168.100.57:5098${post.videoUrl}`}
                            controls 
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
                        {item.imageUrl ? (
                          <div className="aspect-video relative">
                            <img
                              src={item.imageUrl.startsWith('http') ? item.imageUrl : `http://192.168.100.57:5098${item.imageUrl}`}
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
                          </div>
                        ) : item.videoUrl ? (
                          <div className="aspect-video relative">
                            <video
                              src={item.videoUrl.startsWith('http') ? item.videoUrl : `http://192.168.100.57:5098${item.videoUrl}`}
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
                          </div>
                        ) : (
                          <div className="aspect-video flex items-center justify-center bg-gray-200 dark:bg-gray-600">
                            <span className="text-gray-400">📁</span>
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

            {activeTab === 'about' && (
              <div className="space-y-6">
                {/* Transfer History */}
                {(profile.role === 'athlete' || profile.role === 'coach') && (
                  <TransferHistory userId={profile.id} isOwner={isOwner} />
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
                {!profile.contact?.phone && !profile.contact?.instagram && !profile.contact?.twitter && !profile.contact?.facebook && (
                  <p className="text-center text-gray-500 py-8">No contact information available</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar - Marketing Spaces */}
      <div className="lg:col-span-1 space-y-4">
        {/* Ad Space 1 - Featured Product */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-4xl mb-2">⚽</div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Pro Training Gear</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Get 30% off on professional football equipment</p>
            <button className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition text-sm">
              Shop Now
            </button>
          </div>
        </div>

        {/* Ad Space 2 - Sponsor Banner */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-4 text-white text-center shadow-lg">
          <h4 className="font-bold mb-2">🎯 Your Ad Here</h4>
          <p className="text-xs mb-3">Reach thousands of football enthusiasts</p>
          <button className="bg-white text-orange-600 px-4 py-1 rounded text-xs font-semibold hover:bg-gray-100 transition">
            Advertise
          </button>
        </div>

        {/* Ad Space 3 - Tournament Banner */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 text-white text-center">
            <h4 className="font-bold">🏆 Tournament</h4>
          </div>
          <div className="p-4 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">Join the next championship</p>
            <button className="w-full bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 transition text-sm">
              Register Now
            </button>
          </div>
        </div>

        {/* Ad Space 4 - Sponsored Content */}
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">SPONSORED</p>
          <div className="bg-white dark:bg-gray-600 h-32 rounded flex items-center justify-center mb-2">
            <span className="text-4xl">📢</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Advertisement Space</p>
        </div>
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
              src={`http://192.168.100.57:5098${selectedGalleryImage.imageUrl}`}
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

      {editOpen && (
        <EditProfile
          onClose={() => setEditOpen(false)}
        />
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
    </div>
  );
};

export default Profile;
