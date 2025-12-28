const User = require('../models/User');
const Achievement = require('../models/Achievement');
const Badge = require('../models/Badge');
const Reward = require('../models/Reward');
const UserAchievement = require('../models/UserAchievement');
const UserBadge = require('../models/UserBadge');
const UserReward = require('../models/UserReward');
const Post = require('../models/Post');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Subscription = require('../models/Subscription');
const Profile = require('../models/Profile');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Get user gamification data
exports.getUserGamification = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const user = await User.findByPk(userId, {
      attributes: ['id', 'firstName', 'lastName', 'points', 'level', 'experience'],
      include: [{ model: Profile, attributes: ['profilePicture', 'position', 'club'] }],
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get achievements
    const achievements = await UserAchievement.findAll({
      where: { userId },
      include: [{ model: Achievement }],
      order: [['unlockedAt', 'DESC']],
    });

    // Get badges
    const badges = await UserBadge.findAll({
      where: { userId },
      include: [{ model: Badge }],
      order: [['earnedAt', 'DESC']],
    });

    // Calculate progress to next level
    const currentLevelXP = (user.level - 1) * 100;
    const nextLevelXP = user.level * 100;
    const progressToNextLevel = ((user.experience - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

    // Get user rank
    const rank = await User.count({
      where: { points: { [Op.gt]: user.points } },
    }) + 1;

    // Get recent activity (posts, likes in last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const recentPosts = await Post.count({
      where: { userId, createdAt: { [Op.gte]: last7Days } },
    });

    const recentLikes = await Like.count({
      where: { userId, createdAt: { [Op.gte]: last7Days } },
    });

    res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        points: user.points,
        level: user.level,
        experience: user.experience,
        progressToNextLevel: Math.round(progressToNextLevel),
        rank,
        profile: user.Profile,
      },
      achievements,
      badges,
      recentActivity: {
        posts: recentPosts,
        likes: recentLikes,
      },
    });
  } catch (error) {
    console.error('Get user gamification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const userId = req.user?.id;

    const users = await User.findAll({
      attributes: [
        'id',
        'firstName',
        'lastName',
        'points',
        'level',
        'experience',
        [sequelize.literal('(SELECT COUNT(*) FROM "Posts" WHERE "Posts"."userId" = "User"."id")'), 'postsCount'],
        [sequelize.literal('(SELECT COUNT(*) FROM "Subscriptions" WHERE "Subscriptions"."subscribedToId" = "User"."id")'), 'followersCount'],
      ],
      include: [
        { model: Profile, attributes: ['profilePicture'] },
        { model: UserBadge, include: [{ model: Badge }], limit: 3 },
      ],
      order: [['points', 'DESC']],
      limit: parseInt(limit),
    });

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      ...user.toJSON(),
    }));

    // Get current user data if not in top list
    let currentUser = null;
    if (userId && !leaderboard.find(u => u.id === userId)) {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'firstName', 'lastName', 'points', 'level', 'experience'],
        include: [{ model: Profile, attributes: ['profilePicture'] }],
      });
      
      if (user) {
        const rank = await User.count({
          where: { points: { [Op.gt]: user.points } },
        }) + 1;
        
        currentUser = { rank, ...user.toJSON() };
      }
    }

    res.json({ leaderboard, currentUser });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Award points
exports.awardPoints = async (userId, points, reason) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) return;

    const oldLevel = user.level;
    user.points += points;
    user.experience += points;

    // Calculate new level (100 XP per level)
    const newLevel = Math.floor(user.experience / 100) + 1;
    const leveledUp = newLevel > oldLevel;
    
    user.level = newLevel;
    await user.save();

    // Check for achievements
    await checkAchievements(userId);

    // Return level up info for notifications
    return { leveledUp, oldLevel, newLevel, points, reason };
  } catch (error) {
    console.error('Award points error:', error);
    return null;
  }
};

