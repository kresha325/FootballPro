const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const stadiumController = require('../controllers/stadium');

// Clubs / any logged-in user can list & view
router.get('/', auth, stadiumController.listStadiums);
router.get('/:id', auth, stadiumController.getStadium);

// Admin CRUD
router.post('/', admin, stadiumController.createStadium);
router.put('/:id', admin, stadiumController.updateStadium);
router.delete('/:id', admin, stadiumController.deleteStadium);

module.exports = router;
