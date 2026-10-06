const express = require('express');
const router = express.Router();

const adsController = require('../controllers/ads');
const uploadCloud = require('../middleware/uploadCloudinary');
const admin = require('../middleware/admin');

// GET all active ads
router.get('/', adsController.getActiveAds);

// POST create ad (photo or video) — admin only
router.post(
  '/',
  admin,
  uploadCloud.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  adsController.createAd
);

module.exports = router;
