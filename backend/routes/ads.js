const express = require('express');
const router = express.Router();

const adsController = require('../controllers/ads');
const uploadCloud = require('../middleware/uploadCloudinary');
const auth = require('../middleware/auth');

// GET all active ads
router.get('/', adsController.getActiveAds);

// POST create ad
router.post('/', auth, uploadCloud.fields([{ name: 'image', maxCount: 1 }]), adsController.createAd);

module.exports = router;
