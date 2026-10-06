const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const liveDonationController = require('../controllers/liveDonation');

router.post('/send', auth, liveDonationController.sendDonation);
router.get('/:streamId', liveDonationController.getDonations);

module.exports = router;
