const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markAsRead,
  createGroup,
  editMessage,
  deleteMessage,
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
    if (mimetypeOk || extnameOk) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  },
});

// Get all conversations for current user
router.get('/conversations', auth, getConversations);

// Get or create 1-on-1 conversation with specific user
router.get('/conversations/user/:userId', auth, getOrCreateConversation);

// Create group conversation
router.post('/conversations/group', auth, createGroup);

// Get messages in a conversation
router.get('/conversations/:conversationId/messages', auth, getMessages);

// Send message
router.post('/conversations/:conversationId/messages', auth, upload.single('file'), sendMessage);

// Mark conversation as read
router.put('/conversations/:conversationId/read', auth, markAsRead);

// Edit message
router.put('/messages/:messageId', auth, editMessage);

// Delete message
router.delete('/messages/:messageId', auth, deleteMessage);

module.exports = router;