import React, { createContext, useContext, useState, useCallback } from 'react';
import { postsAPI } from '../services/api';

const PostsContext = createContext();

export const usePosts = () => {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error('usePosts must be used within PostsProvider');
  }
  return context;
};

export const PostsProvider = ({ children }) => {
  const [allPosts, setAllPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [postComments, setPostComments] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch all posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await postsAPI.getPosts();
      setAllPosts(response.data);
      
      // Set liked posts
      const liked = new Set();
      response.data.forEach(post => {
        if (post.isLiked) {
          liked.add(post.id);
        }
      });
      setLikedPosts(liked);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user posts
  const fetchUserPosts = useCallback(async (userId) => {
    try {
      const response = await postsAPI.getUserPosts(userId);
      
      // Update global posts with user posts
      const userPostIds = response.data.map(p => p.id);
      const otherPosts = allPosts.filter(p => !userPostIds.includes(p.id));
      setAllPosts([...response.data, ...otherPosts]);
      
      // Update liked posts
      const liked = new Set(likedPosts);
      response.data.forEach(post => {
        if (post.isLiked) {
          liked.add(post.id);
        }
      });
      setLikedPosts(liked);
      
      return response.data;
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
    fetchPosts,
    fetchUserPosts,
    toggleLike,
    fetchComments,
    addComment,
    addPost,
  };

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
};
