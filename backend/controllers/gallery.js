const Gallery = require('../models/Gallery');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/gallery/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  },
});
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|svg|tiff|ico|heic|heif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

exports.upload = upload;

exports.getGallery = async (req, res) => {
  try {
    console.log('📸📸📸 GETGALLERY CALLED - User ID:', req.user.id);
    const gallery = await Gallery.findAll({ 
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    console.log('📸 Gallery items found:', gallery.length);
    console.log('📸 First item:', gallery[0]);
    res.json(gallery);
  } catch (err) {
    console.error('Gallery error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.getUserGallery = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if user exists
    const User = require('../models/User');
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    const gallery = await Gallery.findAll({ 
      where: { userId: userId },
      order: [['createdAt', 'DESC']]
    });
    
    res.json(gallery || []);
  } catch (err) {
    console.error('Get user gallery error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.createGalleryItem = async (req, res) => {
  try {
    const { title, description, type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    
    const fileUrl = '/uploads/gallery/' + req.file.filename;
    const isVideo = req.file.mimetype.startsWith('video/');
    
    const item = await Gallery.create({
      userId: req.user.id,
      title: title || 'Untitled',
      description: description || '',
      imageUrl: isVideo ? null : fileUrl,
      videoUrl: isVideo ? fileUrl : null,
      type: type || (isVideo ? 'video' : 'photo')
    });
    
    console.log('✅ Gallery item created:', item.id);
    res.json(item);
  } catch (err) {
    console.error('Create gallery item error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.deleteGalleryItem = async (req, res) => {
  try {
    const item = await Gallery.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    await item.destroy();
    res.json({ msg: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};