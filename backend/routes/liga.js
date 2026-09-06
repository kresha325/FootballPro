const express = require('express');
const router = express.Router();
const ligaController = require('../controllers/liga');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, ligaController.createLiga);
router.get('/', authenticate, ligaController.getAllLigas);
router.put('/me', authenticate, ligaController.updateLiga);
router.put('/', authenticate, ligaController.updateLiga);
router.get('/:id', authenticate, ligaController.getLiga);

module.exports = router;
