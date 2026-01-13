const express = require('express');
const router = express.Router();
const managerController = require('../controllers/manager');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, managerController.createManager);
router.get('/:id?', authenticate, managerController.getManager);
router.put('/', authenticate, managerController.updateManager);
router.get('/', authenticate, managerController.getAllManagers);

module.exports = router;
