import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  HeartIcon,
  EyeIcon,
  ShareIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';

const VideoPlayer = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState([]);

  useEffect(() => {
    fetchVideo();
    fetchRelatedVideos();
  }, [id]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/videos/${id}`);
      setVideo(response.data);
    } catch (error) {
      console.error('Failed to fetch video:', error);
      if (error.response?.status === 403) {
        alert('This is premium content. Please upgrade to access.');
        navigate('/videos');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedVideos = async () => {
    try {
      const response = await api.get('/videos?limit=6');
      setRelatedVideos(response.data.filter(v => v.id !== parseInt(id)));
    } catch (error) {
      console.error('Failed to fetch related videos:', error);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) {
      videoRef.current.currentTime = pos * duration;
    }
  };

  const handleLike = async () => {
    try {
      await api.post(`/videos/${id}/like`);
      setVideo({ ...video, likes: video.likes + 1 });
      setLiked(true);
    } catch (error) {
      console.error('Failed to like video:', error);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Video not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto">
        {/* Video Player */}
        <div className="bg-black">
          <div className="relative max-w-5xl mx-auto">
            <video
              ref={videoRef}
              src={`http://localhost:5098${video.videoUrl}`}
              className="w-full aspect-video"
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setPlaying(false)}
              onClick={handlePlayPause}
            />

            {/* Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
              {/* Progress Bar */}
              <div
                className="w-full h-1 bg-gray-600 rounded-full mb-4 cursor-pointer"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-red-600 rounded-full"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="hover:text-red-500 transition-colors"
                  >
                    {playing ? (
                      <PauseIcon className="h-8 w-8" />
                    ) : (
                      <PlayIcon className="h-8 w-8" />
                    )}
                  </button>
                  <button
                    onClick={handleMuteToggle}
                    className="hover:text-red-500 transition-colors"
                  >
                    {muted ? (
                      <SpeakerXMarkIcon className="h-6 w-6" />
                    ) : (
                      <SpeakerWaveIcon className="h-6 w-6" />
                    )}
                  </button>
                  <span className="text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <button
                  onClick={handleFullscreen}
                  className="hover:text-red-500 transition-colors"
                >
                  <ArrowsPointingOutIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Info */}
            <div className="bg-white rounded-lg p-6 shadow">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">{video.title}</h1>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4 text-gray-600">
                  <span className="flex items-center gap-1">
                    <EyeIcon className="h-5 w-5" />
                    {formatViews(video.views)} views
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="h-5 w-5" />
                    {new Date(video.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleLike}
                    disabled={liked}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      liked
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {liked ? (
                      <HeartSolid className="h-5 w-5" />
                    ) : (
                      <HeartIcon className="h-5 w-5" />
                    )}
                    {video.likes}
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">
                    <ShareIcon className="h-5 w-5" />
                    Share
                  </button>
                </div>
              </div>

              {/* Creator Info */}
              <div className="flex items-center gap-4 pb-6 border-b border-gray-200">
                {video.User?.Profile?.profilePicture ? (
                  <img
                    src={`http://localhost:5098${video.User.Profile.profilePicture}`}
                    alt={video.User.firstName}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center text-lg font-bold">
                    {video.User?.firstName?.[0]}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {video.User?.firstName} {video.User?.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {video.User?.Profile?.position} • {video.User?.Profile?.club}
                  </p>
                </div>
                <button className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                  Follow
                </button>
              </div>

              {/* Description */}
              {video.description && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{video.description}</p>
                </div>
              )}

              {/* Tags */}
              {video.tags && video.tags.length > 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    {video.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Related Videos */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Related Videos</h3>
            {relatedVideos.map((relatedVideo) => (
              <div
                key={relatedVideo.id}
                onClick={() => navigate(`/video/${relatedVideo.id}`)}
                className="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow cursor-pointer flex gap-3"
              >
                <div className="w-40 aspect-video bg-gray-900 flex-shrink-0">
                  {relatedVideo.thumbnailUrl ? (
                    <img
                      src={`http://localhost:5098${relatedVideo.thumbnailUrl}`}
                      alt={relatedVideo.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PlayIcon className="h-8 w-8 text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-3">
                  <h4 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-1">
                    {relatedVideo.title}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {relatedVideo.User?.firstName} {relatedVideo.User?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatViews(relatedVideo.views)} views
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
