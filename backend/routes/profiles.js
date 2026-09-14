const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const { 
  getProfile,
  getPublicProfileCv,
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

/** Public digital CV — no auth */
router.get('/cv/:id', getPublicProfileCv);

router.get('/:userId/tournament-summary', auth, getUserTournamentSummary);
router.get('/:userId/followers', auth, getFollowers);
router.get('/:userId/following', auth, getFollowing);
router.get('/:userId/follow-status', auth, checkFollowStatus);

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

module.exports = router;
