const express = require('express');
const router = express.Router();
const admin = require('../middleware/admin');
const { requirePermission } = require('../middleware/admin');
const {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllPosts,
  deletePost,
  getAnalytics,
  banUser,
  unbanUser,
  verifyUser,
  togglePremium,
  resetUserPassword,
  getPendingJonCoinTransactions,
  listInvoices,
  getInvoice,
  exportInvoicesCsv,
  listTournaments,
  adminUpdateTournament,
  adminDeleteTournament,
} = require('../controllers/admin');

// All admin routes require admin middleware
router.use(admin);

// User management
router.get('/users', requirePermission('users.read'), getAllUsers);
router.put('/users/:userId/role', requirePermission('users.role'), updateUserRole);
router.post('/users/:userId/ban', requirePermission('users.suspend'), banUser);
router.post('/users/:userId/unban', requirePermission('users.suspend'), unbanUser);
router.post('/users/:userId/verify', requirePermission('users.verify'), verifyUser);
router.post('/users/:userId/premium', requirePermission('users.premium'), togglePremium);
router.post('/users/:userId/reset-password', requirePermission('users.secrets'), resetUserPassword);
router.delete('/users/:userId', requirePermission('users.delete'), deleteUser);

// Content management
router.get('/posts', requirePermission('content.manage'), getAllPosts);
router.delete('/posts/:postId', requirePermission('content.manage'), deletePost);

// Tournaments
router.get('/tournaments', requirePermission('competitions.manage'), listTournaments);
router.put('/tournaments/:id', requirePermission('competitions.manage'), adminUpdateTournament);
router.delete('/tournaments/:id', requirePermission('competitions.manage'), adminDeleteTournament);

// Analytics
router.get('/analytics', requirePermission('analytics.read'), getAnalytics);

// JonCoin moderation
router.get('/joncoin/pending', requirePermission('finance.read'), getPendingJonCoinTransactions);

// Invoices
router.get('/invoices/export.csv', requirePermission('export.finance'), exportInvoicesCsv);
router.get('/invoices', requirePermission('finance.read'), listInvoices);
router.get('/invoices/:id', requirePermission('finance.read'), getInvoice);

module.exports = router;
