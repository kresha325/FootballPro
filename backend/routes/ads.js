const express = require('express');
const router = express.Router();

const adsController = require('../controllers/ads');
const upload = require('../middleware/uploadAdImage');

// GET all active ads
router.get('/', adsController.getActiveAds);

// POST create ad
router.post('/', upload.single('image'), adsController.createAd);

module.exports = router;
