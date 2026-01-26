const express = require('express');
const router = express.Router();

const sponsorController = require('../controllers/sponsor');
const uploadCloud = require('../middleware/uploadCloudinary');


// GET all sponsors (public)
router.get('/all', sponsorController.getAllSponsors);

// GET all sponsors for a user
router.get('/user/:userId', sponsorController.getSponsorsByUser);

// POST create sponsor (with image upload)
router.post('/', uploadCloud.fields([{ name: 'image', maxCount: 1 }]), sponsorController.createSponsor);

// PUT update sponsor
router.put('/:id', sponsorController.updateSponsor);

// DELETE sponsor
router.delete('/:id', sponsorController.deleteSponsor);

module.exports = router;
