
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  searchUsers,
  searchPosts,
  getTrendingPosts,
  getTrendingUsers,
  getRecommendedUsers,
  getBrowseUsers,
  getSearchSuggestions,
  searchEverything,
} = require('../controllers/search');

// Universal search endpoint
router.get('/', auth, searchEverything);

// Search endpoints
router.get('/users', auth, searchUsers);
router.get('/posts', auth, searchPosts);

// Discovery endpoints
router.get('/trending/posts', auth, getTrendingPosts);
router.get('/trending/users', auth, getTrendingUsers);
router.get('/recommended', auth, getRecommendedUsers);
router.get('/browse', auth, getBrowseUsers);

// Autocomplete
router.get('/suggestions', auth, getSearchSuggestions);

module.exports = router;