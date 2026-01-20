const { Post } = require('../models');

async function deleteAllPosts() {
  try {
    const deleted = await Post.destroy({ where: {}, truncate: true });
    console.log(`Deleted ${deleted} posts.`);
  } catch (err) {
    console.error('Error deleting posts:', err);
  }
}

deleteAllPosts();
