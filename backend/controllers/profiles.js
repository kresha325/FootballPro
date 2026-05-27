const Profile = require('../models/Profile');
const User = require('../models/User');
const Gallery = require('../models/Gallery');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const { sendEmail } = require('../services/emailService');
const ClubMember = require('../models/ClubMember');
const ClubStaff = require('../models/ClubStaff');
const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { getCompletedLedgerBalance } = require('../utils/joncoinLedger');
const { Tournament, TournamentParticipant } = require('../models/Tournament');
const Match = require('../models/Match');
const MatchScorer = require('../models/MatchScorer');
const sequelize = require('../config/database');

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
const { normalizeYoutubeChannelId } = require('../utils/youtubeChannel');

/** Map free-text / locale labels to User.gender ENUM (male | female | other). */
function normalizeGenderInput(raw) {
  const t = String(raw ?? '').trim();
  if (t === '') return { value: null };
  const s = t.toLowerCase();
  const male = new Set(['m', 'male', 'mashkull', 'mask', 'masc', 'man', 'guy', 'männlich', 'mannlich']);
  const female = new Set(['f', 'female', 'femër', 'femer', 'femra', 'woman', 'girl', 'lady', 'frau', 'feminine']);
  const other = new Set(['o', 'other', 'tjetër', 'tjeter', 'prefer not', 'non-binary', 'nonbinary', 'nb']);
  if (male.has(s)) return { value: 'male' };
  if (female.has(s)) return { value: 'female' };
  if (other.has(s)) return { value: 'other' };
  return { invalid: true };
}

