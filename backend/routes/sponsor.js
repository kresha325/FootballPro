const express = require('express');
const router = express.Router();

const sponsorController = require('../controllers/sponsor');
const sponsorUpload = require('../middleware/sponsorUpload');

// GET all sponsors for a user
router.get('/user/:userId', sponsorController.getSponsorsByUser);

// POST create sponsor (with image upload)
router.post('/', sponsorUpload.single('image'), sponsorController.createSponsor);

// PUT update sponsor
router.put('/:id', sponsorController.updateSponsor);

// DELETE sponsor
router.delete('/:id', sponsorController.deleteSponsor);

module.exports = router;
