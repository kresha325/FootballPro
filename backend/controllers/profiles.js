const Profile = require('../models/Profile');
const User = require('../models/User');
const Gallery = require('../models/Gallery');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const { sendEmail } = require('../services/emailService');
const ClubMember = require('../models/ClubMember');
const { Op } = require('sequelize');

const resolveClubUser = async ({ clubId, clubName }) => {
  let clubUser;

  if (clubId && !isNaN(Number(clubId))) {
    const clubById = await User.findByPk(parseInt(clubId));
    if (clubById && clubById.role === 'club') {
      clubUser = clubById;
    }
  }

  if (!clubUser && clubName) {
    const clubByUser = await User.findOne({
      where: {
        role: 'club',
        [Op.or]: [
          { firstName: { [Op.iLike]: `%${clubName}%` } },
          { lastName: { [Op.iLike]: `%${clubName}%` } },
          { email: { [Op.iLike]: `%${clubName}%` } },
        ],
      },
    });

    if (clubByUser) {
      clubUser = clubByUser;
    } else {
      const clubProfile = await Profile.findOne({
        where: {
          club: {
            [Op.iLike]: `%${clubName}%`,
          },
        },
        include: [{
          model: User,
          where: { role: 'club' },
        }],
      });

      if (clubProfile) {
        clubUser = clubProfile.User;
      }
    }
  }

  return clubUser;
};
const multer = require('multer');
const path = require('path');
const { toAbsoluteUploadsUrl } = require('../utils/url');

