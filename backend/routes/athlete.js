const express = require('express');
const router = express.Router();
const athleteController = require('../controllers/athlete');
console.log('athleteController:', athleteController);
const authenticate = require('../middleware/auth');
const managedAthletes = require('../controllers/managedAthletes');
const { rateLimit } = require('express-rate-limit');

const managedAthleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Shumë regjistrime në një kohë të shkurtër. Provo përsëri më vonë.' },
});
const consentResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Shumë kërkesa për ridërgim. Provo përsëri më vonë.' },
});

router.post('/managed', authenticate, managedAthleteLimiter, managedAthletes.createManagedAthlete);
router.post('/managed/:athleteId/parent-consent', authenticate, consentResendLimiter, managedAthletes.resendManagedAthleteConsent);

router.post('/', authenticate, athleteController.createAthlete);
// Keep the collection route ahead of the optional ID route so GET / cannot
// resolve as a detail request with an empty parameter.
router.get('/', authenticate, athleteController.getAllAthletes);
router.get('/:id?', authenticate, athleteController.getAthlete);
router.put('/', authenticate, athleteController.updateAthlete);

module.exports = router;
