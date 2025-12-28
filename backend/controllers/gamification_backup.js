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

    // Get achievements with unlock date
    const achievements = await UserAchievement.findAll({
      where: { userId },
      include: [{ model: Achievement }],
      order: [['unlockedAt', 'DESC']],
    });

    // Get badges with unlock date
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

    // Get total users for rank calculation
    const totalUsers = await User.count();

    // Get recent activities that earned XP
    const recentPosts = await Post.count({
      where: { userId, createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });

    const recentLikes = await Like.count({
      include: [{ model: Post, where: { userId }, attributes: [] }],
      where: { createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });

    res.json({
      user: {
        ...user.toJSON(),
        progressToNextLevel: Math.round(progressToNextLevel),
        rank,
        totalUsers,
        recentActivity: {
          posts: recentPosts,
          likesReceived: recentLikes,
        },
      },
      achievements: achievements.map(ua => ({
        ...ua.Achievement.toJSON(),
        unlockedAt: ua.unlockedAt,
      })),
      badges: badges.map(ub => ({
        ...ub.Badge.toJSON(),
        earnedAt: ub.earnedAt,
      })),
    });
  } catch (error) {
    console.error('Get gamification error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const { timeframe = 'all', limit = 50 } = req.query;
    const currentUserId = req.user.id;

    let whereClause = {};
    if (timeframe === 'week') {
      whereClause.createdAt = { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    } else if (timeframe === 'month') {
      whereClause.createdAt = { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    }

    const users = await User.findAll({
      attributes: [
        'id',
        'firstName',
        'lastName',
        'points',
        'level',
        'experience',
        [sequelize.literal('(SELECT COUNT(*) FROM "Posts" WHERE "Posts"."userId" = "User"."id")'), 'postsCount'],
        [sequelize.literal('(SELECT COUNT(*) FROM "Subscriptions" WHERE "subscribedToId" = "User"."id")'), 'followersCount'],
      ],
      include: [
        {
          model: Profile,
          attributes: ['profilePicture', 'position', 'club', 'country'],
        },
        {
          model: UserBadge,
          include: [{ model: Badge }],
          separate: true,
          limit: 3,
          order: [['earnedAt', 'DESC']],
        },
      ],
      order: [['points', 'DESC'], ['level', 'DESC']],
      limit: parseInt(limit),
    });

    // Add rank to each user
    const leaderboard = users.map((user, index) => ({
      ...user.toJSON(),
      rank: index + 1,
      isCurrentUser: user.id === currentUserId,
    }));

    // Get current user's rank if not in top list
    const currentUserRank = await User.count({
      where: { points: { [Op.gt]: (await User.findByPk(currentUserId)).points } },
    }) + 1;

    let currentUserData = null;
    if (currentUserRank > parseInt(limit)) {
      const currentUser = await User.findByPk(currentUserId, {
        attributes: [
          'id',
          'firstName',
          'lastName',
          'points',
          'level',
          'experience',
        ],
        include: [
          {
            model: Profile,
            attributes: ['profilePicture', 'position', 'club', 'country'],
          },
        ],
      });
      currentUserData = {
        ...currentUser.toJSON(),
        rank: currentUserRank,
        isCurrentUser: true,
      };
    }

    res.json({
      leaderboard,
      currentUser: currentUserData,
      totalUsers: await User.count(),
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Award points to user
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
      let current = 0;
      let required = 0;

      if (!unlocked && achievement.criteria) {
        const criteria = achievement.criteria;
        if (criteria.type === 'posts') {
          current = postsCount;
          required = criteria.count;
        } else if (criteria.type === 'followers') {
          current = followersCount;
          required = criteria.count;
        } else if (criteria.type === 'likes') {
          current = likesCount;
          required = criteria.count;
        } else if (criteria.type === 'comments') {
          current = commentsCount;
          required = criteria.count;
        } else if (criteria.type === 'level') {
          current = user.level;
          required = criteria.level;
        } else if (criteria.type === 'points') {
          current = user.points;
          required = criteria.points;
        }
        progress = Math.min((current / required) * 100, 100);
      } else if (unlocked) {
        progress = 100;
      }

      return {
        ...achievement.toJSON(),
        unlocked,
        unlockedAt: unlockedMap[achievement.id] || null,
        progress: Math.round(progress),
        current,
        required,
      };
    });

    res.json(achievementsWithProgress);
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all badges with user status
exports.getBadges = async (req, res) => {
  try {
    const userId = req.user.id;
    const badges = await Badge.findAll({
      order: [
        [sequelize.literal("CASE WHEN rarity = 'legendary' THEN 1 WHEN rarity = 'epic' THEN 2 WHEN rarity = 'rare' THEN 3 ELSE 4 END"), 'ASC'],
        ['name', 'ASC'],
      ],
    });

    // Get user's earned badges
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
          await UserAchievement.create({
            userId,
            achievementId: achievement.id,
            unlockedAt: new Date(),
          });

          // Award achievement XP (avoid infinite loop by not calling awardPoints)
          if (achievement.experience) {
            user.experience += achievement.experience;
            user.points += achievement.points || 0;
            user.level = Math.floor(user.experience / 100) + 1;
            await user.save();
          }

          // Award badge if specified
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
    const { action } = req.body;

    const xpRewards = {
      post_created: 10,
      post_liked: 5,
      post_commented: 8,
      profile_completed: 50,
      first_follower: 20,
      milestone_10_followers: 50,
      milestone_50_followers: 100,
      milestone_100_followers: 200,
      daily_login: 5,
      tournament_joined: 15,
      tournament_won: 100,
      match_played: 10,
    };

    const xp = xpRewards[action] || 0;
    if (xp === 0) return res.status(400).json({ error: 'Invalid action' });

    const result = await exports.awardPoints(userId, xp, action);
    res.json(result);
  } catch (error) {
    console.error('Award XP error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Check and unlock achievements
const checkAchievements = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    const achievements = await Achievement.findAll();
    for (const achievement of achievements) {
      const hasAchievement = await UserAchievement.findOne({
        where: { userId, achievementId: achievement.id },
      });
      if (!hasAchievement) {
        // Simplified check - in real app, check criteria
        if (achievement.criteria && user.points >= achievement.criteria.points) {
          await UserAchievement.create({ userId, achievementId: achievement.id });
          await exports.awardPoints(userId, achievement.points, 'Achievement unlocked');
        }
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
  }
};

// Get all achievements
exports.getAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.findAll();
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all badges
exports.getBadges = async (req, res) => {
  try {
    const badges = await Badge.findAll();
    res.json(badges);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Claim reward
exports.claimReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rewardId } = req.body;
    const reward = await Reward.findByPk(rewardId);
    if (!reward) return res.status(404).json({ error: 'Reward not found' });

    const hasClaimed = await UserReward.findOne({ where: { userId, rewardId } });
    if (hasClaimed) return res.status(400).json({ error: 'Reward already claimed' });

    await UserReward.create({ userId, rewardId });
    // Apply reward
    if (reward.type === 'points') {
      await exports.awardPoints(userId, reward.value, 'Reward claimed');
    } else if (reward.type === 'badge') {
      await UserBadge.create({ userId, badgeId: reward.badgeId });
    }
    res.json({ message: 'Reward claimed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};