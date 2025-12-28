const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  searchUsers,
  searchPosts,
  getTrendingPosts,
  getTrendingUsers,
  getRecommendedUsers,
  getSearchSuggestions,
} = require('../controllers/search');

// Search endpoints
router.get('/users', auth, searchUsers);
router.get('/posts', auth, searchPosts);

// Discovery endpoints
router.get('/trending/posts', auth, getTrendingPosts);
router.get('/trending/users', auth, getTrendingUsers);
router.get('/recommended', auth, getRecommendedUsers);

// Autocomplete
router.get('/suggestions', auth, getSearchSuggestions);

module.exports = router;