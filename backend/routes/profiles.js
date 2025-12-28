const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  getProfile, 
  createProfile, 
  updateProfile, 
  getAllProfiles, 
  upload,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus
} = require('../controllers/profiles');

/**
 * GET ALL PROFILES (with optional filters)
 * GET /api/profiles?role=athlete&search=john
 */
router.get('/', auth, getAllProfiles);

/**
 * GET PROFILE BY ID (public, but auth required)
 * GET /api/profiles/:id
 */
router.get('/:id', auth, getProfile);

/**
 * CREATE MY PROFILE (if not exists)
 * POST /api/profiles/me
 */
router.post('/me', auth, createProfile);

/**
 * UPDATE MY PROFILE
 * PUT /api/profiles/me
 */
router.put('/me', auth, upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]), updateProfile);

/**
 * FOLLOW A USER
 * POST /api/profiles/:userId/follow
 */
router.post('/:userId/follow', auth, followUser);

/**
 * UNFOLLOW A USER
 * DELETE /api/profiles/:userId/unfollow
 */
router.delete('/:userId/unfollow', auth, unfollowUser);

/**
 * GET FOLLOWERS OF A USER
 * GET /api/profiles/:userId/followers
 */
router.get('/:userId/followers', auth, getFollowers);

/**
 * GET FOLLOWING OF A USER
 * GET /api/profiles/:userId/following
 */
router.get('/:userId/following', auth, getFollowing);

/**
 * CHECK FOLLOW STATUS
 * GET /api/profiles/:userId/follow-status
 */
router.get('/:userId/follow-status', auth, checkFollowStatus);

module.exports = router;
