const express = require('express');
const router = express.Router();
const athleteController = require('../controllers/athlete');
console.log('athleteController:', athleteController);
const authenticate = require('../middleware/auth');

router.post('/', authenticate, athleteController.createAthlete);
router.get('/:id?', authenticate, athleteController.getAthlete);
router.put('/', authenticate, athleteController.updateAthlete);
router.get('/', authenticate, athleteController.getAllAthletes);

module.exports = router;