/** Accept YYYY-MM-DD only; invalid input must not reach Sequelize DATEONLY. */
function parseDateOnlyInput(raw) {
  const t = String(raw ?? '').trim();
  if (t === '') return { value: null };
  const s = t.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { invalid: true };
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { invalid: true };
  const [Y, M, D] = s.split('-').map(Number);
  if (d.getUTCFullYear() !== Y || d.getUTCMonth() + 1 !== M || d.getUTCDate() !== D) return { invalid: true };
  return { value: s };
}

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

    if (['coach', 'trajner'].includes(req.user?.role)) {
      const clubName = req.body.club;
      const clubId = req.body.clubId;
      const clubUser = await resolveClubUser({ clubId, clubName });

      if (clubUser) {
        if (profile) {
          await profile.update({ clubId: clubUser.id });
        }

        const existing = await ClubStaff.findOne({
          where: {
            clubId: clubUser.id,
            staffId: req.user.id,
          },
        });

        const category = req.body.coachCategory;
        const staffRoleMap = {
          general_trainer: 'head_coach',
          assistant_trainer: 'assistant_coach',
          fitness_trainer: 'fitness_coach',
          goalkeeper_trainer: 'goalkeeper_coach',
          technical_trainer: 'technical_coach',
          tactical_trainer: 'tactical_coach',
          psychological_trainer: 'sports_psychologist',
          youth_trainer: 'assistant_coach',
          rehabilitation_trainer: 'physiotherapist',
        };

        if (existing) {
          if (existing.status !== 'active') {
            existing.status = 'pending';
          }
          existing.staffRole = staffRoleMap[category] || existing.staffRole || 'assistant_coach';
          await existing.save();
        } else {
          await ClubStaff.create({
            clubId: clubUser.id,
            staffId: req.user.id,
            staffRole: staffRoleMap[category] || 'assistant_coach',
            teamType: 'first_team',
            status: 'pending',
          });
        }
      }
    }

    res.status(201).json(profile);
  } catch (err) {
      console.error('Create profile error:', err);
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
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
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'dateOfBirth', 'gender', 'joncoinBalance']
      }]
    });

    if (!profile) {
      return res.status(404).json({ msg: 'Profili nuk u gjet' });
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
    let joncoinBalance = 0;
    try {
      joncoinBalance = await getCompletedLedgerBalance(userId);
    } catch (_e) {
      joncoinBalance = user ? Math.round(parseFloat(user.joncoinBalance || 0) * 100) / 100 : 0;
    }

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
      joncoinBalance,
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
    if (Array.isArray(response.liveVideos) && response.liveVideos.length) {
      response.liveVideos = response.liveVideos.map((item) => {
        if (!item || typeof item !== 'object') return item;
        return {
          ...item,
          url: item.url ? toAbsoluteUploadsUrl(req, item.url) : item.url,
          thumbnail: item.thumbnail ? toAbsoluteUploadsUrl(req, item.thumbnail) : item.thumbnail,
        };
      });
    }

    res.json(response);
  } catch (err) {
      console.error('Get profile error:', err);
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.updateProfile = async (req, res) => {
  const cloudinary = require('../utils/cloudinary');
  const fs = require('fs');
  try {
    console.log('📝 UPDATE PROFILE - Body:', req.body);
    console.log('📁 UPDATE PROFILE - Files:', req.files);

    let nextGender = undefined;
    if (req.body.gender !== undefined) {
      const g = normalizeGenderInput(req.body.gender);
      if (g.invalid) {
        return res.status(400).json({
          msg: 'Invalid gender. Use male, female, or other (e.g. Mashkull / Femër / Other).',
          field: 'gender',
        });
      }
      nextGender = g.value;
    }
    let nextDateOfBirth = undefined;
    if (req.body.dateOfBirth !== undefined) {
      const dob = parseDateOnlyInput(req.body.dateOfBirth);
      if (dob.invalid) {
        return res.status(400).json({
          msg: 'Invalid date of birth. Use format YYYY-MM-DD.',
          field: 'dateOfBirth',
        });
      }
      nextDateOfBirth = dob.value;
    }

    // Build updateData dynamically from req.body for Profile fields
    const profileFields = [
      'bio',
      'city',
      'country',
      'club',
      'clubId',
      'clubLogo',
      'position',
      'stats',
      'careerHistory',
      'contact',
      'coachAffiliation',
      'coachCategory',
      'matches',
      'achievements',
    ];
    let updateData = {};
    for (const key in req.body) {
      if (profileFields.includes(key)) {
        if (key === 'clubId') {
          const parsed = parseInt(req.body[key], 10);
          if (!Number.isNaN(parsed) && parsed > 0) {
            updateData.clubId = parsed;
          }
          continue;
        }
        // Parse JSON fields if needed
        if (
          (key === 'stats' ||
            key === 'careerHistory' ||
            key === 'contact' ||
            key === 'matches' ||
            key === 'achievements') &&
          typeof req.body[key] === 'string' &&
          req.body[key].trim() !== ''
        ) {
          try {
            updateData[key] = JSON.parse(req.body[key]);
          } catch {
            // careerHistory is often plain text on the web form; keep the string
            updateData[key] = key === 'careerHistory' ? req.body[key] : undefined;
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

    if (req.body.youtubeChannelId !== undefined) {
      const v = String(req.body.youtubeChannelId ?? '').trim();
      if (!v) {
        updateData.youtubeChannelId = null;
      } else {
        const norm = normalizeYoutubeChannelId(v);
        if (!norm) {
          return res.status(400).json({
            msg: 'YouTube Channel ID i pavlefshëm. Duhet të fillojë me UC (~24 karaktere gjithsej) ose link youtube.com/channel/UC… ose përdor «Gjej ID nga linku».',
            field: 'youtubeChannelId',
          });
        }
        updateData.youtubeChannelId = norm;
      }
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
    const previousProfilePhoto = profile?.profilePhoto || null;
    const previousCoverPhoto = profile?.coverPhoto || null;

    if (!profile) {
      profile = await Profile.create({
        userId: req.user.id,
        ...updateData
      });
    } else {
      await profile.update(updateData);
    }

    const currentProfilePhoto = profile?.profilePhoto || null;
    const currentCoverPhoto = profile?.coverPhoto || null;
    const profilePhotoChanged =
      Boolean(currentProfilePhoto) && String(currentProfilePhoto) !== String(previousProfilePhoto || '');
    const coverPhotoChanged =
      Boolean(currentCoverPhoto) && String(currentCoverPhoto) !== String(previousCoverPhoto || '');

    if (profilePhotoChanged) {
      await Post.create({
        userId: req.user.id,
        content: 'Ndryshoi foton e profilit.',
        imageUrl: currentProfilePhoto,
      });
    }

    if (coverPhotoChanged) {
      await Post.create({
        userId: req.user.id,
        content: 'Ndryshoi foton e cover-it.',
        imageUrl: currentCoverPhoto,
      });
    }

    // Update User fields (ENUM/date validation — free-text gender used to cause 500 from Sequelize)
    const hasUserPatch =
      req.body.firstName !== undefined ||
      req.body.lastName !== undefined ||
      req.body.dateOfBirth !== undefined ||
      req.body.gender !== undefined;
    if (hasUserPatch) {
      const user = await User.findByPk(req.user.id);
      if (user) {
        const patch = {};
        if (req.body.firstName !== undefined) patch.firstName = req.body.firstName || user.firstName;
        if (req.body.lastName !== undefined) patch.lastName = req.body.lastName || user.lastName;
        if (nextGender !== undefined) patch.gender = nextGender;
        if (nextDateOfBirth !== undefined) patch.dateOfBirth = nextDateOfBirth;
        if (Object.keys(patch).length) {
          await user.update(patch);
        }
      }
    }

    if (req.user?.role === 'athlete') {
      const clubName = req.body.club || updateData.club;
      const clubId = req.body.clubId;

      if (clubId || clubName) {
        try {
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
        } catch (clubMemberError) {
          console.warn('Club member request error:', clubMemberError.message);
        }
      }
    }

    if (['coach', 'trajner'].includes(req.user?.role)) {
      const clubName = req.body.club || updateData.club;
      const clubId = req.body.clubId || updateData.clubId;

      if (clubId || clubName) {
        try {
          const clubUser = await resolveClubUser({ clubId, clubName });

          if (clubUser) {
            await profile.update({ clubId: clubUser.id });

            const existing = await ClubStaff.findOne({
              where: {
                clubId: clubUser.id,
                staffId: req.user.id,
              },
            });

            const normalizeCoachCategory = (value) => {
              const raw = String(value || '').toLowerCase();
              const map = {
                general_trainer: 'general_trainer',
                assistant_trainer: 'assistant_trainer',
                fitness_trainer: 'fitness_trainer',
                goalkeeper_trainer: 'goalkeeper_trainer',
                technical_trainer: 'technical_trainer',
                tactical_trainer: 'tactical_trainer',
                psychological_trainer: 'psychological_trainer',
                youth_trainer: 'youth_trainer',
                rehabilitation_trainer: 'rehabilitation_trainer',
                trajner_i_pergjithshem: 'general_trainer',
                trajner_i_përgjithshëm: 'general_trainer',
                trajner_ndihmes: 'assistant_trainer',
                trajner_ndihmës: 'assistant_trainer',
                trajner_fizik: 'fitness_trainer',
                trajner_i_portiereve: 'goalkeeper_trainer',
                trajner_i_portierëve: 'goalkeeper_trainer',
                trajner_teknik: 'technical_trainer',
                trajner_taktik: 'tactical_trainer',
                trajner_psikologjik: 'psychological_trainer',
                trajner_i_te_rinjve: 'youth_trainer',
                trajner_i_të_rinjve: 'youth_trainer',
                trajner_rehabilitimi: 'rehabilitation_trainer',
              };
              return map[raw] || value;
            };
            const category = normalizeCoachCategory(req.body.coachCategory || updateData.coachCategory);
            const staffRoleMap = {
              general_trainer: 'head_coach',
              assistant_trainer: 'assistant_coach',
              fitness_trainer: 'fitness_coach',
              goalkeeper_trainer: 'goalkeeper_coach',
              technical_trainer: 'technical_coach',
              tactical_trainer: 'tactical_coach',
              psychological_trainer: 'sports_psychologist',
              youth_trainer: 'assistant_coach',
              rehabilitation_trainer: 'physiotherapist',
            };

            if (existing) {
              existing.status = 'pending';
              existing.staffRole = staffRoleMap[category] || existing.staffRole || 'assistant_coach';
              existing.teamType = existing.teamType || 'first_team';
              await existing.save();
            } else {
              await ClubStaff.create({
                clubId: clubUser.id,
                staffId: req.user.id,
                staffRole: staffRoleMap[category] || 'assistant_coach',
                teamType: 'first_team',
                status: 'pending',
              });
            }
          }
        } catch (clubStaffError) {
          console.warn('Club staff request error:', clubStaffError.message);
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
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
  }
};

exports.getAllProfiles = async (req, res) => {
  try {
    const { role, search, random, limit } = req.query;
    const normalizedRole = role ? String(role).toLowerCase() : null;
    const filterRoleInJs = (itemRole) => {
      const r = String(itemRole || '').toLowerCase();
      if (!normalizedRole) return true;
      if (normalizedRole === 'club') return r === 'club';
      if (normalizedRole === 'coach') return ['coach', 'trajner'].includes(r);
      return r === normalizedRole;
    };

    // Exclude current user
    const excludeUserId = req.user?.id;

    // Build include for User model
    const userInclude = {
      model: User,
      attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'verified', 'dateOfBirth'],
      where: role && !['club', 'coach'].includes(normalizedRole) ? { role } : {},
      required: true,
    };

    let profiles = [];
    try {
      profiles = await Profile.findAll({
        include: [userInclude],
        order: [['createdAt', 'DESC']]
      });
    } catch (includeError) {
      console.warn('Get all profiles include error, falling back:', includeError.message);
      const baseProfiles = await Profile.findAll({ order: [['createdAt', 'DESC']] });
      const userIds = baseProfiles.map(p => p.userId).filter(Boolean);
      const users = await User.findAll({ where: { id: userIds } });
      const userMap = new Map(users.map(u => [u.id, u]));
      profiles = baseProfiles
        .map(p => {
          p.User = userMap.get(p.userId);
          return p;
        })
        .filter(p => p.User);
    }


    // Merge user data into each profile dhe standardizo path-in e profilePhoto
    let profilesWithUserData = profiles
      .filter(profile => profile && profile.User)
      .map(profile => {
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

    if (role) {
      profilesWithUserData = profilesWithUserData.filter(p => filterRoleInJs(p.role));
    }

    // Exclude current user
    if (excludeUserId) {
      profilesWithUserData = profilesWithUserData.filter(p => p.id !== excludeUserId);
    }

    profilesWithUserData = profilesWithUserData.filter(
      (p) => !String(p.email || '').includes('@footballpro-smoke.invalid')
    );

    // Apply search filter if provided
    if (search) {
      const searchLower = String(search).toLowerCase();
      const safeLower = (value) => (typeof value === 'string' ? value.toLowerCase() : String(value || '').toLowerCase());
      profilesWithUserData = profilesWithUserData.filter(p =>
        safeLower(`${p.firstName} ${p.lastName}`).includes(searchLower) ||
        safeLower(p.club).includes(searchLower) ||
        safeLower(p.position).includes(searchLower) ||
        safeLower(p.city).includes(searchLower)
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
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

exports.registerPushToken = async (req, res) => {
  const { token, type } = req.body; // type: 'mobile' or 'web'
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ msg: 'Përdoruesi nuk u gjet' });

    if (type === 'mobile') {
      user.pushTokenMobile = token;
    } else if (type === 'web') {
      user.pushTokenWeb = token; // token is the subscription object
    }
    await user.save();
    res.json({ msg: 'Push token registered' });
  } catch (err) {
    res.status(500).json({ msg: 'Gabim në server' });
  }
};

// Follow a user
exports.followUser = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId);

    // Cannot follow yourself
    if (followerId === followingId) {
      return res.status(400).json({ msg: 'Nuk mund ta ndiqni veten' });
    }

    // Check if user to follow exists
    const userToFollow = await User.findByPk(followingId);
    if (!userToFollow) {
      return res.status(404).json({ msg: 'Përdoruesi nuk u gjet' });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      where: { followerId, followingId }
    });

    if (existingFollow) {
      return res.status(400).json({ msg: 'Tashmë po e ndiqni këtë përdorues' });
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
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
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
      return res.status(404).json({ msg: 'Nuk po e ndiqni këtë përdorues' });
    }

    await follow.destroy();

    res.json({ msg: 'Ndjekja u hoq me sukses' });
  } catch (err) {
    console.error('Unfollow user error:', err);
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
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
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
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
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
  }
};

function sortTournamentStandingRows(rows) {
  return [...rows].sort((a, b) => {
    const pa = a.points ?? 0;
    const pb = b.points ?? 0;
    if (pb !== pa) return pb - pa;
    const gda = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0);
    const gdb = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0);
    if (gdb !== gda) return gdb - gda;
    const gfa = a.goalsFor ?? 0;
    const gfb = b.goalsFor ?? 0;
    if (gfb !== gfa) return gfb - gfa;
    return (b.wins ?? 0) - (a.wins ?? 0);
  });
}

exports.getUserTournamentSummary = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ msg: 'ID e përdoruesit është e pavlefshme' });
    }

    const participations = await TournamentParticipant.findAll({
      where: {
        userId,
        status: { [Op.in]: ['accepted', 'pending'] },
      },
      order: [['updatedAt', 'DESC']],
    });

    if (!participations.length) {
      return res.json({
        userId,
        tournaments: [],
        totals: { points: 0, goalsFor: 0, scorerGoals: 0, scorerAssists: 0, tournamentsPlayed: 0 },
      });
    }

    const tournamentIds = [...new Set(participations.map((p) => p.tournamentId).filter(Boolean))];
    const tournamentRows = await Tournament.findAll({ where: { id: tournamentIds } });
    const tournamentById = Object.fromEntries(tournamentRows.map((t) => [t.id, t]));

    const scorerRows = await MatchScorer.findAll({
      attributes: [
        [col('Match.tournamentId'), 'tournamentId'],
        [fn('SUM', col('MatchScorer.goals')), 'scorerGoals'],
      ],
      include: [{ model: Match, attributes: [], required: true, where: { tournamentId: { [Op.in]: tournamentIds } } }],
      where: { userId },
      group: [col('Match.tournamentId')],
      raw: true,
    });
    const scorerGoalsByTournament = {};
    for (const row of scorerRows) {
      scorerGoalsByTournament[row.tournamentId] = Number(row.scorerGoals) || 0;
    }

    const assistRows = await MatchScorer.findAll({
      attributes: [
        [col('Match.tournamentId'), 'tournamentId'],
        [fn('COUNT', col('MatchScorer.id')), 'scorerAssists'],
      ],
      include: [{ model: Match, attributes: [], required: true, where: { tournamentId: { [Op.in]: tournamentIds } } }],
      where: { assistUserId: userId },
      group: [col('Match.tournamentId')],
      raw: true,
    });
    const assistsByTournament = {};
    for (const row of assistRows) {
      assistsByTournament[row.tournamentId] = Number(row.scorerAssists) || 0;
    }

    const allParticipants = await TournamentParticipant.findAll({
      where: { tournamentId: tournamentIds, status: 'accepted' },
    });
    const participantsByTournament = {};
    for (const p of allParticipants) {
      if (!participantsByTournament[p.tournamentId]) participantsByTournament[p.tournamentId] = [];
      participantsByTournament[p.tournamentId].push(p);
    }

    const tournaments = [];
    for (const p of participations) {
      const t = tournamentById[p.tournamentId];
      if (!t) continue;

      const tableRows = sortTournamentStandingRows(
        (participantsByTournament[p.tournamentId] || []).map((ap) => {
          const gf = Number(ap.goalsFor) || 0;
          const ga = Number(ap.goalsAgainst) || 0;
          return {
            userId: ap.userId,
            points: Number(ap.points) || 0,
            wins: Number(ap.wins) || 0,
            draws: Number(ap.draws) || 0,
            losses: Number(ap.losses) || 0,
            goalsFor: gf,
            goalsAgainst: ga,
            goalDifference: gf - ga,
          };
        })
      );
      const rankIdx = tableRows.findIndex((r) => Number(r.userId) === userId);
      const myRow = tableRows[rankIdx] || {
        points: Number(p.points) || 0,
        wins: Number(p.wins) || 0,
        draws: Number(p.draws) || 0,
        losses: Number(p.losses) || 0,
        goalsFor: Number(p.goalsFor) || 0,
        goalsAgainst: Number(p.goalsAgainst) || 0,
        goalDifference: (Number(p.goalsFor) || 0) - (Number(p.goalsAgainst) || 0),
      };

      tournaments.push({
        tournamentId: t.id,
        tournamentName: t.name,
        tournamentSeason: t.season || null,
        tournamentType: t.type,
        tournamentStatus: t.status,
        participantStatus: p.status,
        rank: rankIdx >= 0 ? rankIdx + 1 : null,
        points: myRow.points,
        wins: myRow.wins,
        draws: myRow.draws,
        losses: myRow.losses,
        goalsFor: myRow.goalsFor,
        goalsAgainst: myRow.goalsAgainst,
        goalDifference: myRow.goalDifference,
        scorerGoals: scorerGoalsByTournament[t.id] ?? 0,
        scorerAssists: assistsByTournament[t.id] ?? 0,
        played: (myRow.wins || 0) + (myRow.draws || 0) + (myRow.losses || 0),
      });
    }

    res.json({
      userId,
      tournaments,
      totals: {
        points: tournaments.reduce((sum, row) => sum + (row.points || 0), 0),
        goalsFor: tournaments.reduce((sum, row) => sum + (row.goalsFor || 0), 0),
        scorerGoals: tournaments.reduce((sum, row) => sum + (row.scorerGoals || 0), 0),
        scorerAssists: tournaments.reduce((sum, row) => sum + (row.scorerAssists || 0), 0),
        tournamentsPlayed: tournaments.length,
      },
    });
  } catch (err) {
    console.error('getUserTournamentSummary:', err);
    res.status(500).json({ msg: 'Gabim në server' });
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
    res.status(500).json({ msg: 'Gabim në server', error: err.message });
  }
};