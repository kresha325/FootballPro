const express = require('express');
const router = express.Router();
const businessController = require('../controllers/business');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, businessController.createBusiness);
router.get('/:id?', authenticate, businessController.getBusiness);
router.put('/', authenticate, businessController.updateBusiness);
router.get('/', authenticate, businessController.getAllBusinesses);

module.exports = router;
