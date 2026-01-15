
const express = require('express');
const router = express.Router();

let gamificationController;
router.use(async (req, res, next) => {
	if (!gamificationController) {
		gamificationController = await import('../controllers/gamification.js');
	}
	req.gamificationController = gamificationController;
	next();
});

router.get('/user', async (req, res) => {
	await req.gamificationController.getUserGamification(req, res);
});

module.exports = router;
