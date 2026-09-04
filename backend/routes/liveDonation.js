const express = require('express');
const router = express.Router();
const liveDonationController = require('../controllers/liveDonation');
const auth = require('../middleware/auth');

router.post('/send', auth, liveDonationController.sendDonation);
router.get('/:streamId', liveDonationController.getDonations);

module.exports = router;
