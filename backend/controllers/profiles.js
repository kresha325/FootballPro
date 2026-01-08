const Profile = require('../models/Profile');
const User = require('../models/User');
const Gallery = require('../models/Gallery');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const { sendEmail } = require('../services/emailService');
const multer = require('multer');
const path = require('path');

// Configure multer for profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|svg|tiff|ico|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /image\//.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(null, true); // Allow all files to pass through
  }
});

exports.upload = upload;

exports.createProfile = async (req, res) => {
  try {
    // Check if profile already exists
    const existingProfile = await Profile.findOne({ where: { userId: req.user.id } });
    if (existingProfile) {
      return res.status(400).json({ msg: 'Profile already exists' });
    }

    // Create new profile
    const profile = await Profile.create({
      userId: req.user.id,
      bio: req.body.bio || '',
      city: req.body.city || '',
      country: req.body.country || '',
      club: req.body.club || '',
      position: req.body.position || '',
    });

    res.status(201).json(profile);
  } catch (err) {
    console.error('Create profile error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const profile = await Profile.findOne({ 
      where: { userId }, 
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'dateOfBirth', 'gender']
      }]
    });
    
    if (!profile) {
      return res.status(404).json({ msg: 'Profile not found' });
    }

    // Calculate age and age group
    const user = profile.User;
    const age = user.getAge ? user.getAge() : null;
    const ageGroup = user.getAgeGroup ? user.getAgeGroup() : null;
    
    // Get followers and following counts
    const followersCount = await Follow.count({ where: { followingId: userId } });
    const followingCount = await Follow.count({ where: { followerId: userId } });
    
    // Merge user data into profile response
    const response = {
      ...profile.toJSON(),
      id: profile.userId,
      firstName: profile.User.firstName,
      lastName: profile.User.lastName,
      email: profile.User.email,
      dateOfBirth: profile.User.dateOfBirth,
      gender: profile.User.gender,
      age,
      ageGroup,
      role: profile.User.role,
      followers: followersCount,
      following: followingCount
    };
    
    res.json(response);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    console.log('📝 UPDATE PROFILE - Body:', req.body);
    console.log('📁 UPDATE PROFILE - Files:', req.files);
    
    const { bio, city, country, club, position, stats, careerHistory, contact } = req.body;
    
    // Parse JSON strings if they exist
    const parsedStats = typeof stats === 'string' ? JSON.parse(stats) : stats;
    const parsedContact = typeof contact === 'string' ? JSON.parse(contact) : contact;
    const parsedCareerHistory = typeof careerHistory === 'string' ? JSON.parse(careerHistory) : careerHistory;
    
    const updateData = {
      bio,
      city,
      country,
      club,
      position,
      stats: parsedStats,
      careerHistory: parsedCareerHistory,
      contact: parsedContact,
    };
    
    // Handle file uploads and add to gallery
    if (req.files) {
      console.log('📷 Files received:', Object.keys(req.files));
      if (req.files.profilePhoto) {
        updateData.profilePhoto = '/uploads/profiles/' + req.files.profilePhoto[0].filename;
        console.log('✅ profilePhoto set to:', updateData.profilePhoto);
        
        // Add profile photo to gallery
        await Gallery.create({
          userId: req.user.id,
          title: 'Profile Photo',
          description: 'Profile photo',
          imageUrl: updateData.profilePhoto,
          type: 'photo'
        });
      }
      if (req.files.coverPhoto) {
        updateData.coverPhoto = '/uploads/profiles/' + req.files.coverPhoto[0].filename;
        console.log('✅ coverPhoto set to:', updateData.coverPhoto);
        
        // Add cover photo to gallery
        await Gallery.create({
          userId: req.user.id,
          title: 'Cover Photo',
          description: 'Cover photo',
          imageUrl: updateData.coverPhoto,
          type: 'photo'
        });
      }
    } else {
      console.log('❌ No files in request');
    }
    
    let profile = await Profile.findOne({ where: { userId: req.user.id } });
    
    if (!profile) {
      profile = await Profile.create({
        userId: req.user.id,
        ...updateData
      });
    } else {
      await profile.update(updateData);
    }
    
    // Also update user's basic info if provided
    if (req.body.firstName || req.body.lastName) {
      const user = await User.findByPk(req.user.id);
      if (user) {
        await user.update({
          firstName: req.body.firstName || user.firstName,
          lastName: req.body.lastName || user.lastName,
        });
      }
    }
    
    res.json(profile);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getAllProfiles = async (req, res) => {
  try {
    const { role, search, random, limit } = req.query;
    let whereClause = {};
    if (role) whereClause.role = role;

    // Exclude current user
    const excludeUserId = req.user?.id;

    // Build include for User model
    const userInclude = {
      model: User,
      attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'verified'],
      where: role ? { role } : {},
    };

    let profiles = await Profile.findAll({
      include: [userInclude],
      order: [['createdAt', 'DESC']]
    });

    // Merge user data into each profile
    let profilesWithUserData = profiles.map(profile => ({
      ...profile.toJSON(),
      id: profile.userId,
      firstName: profile.User.firstName,
      lastName: profile.User.lastName,
      email: profile.User.email,
      role: profile.User.role,
      verified: profile.User.verified
    }));

    // Exclude current user
    if (excludeUserId) {
      profilesWithUserData = profilesWithUserData.filter(p => p.id !== excludeUserId);
    }

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      profilesWithUserData = profilesWithUserData.filter(p => 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower) ||
        p.club?.toLowerCase().includes(searchLower) ||
        p.position?.toLowerCase().includes(searchLower) ||
        p.city?.toLowerCase().includes(searchLower)
      );
    }

    // Randomize and limit if requested
    if (random === 'true') {
      // Shuffle array
      for (let i = profilesWithUserData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [profilesWithUserData[i], profilesWithUserData[j]] = [profilesWithUserData[j], profilesWithUserData[i]];
      }
    }
    if (limit) {
      profilesWithUserData = profilesWithUserData.slice(0, parseInt(limit));
    }

    res.json(profilesWithUserData);
  } catch (err) {
    console.error('Get all profiles error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.registerPushToken = async (req, res) => {
  const { token, type } = req.body; // type: 'mobile' or 'web'
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (type === 'mobile') {
      user.pushTokenMobile = token;
    } else if (type === 'web') {
      user.pushTokenWeb = token; // token is the subscription object
    }
    await user.save();
    res.json({ msg: 'Push token registered' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Follow a user
exports.followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId);

    // Cannot follow yourself
    if (followerId === followingId) {
      return res.status(400).json({ msg: 'Cannot follow yourself' });
    }

    // Check if user to follow exists
    const userToFollow = await User.findByPk(followingId);
    if (!userToFollow) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      where: { followerId, followingId }
    });

    if (existingFollow) {
      return res.status(400).json({ msg: 'Already following this user' });
    }

    // Create follow relationship
    const follow = await Follow.create({
      followerId,
      followingId,
      status: 'accepted' // For now, auto-accept all follows
    });

    // Create notification
    const follower = await User.findByPk(followerId);
    await Notification.create({
      userId: followingId,
      actorId: followerId,
      type: 'follow',
      title: 'New Follower',
      message: `${follower.firstName} ${follower.lastName} started following you`,
      link: `/profile/${followerId}`
    });

    // Send email notification
    try {
      const followerName = `${follower.firstName} ${follower.lastName}`;
      await sendEmail(userToFollow.email, 'newFollower', followerName, followerId);
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
    }

    res.status(201).json({ msg: 'Successfully followed user', follow });
  } catch (err) {
    console.error('Follow user error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Unfollow a user
exports.unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId);

    const follow = await Follow.findOne({
      where: { followerId, followingId }
    });

    if (!follow) {
      return res.status(404).json({ msg: 'Not following this user' });
    }

    await follow.destroy();

    res.json({ msg: 'Successfully unfollowed user' });
  } catch (err) {
    console.error('Unfollow user error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get followers of a user
exports.getFollowers = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const followers = await Follow.findAll({
      where: { followingId: userId },
      include: [{
        model: User,
        as: 'follower',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        required: true,
        include: [{
          model: Profile,
          attributes: ['profilePhoto', 'bio', 'city', 'country']
        }]
      }]
    });

    // Filter out any null users
    const validFollowers = followers.filter(f => f.follower !== null);

    res.json(validFollowers);
  } catch (err) {
    console.error('Get followers error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get following of a user
exports.getFollowing = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const following = await Follow.findAll({
      where: { followerId: userId },
      include: [{
        model: User,
        as: 'following',
        attributes: ['id', 'firstName', 'lastName', 'email'],
        required: true,
        include: [{
          model: Profile,
          attributes: ['profilePhoto', 'bio', 'city', 'country']
        }]
      }]
    });

    // Filter out any null users
    const validFollowing = following.filter(f => f.following !== null);

    res.json(validFollowing);
  } catch (err) {
    console.error('Get following error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Check if current user is following another user
exports.checkFollowStatus = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId);

    const follow = await Follow.findOne({
      where: { followerId, followingId }
    });

    const reverseFollow = await Follow.findOne({
      where: { followerId: followingId, followingId: followerId }
    });

    res.json({
      isFollowing: !!follow,
      isFollowedBy: !!reverseFollow
    });
  } catch (err) {
    console.error('Check follow status error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};