const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  createReport,
  blockUser,
  unblockUser,
  listMyBlocks,
  getBlockStatus,
  listReportsAdmin,
  reviewReportAdmin,
} = require('../controllers/moderation');
const { deleteMyAccount } = require('../controllers/accountDeletion');

const router = express.Router();

router.post('/reports', auth, createReport);
router.get('/blocks', auth, listMyBlocks);
router.get('/blocks/:userId/status', auth, getBlockStatus);
router.post('/blocks/:userId', auth, blockUser);
router.delete('/blocks/:userId', auth, unblockUser);
router.delete('/account', auth, deleteMyAccount);

router.get('/admin/reports', admin, listReportsAdmin);
router.put('/admin/reports/:reportId', admin, reviewReportAdmin);

module.exports = router;
