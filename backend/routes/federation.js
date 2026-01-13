const express = require('express');
const router = express.Router();
const federationController = require('../controllers/federation');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, federationController.createFederation);
router.get('/:id?', authenticate, federationController.getFederation);
router.put('/', authenticate, federationController.updateFederation);
router.get('/', authenticate, federationController.getAllFederations);

module.exports = router;
