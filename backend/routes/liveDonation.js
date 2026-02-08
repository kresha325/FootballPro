const express = require('express');
const router = express.Router();
const liveDonationController = require('../controllers/liveDonation');

router.post('/send', liveDonationController.sendDonation);
router.get('/:streamId', liveDonationController.getDonations);

module.exports = router;
