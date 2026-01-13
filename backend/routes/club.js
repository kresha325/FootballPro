const express = require('express');
const router = express.Router();
const clubController = require('../controllers/club');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, clubController.createClub);
router.get('/:id?', authenticate, clubController.getClub);
router.put('/', authenticate, clubController.updateClub);
router.get('/', authenticate, clubController.getAllClubs);

module.exports = router;
