const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const liveStreamGuestController = require('../controllers/liveStreamGuest');

const invitationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user?.id || 'anonymous'}`,
  handler: (_req, res) => res.status(429).json({ error: 'Too many guest invitations' }),
});

router.post('/invite', auth, invitationLimiter, liveStreamGuestController.inviteGuest);
router.patch('/:guestId/status', auth, liveStreamGuestController.updateGuestStatus);
router.get('/:streamId', auth, liveStreamGuestController.getGuests);

module.exports = router;
