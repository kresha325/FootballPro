const express = require('express');
const router = express.Router();
const liveStreamGuestController = require('../controllers/liveStreamGuest');

router.post('/invite', liveStreamGuestController.inviteGuest);
router.patch('/:guestId/status', liveStreamGuestController.updateGuestStatus);
router.get('/:streamId', liveStreamGuestController.getGuests);

module.exports = router;
