const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const liveStreamGuestController = require('../controllers/liveStreamGuest');

router.post('/invite', auth, liveStreamGuestController.inviteGuest);
router.patch('/:guestId/status', auth, liveStreamGuestController.updateGuestStatus);
router.get('/:streamId', auth, liveStreamGuestController.getGuests);

module.exports = router;
