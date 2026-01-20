// Script to delete all posts and their related comments/likes/galleries
const { Post, Comment, Like, Gallery } = require('../models');
const PostAnalytics = require('../models/PostAnalytics');

(async () => {
  try {
    // Delete all comments
    await Comment.destroy({ where: {} });
    // Delete all likes
    await Like.destroy({ where: {} });
    // Delete all galleries
    await Gallery.destroy({ where: {} });
    // Delete all posts
    await Post.destroy({ where: {} });
    // Delete all post analytics first
    await PostAnalytics.destroy({ where: {} });
    console.log('✅ All posts, comments, likes, galleries, and analytics deleted.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error deleting:', err);
    process.exit(1);
  }
})();
