const Gallery = require('../models/Gallery');
const multer = require('multer');
const path = require('path');
const { toAbsoluteUploadsUrl } = require('../utils/url');
const { canView, canViewGalleryItem, normalizePrivacy } = require('../utils/profilePrivacy');

const GALLERY_ORDER = [
  ['featured', 'DESC'],
  ['sortOrder', 'ASC'],
  ['createdAt', 'DESC'],
];

function galleryVisibility(value) {
  const level = String(value || 'public').trim().toLowerCase();
  if (['public', 'followers', 'private'].includes(level)) return level;
  return null;
}

async function viewerForGallery(req, ownerId) {
  const { viewerAccess } = require('../utils/playerProfileCv');
  return viewerAccess(req, ownerId);
}

function presentGalleryItem(req, item) {
  const obj = item.toJSON ? item.toJSON() : item;
  if (obj.imageUrl) obj.imageUrl = toAbsoluteUploadsUrl(req, obj.imageUrl);
  if (obj.videoUrl) obj.videoUrl = toAbsoluteUploadsUrl(req, obj.videoUrl);
  return obj;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
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
      order: GALLERY_ORDER,
    });
    console.log('📸 Gallery items found:', gallery.length);
    console.log('📸 First item:', gallery[0]);
    
    // Standardizo path-et për gallery (ruaj URL absolute të Cloudinary)
    const galleryStandardized = (gallery || []).map(item => {
      const obj = item.toJSON();
      if (obj.imageUrl) {
        obj.imageUrl = toAbsoluteUploadsUrl(req, obj.imageUrl);
      }
      if (obj.videoUrl) {
        obj.videoUrl = toAbsoluteUploadsUrl(req, obj.videoUrl);
      }
      return obj;
    });
    res.json(galleryStandardized);
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
    
    const Profile = require('../models/Profile');
    const profile = await Profile.findOne({ where: { userId }, attributes: ['privacy'] });
    const privacy = normalizePrivacy(profile?.privacy);
    const viewer = await viewerForGallery(req, userId);
    if (!canView(privacy.gallery, viewer)) {
      return res.json([]);
    }

    const gallery = await Gallery.findAll({ 
      where: { userId: userId },
      order: GALLERY_ORDER,
    });
    
    const galleryStandardized = (gallery || [])
      .filter((item) => canViewGalleryItem(item, privacy, viewer))
      .map((item) => presentGalleryItem(req, item));
    res.json(galleryStandardized);
  } catch (err) {
    console.error('Get user gallery error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.createGalleryItem = async (req, res) => {
  const cloudinary = require('../utils/cloudinary');
  const fs = require('fs');
  try {
    const { title, description, type } = req.body;
    const visibility = galleryVisibility(req.body.visibility || 'public');
    if (!visibility) return res.status(400).json({ msg: 'Visibility must be public, followers, or private.' });
    const featured = req.body.featured === true || req.body.featured === 'true';
    const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded' });
    }
    const isVideo = req.file.mimetype.startsWith('video/');
    let cloudRes;
    if (isVideo) {
      cloudRes = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'gallery',
      });
    } else {
      cloudRes = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'image',
        folder: 'gallery',
      });
    }
    // Fshi file lokal pas upload
    fs.unlink(req.file.path, () => {});
    const item = await Gallery.create({
      userId: req.user.id,
      title: title || 'Untitled',
      description: description || '',
      imageUrl: isVideo ? null : cloudRes.secure_url,
      videoUrl: isVideo ? cloudRes.secure_url : null,
      type: type || (isVideo ? 'video' : 'photo'),
      visibility,
      featured,
      sortOrder,
      publicId: cloudRes.public_id,
    });
    console.log('✅ Gallery item created:', item.id);
    res.json(item);
  } catch (err) {
    console.error('Create gallery item error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.updateGalleryItem = async (req, res) => {
  try {
    const item = await Gallery.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    const { title, description, type, visibility, featured, sortOrder } = req.body || {};
    if (title != null) item.title = String(title).trim().slice(0, 255) || item.title;
    if (description != null) item.description = String(description).slice(0, 2000);
    if (type != null) {
      const nextType = String(type).toLowerCase();
      if (!['photo', 'video', 'highlight'].includes(nextType)) {
        return res.status(400).json({ msg: 'Type must be photo, video, or highlight.' });
      }
      item.type = nextType;
    }
    if (visibility != null) {
      const nextVisibility = galleryVisibility(visibility);
      if (!nextVisibility) return res.status(400).json({ msg: 'Visibility must be public, followers, or private.' });
      item.visibility = nextVisibility;
    }
    if (featured != null) item.featured = featured === true || featured === 'true';
    if (sortOrder != null && Number.isFinite(Number(sortOrder))) item.sortOrder = Number(sortOrder);
    await item.save();
    res.json(presentGalleryItem(req, item));
  } catch (err) {
    console.error('Update gallery item error:', err);
    res.status(500).json({ msg: 'Server error' });
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