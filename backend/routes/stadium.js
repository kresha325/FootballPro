const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const uploadCloud = require('../middleware/uploadCloudinary');
const stadiumController = require('../controllers/stadium');

const photoUpload = uploadCloud.fields([{ name: 'photo', maxCount: 1 }]);

// Clubs / any logged-in user can list & view
router.get('/', auth, stadiumController.listStadiums);
router.get('/featured', auth, stadiumController.listFeaturedStadiums);
router.get('/:id', auth, stadiumController.getStadium);

// Admin CRUD (multipart photo optional)
router.post('/', admin, photoUpload, stadiumController.createStadium);
router.put('/:id', admin, photoUpload, stadiumController.updateStadium);
router.delete('/:id', admin, stadiumController.deleteStadium);

module.exports = router;
