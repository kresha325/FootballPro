import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

const ContentManagement = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await adminAPI.getAllPosts();
      setPosts(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
    }
  };

  const deletePost = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await adminAPI.deletePost(postId);
        fetchPosts(); // Refresh the list
      } catch (error) {
        console.error('Error deleting post:', error);
      }
    }
  };

  if (loading) {
    return <div className="text-center mt-10">Loading posts...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Content Management</h2>
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="border dark:border-gray-600 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold">{post.User?.firstName} {post.User?.lastName}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{post.User?.email}</p>
              </div>
              <button
                onClick={() => deletePost(post.id)}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
            <p className="text-gray-800 dark:text-gray-200">{post.content}</p>
            <p className="text-sm text-gray-500 mt-2">
              Created: {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContentManagement;