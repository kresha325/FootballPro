'use strict';

const express = require('express');
const admin = require('../middleware/admin');
const ops = require('../controllers/adminOps');

const router = express.Router();
router.use(admin);

router.get('/session', ops.session);
router.get('/dashboard', ops.dashboard);
router.get('/search', ops.search);
router.get('/analytics', ops.analytics);

router.get('/players', ops.players);
router.post('/players/:id/actions', ops.playerAction);
router.get('/clubs', ops.clubs);
router.post('/clubs/:id/actions', ops.clubAction);
router.get('/competitions', ops.competitions);
router.post('/competitions/:id/actions', ops.competitionAction);
router.get('/matches', ops.matches);
router.post('/matches/:id/actions', ops.matchAction);
router.get('/scouting', ops.scouting);
router.get('/media', ops.media);
router.post('/media/:id/actions', ops.mediaAction);
router.get('/products', ops.products);
router.post('/products/:id/actions', ops.productAction);
router.get('/orders', ops.orders);
router.post('/orders/:id/actions', ops.orderAction);
router.get('/sellers', ops.sellers);

router.get('/finance', ops.finance);
router.post('/finance/adjustments', ops.adjust);
router.get('/payments', ops.payments);
router.post('/payments/:id/retry', ops.paymentRetry);

router.get('/notifications', ops.notifications);
router.get('/notifications/tokens', ops.invalidTokens);
router.post('/notifications/actions', ops.notificationAction);

router.get('/reports', ops.reports);
router.post('/reports/:id/actions', ops.reviewReport);
router.get('/audit', ops.audit);

router.get('/users/:id/activity', ops.activity);
router.post('/users/:id/sessions/revoke', ops.revoke);
router.put('/users/:id/admin-role', ops.adminRole);

router.get('/system', ops.system);
router.get('/errors', ops.errors);
router.get('/jobs', ops.jobs);
router.post('/jobs/:name/retry', ops.retryJob);
router.get('/deployment', ops.deployment);
router.get('/flags', ops.flags);
router.put('/flags/:flag', ops.updateFlag);
router.get('/maintenance', ops.maintenance);
router.put('/maintenance', ops.updateMaintenance);

router.post('/bulk', ops.bulk);
router.get('/export/:kind', ops.exportCsv);

module.exports = router;
