const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coach');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, coachController.createCoach);
router.get('/:id?', authenticate, coachController.getCoach);
router.put('/', authenticate, coachController.updateCoach);
router.get('/', authenticate, coachController.getAllCoaches);

module.exports = router;
