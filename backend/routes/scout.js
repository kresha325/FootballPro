const express = require('express');
const router = express.Router();
const scoutController = require('../controllers/scout');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, scoutController.createScout);
router.get('/:id?', authenticate, scoutController.getScout);
router.put('/', authenticate, scoutController.updateScout);
router.get('/', authenticate, scoutController.getAllScouts);

module.exports = router;
