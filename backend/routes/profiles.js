const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const { 
  getProfile, 
  createProfile, 
  updateProfile, 
  getAllProfiles, 
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus,
  registerPushToken,
  getUserTournamentSummary,
} = require('../controllers/profiles');
const uploadCloud = require('../middleware/uploadCloudinary');

/**
 * GET ALL PROFILES (with optional filters)
 * GET /api/profiles?role=athlete&search=john
 */
router.get('/', auth, getAllProfiles);

/**
 * GET PROFILE BY ID (public, but auth required)
 * GET /api/profiles/:id
 */
router.get('/me', auth, (req, res, next) => {
  req.params.id = req.user.id;
  return getProfile(req, res, next);
});

router.get('/:userId/tournament-summary', auth, getUserTournamentSummary);

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
router.put('/me', auth, uploadCloud.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]), updateProfile);

router.post('/me/push-token', auth, registerPushToken);

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
