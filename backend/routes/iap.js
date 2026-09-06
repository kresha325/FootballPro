const express = require('express');
const auth = require('../middleware/auth');
const { getIapCatalog, verifyAndFulfill } = require('../controllers/iap');

const router = express.Router();

router.get('/catalog', auth, getIapCatalog);
router.post('/verify', auth, verifyAndFulfill);

module.exports = router;
