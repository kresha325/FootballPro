const express = require('express');
const router = express.Router();
const ligaController = require('../controllers/liga');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, ligaController.createLiga);
router.get('/:id?', authenticate, ligaController.getLiga);
router.put('/', authenticate, ligaController.updateLiga);
router.get('/', authenticate, ligaController.getAllLigas);

module.exports = router;
