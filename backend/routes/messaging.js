const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const {
  getConversations,
  getOrCreateConversation,
  getConversationById,
  getMessages,
  searchMessages,
  sendMessage,
  markAsRead,
  createGroup,
  addGroupMembers,
  leaveGroup,
  updateGroup,
  updateGroupAvatar,
  removeGroupMember,
  setGroupMemberRole,
  transferGroupOwnership,
  editMessage,
  deleteMessage,
  toggleReaction,
  forwardMessage,
  ackDelivered,
} = require('../controllers/messaging');

// Configure multer for message file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/messages/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const extnameOk = /\.(jpe?g|png|gif|webp|pdf|docx?|mp4|mov|avi|webm|mp3|wav|ogg)$/i
      .test(path.extname(file.originalname));
    const mimetypeOk = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|x-msvideo|webm)|audio\/(mpeg|wav|ogg)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i
      .test(file.mimetype);
    if (extnameOk && mimetypeOk) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  },
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extnameOk = /\.(jpe?g|png|gif|webp)$/i.test(path.extname(file.originalname || ''));
    const mimetypeOk = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype || '');
    if (extnameOk && mimetypeOk) return cb(null, true);
    cb(new Error('Invalid file type'));
  },
});

function runUpload(uploader) {
  return (req, res, next) => {
    uploader(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ msg: 'Skedari është shumë i madh' });
      }
      return res.status(400).json({ msg: 'Ky lloj skedari nuk lejohet' });
    });
  };
}

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user?.id || 'anonymous'}`,
  handler: (_req, res) => {
    res.status(429).json({ msg: 'Shumë mesazhe. Provo përsëri pas pak.' });
  },
});

// Get all conversations for current user
router.get('/conversations', auth, getConversations);

// Get or create 1-on-1 conversation with specific user
router.get('/conversations/user/:userId', auth, getOrCreateConversation);

// Single conversation by id (member-only); path avoids clash with /conversations/user/...
router.get('/conversations/detail/:conversationId', auth, getConversationById);

// Create group conversation
router.post('/conversations/group', auth, createGroup);

// Invite members / leave group / manage group (admin checks are in the controller)
router.post('/conversations/:conversationId/members', auth, addGroupMembers);
router.delete('/conversations/:conversationId/members/:userId', auth, removeGroupMember);
router.put('/conversations/:conversationId/members/:userId/role', auth, setGroupMemberRole);
router.post('/conversations/:conversationId/transfer', auth, transferGroupOwnership);
router.post('/conversations/:conversationId/leave', auth, leaveGroup);
router.put('/conversations/:conversationId', auth, updateGroup);
router.post('/conversations/:conversationId/avatar', auth, runUpload(avatarUpload.single('avatar')), updateGroupAvatar);

// Get messages in a conversation
router.get('/conversations/:conversationId/messages/search', auth, searchMessages);
router.get('/conversations/:conversationId/messages', auth, getMessages);

// Send message
router.post('/conversations/:conversationId/messages', auth, sendLimiter, runUpload(upload.single('file')), sendMessage);

// Mark conversation as read
router.put('/conversations/:conversationId/read', auth, markAsRead);

// Edit message
router.put('/messages/:messageId', auth, editMessage);

// Delete message
router.delete('/messages/:messageId', auth, deleteMessage);

router.post('/messages/:messageId/reactions', auth, toggleReaction);
router.post('/messages/:messageId/forward', auth, forwardMessage);
router.post('/messages/:messageId/delivered', auth, ackDelivered);

module.exports = router;