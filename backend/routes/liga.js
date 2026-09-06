const express = require('express');
const router = express.Router();
const ligaController = require('../controllers/liga');
const authenticate = require('../middleware/auth');

router.post('/', authenticate, ligaController.createLiga);
router.get('/', authenticate, ligaController.getAllLigas);
router.put('/me', authenticate, ligaController.updateLiga);
router.put('/', authenticate, ligaController.updateLiga);
router.delete('/me', authenticate, ligaController.deleteLiga);
router.delete('/clubs/:clubId', authenticate, ligaController.removeClubFromLiga);
router.post('/:id/join', authenticate, ligaController.joinLiga);
router.delete('/:id/leave', authenticate, ligaController.leaveLiga);
router.get('/:id', authenticate, ligaController.getLiga);

module.exports = router;