// Configure multer for profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
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
      clubId: req.body.clubId || null,
      position: req.body.position || '',
    });

    if (req.user?.role === 'athlete') {
      const clubName = req.body.club;
      const clubId = req.body.clubId;
      const clubUser = await resolveClubUser({ clubId, clubName });

      if (clubUser) {
        const existing = await ClubMember.findOne({
          where: {
            clubId: clubUser.id,
            athleteId: req.user.id,
          },
        });

        if (!existing) {
          await ClubMember.create({
            clubId: clubUser.id,
            athleteId: req.user.id,
            status: 'pending',
            position: req.body.position || null,
            jerseyNumber: req.body.stats?.jerseyNumber,
          });
        }
      }
    }

    res.status(201).json(profile);
  } catch (err) {
      console.error('Create profile error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    console.log('🔎 [getProfile] req.user:', req.user);
    console.log('🔎 [getProfile] req.params.id:', req.params.id);
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
    const age = user && user.getAge ? user.getAge() : null;
    const ageGroup = user && user.getAgeGroup ? user.getAgeGroup() : null;

    // Get followers and following counts
    const followersCount = await Follow.count({ where: { followingId: userId } });
    const followingCount = await Follow.count({ where: { followerId: userId } });

    // Clean profile object (avoid cyclic references)
    const plainProfile = profile.get({ plain: true });
    // Remove User object to avoid cycles
    delete plainProfile.User;

    // Merge user data into profile response
    // Add matches, achievements, media (dummy for now, replace with real fetch if needed)
    const response = {
      ...plainProfile,
      id: plainProfile.userId,
      firstName: user ? user.firstName : null,
      lastName: user ? user.lastName : null,
      email: user ? user.email : null,
      dateOfBirth: user ? user.dateOfBirth : null,
      gender: user ? user.gender : null,
      age,
      ageGroup,
      role: user ? user.role : null,
      followers: followersCount,
      following: followingCount,
      matches: plainProfile.matches || [],
      achievements: plainProfile.achievements || [],
      media: plainProfile.media || [],
      performanceTrend: plainProfile.performanceTrend || [],
    };
    // Standardize profilePhoto path for avatar
    if (response.profilePhoto) {
      response.profilePhoto = toAbsoluteUploadsUrl(req, response.profilePhoto);
    }
    if (response.coverPhoto) {
      response.coverPhoto = toAbsoluteUploadsUrl(req, response.coverPhoto);
    }
    if (response.clubLogo) {
      response.clubLogo = toAbsoluteUploadsUrl(req, response.clubLogo);
    }

    res.json(response);
  } catch (err) {
      console.error('Get profile error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  const cloudinary = require('../utils/cloudinary');
  const fs = require('fs');
  try {
    console.log('📝 UPDATE PROFILE - Body:', req.body);
    console.log('📁 UPDATE PROFILE - Files:', req.files);

    // Build updateData dynamically from req.body for Profile fields
    const profileFields = [
      'bio', 'city', 'country', 'club', 'clubId', 'clubLogo', 'position', 'stats', 'careerHistory', 'contact',
      // add more profile fields here if needed
    ];
    let updateData = {};
    for (const key in req.body) {
      if (profileFields.includes(key)) {
        // Parse JSON fields if needed
        if ((key === 'stats' || key === 'careerHistory' || key === 'contact') && typeof req.body[key] === 'string' && req.body[key].trim() !== '') {
          try {
            updateData[key] = JSON.parse(req.body[key]);
          } catch {
            updateData[key] = undefined;
          }
        } else {
          updateData[key] = req.body[key];
        }
      }
    }

    // Allow profilePhoto update from body (URL or string)
    if (req.body.profilePhoto) {
      updateData.profilePhoto = req.body.profilePhoto;
    }
    // Allow coverPhoto update from body (URL or string)
    if (req.body.coverPhoto) {
      updateData.coverPhoto = req.body.coverPhoto;
    }

    // Handle file uploads and add to gallery (Cloudinary)
    if (req.files) {
      console.log('📷 Files received:', Object.keys(req.files));
      if (req.files.profilePhoto) {
        let profilePublicId;
        if (req.body.profilePhoto) {
          updateData.profilePhoto = req.body.profilePhoto;
        } else {
          const file = req.files.profilePhoto[0];
          const cloudRes = await cloudinary.uploader.upload(file.path, {
            resource_type: 'image',
            folder: 'profile_photos',
          });
          // Remove local file
          fs.unlink(file.path, () => {});
          updateData.profilePhoto = cloudRes.secure_url;
          profilePublicId = cloudRes.public_id;
        }
        console.log('✅ profilePhoto set to:', updateData.profilePhoto);
        // Add profile photo to gallery
        try {
          await Gallery.create({
            userId: req.user.id,
            title: 'Profile Photo',
            description: 'Profile photo',
            imageUrl: updateData.profilePhoto,
            type: 'photo',
            ...(profilePublicId ? { publicId: profilePublicId } : {}),
          });
        } catch (galleryErr) {
          console.warn('Gallery create failed (profile photo):', galleryErr.message);
        }
      }
      if (req.files.coverPhoto) {
        let coverPublicId;
        // Prefer Cloudinary URL from middleware
        if (req.body.coverPhoto) {
          updateData.coverPhoto = req.body.coverPhoto;
        } else {
          const file = req.files.coverPhoto[0];
          const coverRes = await cloudinary.uploader.upload(file.path, {
            resource_type: 'image',
            folder: 'cover_photos',
          });
          fs.unlink(file.path, () => {});
          updateData.coverPhoto = coverRes.secure_url;
          coverPublicId = coverRes.public_id;
        }
        console.log('✅ coverPhoto set to:', updateData.coverPhoto);
        // Add cover photo to gallery
        try {
          await Gallery.create({
            userId: req.user.id,
            title: 'Cover Photo',
            description: 'Cover photo',
            imageUrl: updateData.coverPhoto,
            type: 'photo',
            ...(coverPublicId ? { publicId: coverPublicId } : {}),
          });
        } catch (galleryErr) {
          console.warn('Gallery create failed (cover photo):', galleryErr.message);
        }
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

    // Update all user base info if provided
    if (req.body.firstName || req.body.lastName || req.body.dateOfBirth || req.body.gender) {
      const user = await User.findByPk(req.user.id);
      if (user) {
        await user.update({
          firstName: req.body.firstName || user.firstName,
          lastName: req.body.lastName || user.lastName,
          dateOfBirth: req.body.dateOfBirth || user.dateOfBirth,
          gender: req.body.gender || user.gender,
        });
      }
    }

    if (req.user?.role === 'athlete') {
      const clubName = req.body.club || updateData.club;
      const clubId = req.body.clubId;

      if (clubId || clubName) {
        const clubUser = await resolveClubUser({ clubId, clubName });

        if (clubUser) {
          const existing = await ClubMember.findOne({
            where: {
              clubId: clubUser.id,
              athleteId: req.user.id,
            },
          });

          if (existing) {
            if (existing.status === 'rejected') {
              existing.status = 'pending';
              await existing.save();
            }
          } else {
            await ClubMember.create({
              clubId: clubUser.id,
              athleteId: req.user.id,
              status: 'pending',
              position: updateData.position,
              jerseyNumber: updateData?.stats?.jerseyNumber,
            });
          }
        }
      }
    }

    const response = profile.get ? profile.get({ plain: true }) : profile;
    if (response.profilePhoto) {
      response.profilePhoto = toAbsoluteUploadsUrl(req, response.profilePhoto);
    }
    if (response.coverPhoto) {
      response.coverPhoto = toAbsoluteUploadsUrl(req, response.coverPhoto);
    }
    res.json(response);
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
      attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'verified', 'dateOfBirth'],
      where: role ? { role } : {},
    };

    let profiles = await Profile.findAll({
      include: [userInclude],
      order: [['createdAt', 'DESC']]
    });


    // Merge user data into each profile dhe standardizo path-in e profilePhoto
    let profilesWithUserData = profiles.map(profile => {
      const obj = {
        ...profile.toJSON(),
        id: profile.userId,
        firstName: profile.User.firstName,
        lastName: profile.User.lastName,
        email: profile.User.email,
        role: profile.User.role,
        verified: profile.User.verified
      };
      // Standardizo path-in e profilePhoto si në getProfile
      let photo = obj.profilePhoto;
      if (!photo && profile.profilePhoto) photo = profile.profilePhoto;
      if (photo) {
        obj.profilePhoto = toAbsoluteUploadsUrl(req, photo);
      } else {
        obj.profilePhoto = null;
      }
      if (obj.clubLogo) {
        obj.clubLogo = toAbsoluteUploadsUrl(req, obj.clubLogo);
      }
      return obj;
    });

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