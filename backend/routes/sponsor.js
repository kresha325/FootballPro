const express = require('express');
const router = express.Router();

const sponsorController = require('../controllers/sponsor');
const uploadCloud = require('../middleware/uploadCloudinary');
const auth = require('../middleware/auth');

// GET all sponsors (public)
router.get('/all', sponsorController.getAllSponsors);

// GET all sponsors for a user
router.get('/user/:userId', sponsorController.getSponsorsByUser);

// POST create sponsor (with image upload) — own account only
router.post('/', auth, uploadCloud.fields([{ name: 'image', maxCount: 1 }]), sponsorController.createSponsor);

// PUT update sponsor — owner only (allow new logo upload)
router.put('/:id', auth, uploadCloud.fields([{ name: 'image', maxCount: 1 }]), sponsorController.updateSponsor);

// DELETE sponsor — owner only
router.delete('/:id', auth, sponsorController.deleteSponsor);

module.exports = router;
