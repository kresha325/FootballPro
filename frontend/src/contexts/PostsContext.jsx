import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { postsAPI } from '../services/api';

const PostsContext = createContext();

export function usePosts() {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error('usePosts must be used within PostsProvider');
  }
  return context;
}

function PostsProvider({ children }) {
  const [allPosts, setAllPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [postComments, setPostComments] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const feedOptionsRef = useRef({ followedOnly: false });

  const fetchPosts = useCallback(async (options = {}) => {
    const page = options.page || 1;
    const followedOnly = options.followedOnly ?? feedOptionsRef.current.followedOnly;
    if (page === 1) {
      feedOptionsRef.current = { followedOnly: !!followedOnly };
      setLoading(true);
    }
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (followedOnly) params.followed = true;
      const response = await postsAPI.getPosts(params);
      const rows = Array.isArray(response.data) ? response.data : [];
      setHasMorePosts(String(response.headers?.['x-has-more'] || '0') === '1');
      setPostsPage(page);
      setAllPosts((prev) => {
        if (page === 1) return rows;
        const seen = new Set(prev.map((post) => String(post.id)));
        return [...prev, ...rows.filter((post) => !seen.has(String(post.id)))];
      });

      setLikedPosts((prev) => {
        const liked = page === 1 ? new Set() : new Set(prev);
        rows.forEach((post) => {
          if (post.isLiked) liked.add(post.id);
        });
        return liked;
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(error?.response?.data?.msg || 'Feed-i nuk mund të ngarkohej. Provo përsëri.');
    } finally {
      if (page === 1) setLoading(false);
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (!hasMorePosts || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPosts({ page: postsPage + 1, followedOnly: feedOptionsRef.current.followedOnly });
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPosts, hasMorePosts, loadingMore, postsPage]);

  // Fetch user posts
  const fetchUserPosts = useCallback(async (userId) => {
    try {
      const rows = [];
      let page = 1;
      let more = true;
      while (more && page <= 10) {
        const response = await postsAPI.getUserPosts(userId, { params: { page, limit: 20 } });
        const batch = Array.isArray(response.data) ? response.data : [];
        rows.push(...batch);
        more = String(response.headers?.['x-has-more'] || '0') === '1' && batch.length > 0;
        page += 1;
      }

      const userPostIds = new Set(rows.map((post) => post.id));
      const otherPosts = allPosts.filter((post) => !userPostIds.has(post.id));
      setAllPosts([...rows, ...otherPosts]);

      const liked = new Set(likedPosts);
      rows.forEach((post) => {
        if (post.isLiked) liked.add(post.id);
      });
      setLikedPosts(liked);

      return rows;
    } catch (error) {
      console.error('Error fetching user posts:', error);
      return [];
    }
  }, [allPosts, likedPosts]);

  // Toggle like
  const toggleLike = useCallback(async (postId) => {
    try {
      const isLiked = likedPosts.has(postId);
      
      if (isLiked) {
        await postsAPI.unlikePost(postId);
      } else {
        await postsAPI.likePost(postId);
      }
      
      // Update state
      setAllPosts(posts => posts.map(post => {
        if (post.id === postId) {
          const newLikes = isLiked ? (post.likes || 0) - 1 : (post.likes || 0) + 1;
          return { ...post, likes: Math.max(0, newLikes), isLiked: !isLiked };
        }
        return post;
      }));
      
      const updated = new Set(likedPosts);
      if (isLiked) {
        updated.delete(postId);
      } else {
        updated.add(postId);
      }
      setLikedPosts(updated);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [likedPosts]);

  // Fetch comments
  const fetchComments = useCallback(async (postId) => {
    try {
      const response = await postsAPI.getComments(postId);
      setPostComments(prev => ({ ...prev, [postId]: response.data }));
      return response.data;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }, []);

  // Add comment
  const addComment = useCallback(async (postId, content) => {
    try {
      await postsAPI.commentPost(postId, { content });
      
      // Refresh comments
      await fetchComments(postId);
      
      // Update comment count
      setAllPosts(posts => posts.map(post => 
        post.id === postId 
          ? { ...post, comments: (post.comments || 0) + 1 }
          : post
      ));
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }, [fetchComments]);

  // Add new post
  const addPost = useCallback((newPost) => {
    setAllPosts(posts => [newPost, ...posts]);
  }, []);

  const value = {
    allPosts,
    likedPosts,
    postComments,
    loading,
    loadingMore,
    hasMorePosts,
    error,
    fetchPosts,
    loadMorePosts,
    fetchUserPosts,
    toggleLike,
    fetchComments,
    addComment,
    addPost,
  };

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
export default PostsProvider;
