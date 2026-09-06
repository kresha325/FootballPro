const express = require('express');
const router = express.Router();
const admin = require('../middleware/admin');
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
} = require('../controllers/admin');

// All admin routes require admin middleware
router.use(admin);

// User management
router.get('/users', getAllUsers);
router.put('/users/:userId/role', updateUserRole);
router.post('/users/:userId/ban', banUser);
router.post('/users/:userId/unban', unbanUser);
router.post('/users/:userId/verify', verifyUser);
router.post('/users/:userId/premium', togglePremium);
router.post('/users/:userId/reset-password', resetUserPassword);
router.delete('/users/:userId', deleteUser);

// Content management
router.get('/posts', getAllPosts);
router.delete('/posts/:postId', deletePost);

// Analytics
router.get('/analytics', getAnalytics);

// JonCoin moderation
router.get('/joncoin/pending', getPendingJonCoinTransactions);

// Invoices
router.get('/invoices/export.csv', exportInvoicesCsv);
router.get('/invoices', listInvoices);
router.get('/invoices/:id', getInvoice);

module.exports = router;