// Helper function to check achievements
async function checkAchievements(userId) {
  try {
    const achievements = await Achievement.findAll();
    
    // Get user stats
    const postsCount = await Post.count({ where: { userId } });
    const followersCount = await Subscription.count({ where: { subscribedToId: userId } });
    const likesCount = await Like.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
    });
    const commentsCount = await Comment.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
    });

    const user = await User.findByPk(userId, { attributes: ['level', 'points'] });

    for (const achievement of achievements) {
      const hasAchievement = await UserAchievement.findOne({
        where: { userId, achievementId: achievement.id },
      });

      if (!hasAchievement && achievement.criteria) {
        let unlocked = false;
        const criteria = achievement.criteria;

        switch (criteria.type) {
          case 'posts':
            unlocked = postsCount >= criteria.value;
            break;
          case 'followers':
            unlocked = followersCount >= criteria.value;
            break;
          case 'likes':
            unlocked = likesCount >= criteria.value;
            break;
          case 'comments':
            unlocked = commentsCount >= criteria.value;
            break;
          case 'level':
            unlocked = user.level >= criteria.value;
            break;
          case 'points':
            unlocked = user.points >= criteria.value;
            break;
        }

        if (unlocked) {
          await UserAchievement.create({
            userId,
            achievementId: achievement.id,
            unlockedAt: new Date(),
          });

          // Award badge if achievement has one
          if (criteria.badgeId) {
            const hasBadge = await UserBadge.findOne({
              where: { userId, badgeId: criteria.badgeId },
            });
            if (!hasBadge) {
              await UserBadge.create({
                userId,
                badgeId: criteria.badgeId,
                earnedAt: new Date(),
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Check achievements error:', error);
  }
}

// Get achievements
exports.getAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    const achievements = await Achievement.findAll({
      order: [['points', 'DESC']],
    });

    // Get user's unlocked achievements
    const userAchievements = await UserAchievement.findAll({
      where: { userId },
      attributes: ['achievementId', 'unlockedAt'],
    });

    const unlockedMap = {};
    userAchievements.forEach(ua => {
      unlockedMap[ua.achievementId] = ua.unlockedAt;
    });

    // Get user stats for progress
    const postsCount = await Post.count({ where: { userId } });
    const followersCount = await Subscription.count({ where: { subscribedToId: userId } });
    const likesCount = await Like.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
    });
    const commentsCount = await Comment.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
    });
    const user = await User.findByPk(userId, { attributes: ['level', 'points'] });

    // Add progress to each achievement
    const achievementsWithProgress = achievements.map(achievement => {
      const unlocked = !!unlockedMap[achievement.id];
      let progress = 0;

      if (!unlocked && achievement.criteria) {
        const criteria = achievement.criteria;
        let current = 0;

        switch (criteria.type) {
          case 'posts':
            current = postsCount;
            break;
          case 'followers':
            current = followersCount;
            break;
          case 'likes':
            current = likesCount;
            break;
          case 'comments':
            current = commentsCount;
            break;
          case 'level':
            current = user.level;
            break;
          case 'points':
            current = user.points;
            break;
        }

        progress = Math.min(100, Math.round((current / criteria.value) * 100));
      }

      return {
        ...achievement.toJSON(),
        unlocked,
        unlockedAt: unlockedMap[achievement.id] || null,
        progress,
      };
    });

    res.json(achievementsWithProgress);
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get badges
exports.getBadges = async (req, res) => {
  try {
    const userId = req.user.id;
    const badges = await Badge.findAll({
      order: [
        [sequelize.literal(`CASE 
          WHEN rarity = 'legendary' THEN 1 
          WHEN rarity = 'epic' THEN 2 
          WHEN rarity = 'rare' THEN 3 
          ELSE 4 
        END`), 'ASC'],
        ['name', 'ASC'],
      ],
    });

    const userBadges = await UserBadge.findAll({
      where: { userId },
      attributes: ['badgeId', 'earnedAt'],
    });

    const earnedMap = {};
    userBadges.forEach(ub => {
      earnedMap[ub.badgeId] = ub.earnedAt;
    });

    const badgesWithStatus = badges.map(badge => ({
      ...badge.toJSON(),
      earned: !!earnedMap[badge.id],
      earnedAt: earnedMap[badge.id] || null,
    }));

    res.json(badgesWithStatus);
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Claim reward
exports.claimReward = async (req, res) => {
  try {
    const { rewardId } = req.params;
    const userId = req.user.id;

    const reward = await Reward.findByPk(rewardId);
    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    // Check if already claimed
    const claimed = await UserReward.findOne({
      where: { userId, rewardId },
    });
    if (claimed) return res.status(400).json({ error: 'Reward already claimed' });

    // Check if user has required badge
    if (reward.badgeId) {
      const hasBadge = await UserBadge.findOne({
        where: { userId, badgeId: reward.badgeId },
      });
      if (!hasBadge) return res.status(403).json({ error: 'Badge required to claim this reward' });
    }

    // Claim reward
    await UserReward.create({ userId, rewardId, claimedAt: new Date() });

    // Award points if applicable
    if (reward.value) {
      await exports.awardPoints(userId, reward.value, 'Reward claimed');
    }

    res.json({ msg: 'Reward claimed successfully' });
  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
