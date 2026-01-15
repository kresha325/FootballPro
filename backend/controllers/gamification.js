
const { User, Achievement, Badge, Reward, UserAchievement, UserBadge, UserReward, Post, Like, Comment, Subscription } = require('../models');
const sequelize = require('sequelize');

// Utility: Award points to user
exports.awardPoints = async (userId, points, reason = '') => {
  const user = await User.findByPk(userId);
  if (!user) return;
  user.points += points;
  // Level up logic (example: every 1000 points = 1 level)
  const newLevel = Math.floor(user.points / 1000) + 1;
  if (newLevel > user.level) user.level = newLevel;
  await user.save();
  // Optionally log reason
};

// Main: Get user gamification status
exports.getUserGamification = async (req, res) => {
  try {
    const userId = req.user.id;
    // User stats
    const postsCount = await Post.count({ where: { userId } });
    const followersCount = await Subscription.count({ where: { subscribedToId: userId } });
    const likesCount = await Like.count({ include: [{ model: Post, where: { userId }, attributes: [] }] });
    const commentsCount = await Comment.count({ include: [{ model: Post, where: { userId }, attributes: [] }] });
    const user = await User.findByPk(userId, { attributes: ['level', 'points'] });

    // Milestones
    const participationMilestones = [10, 50, 100, 500, 1000];
    const likeMilestones = [100, 1000, 10000, 100000, 1000000];

    // Award participation badges/achievements
    for (const milestone of participationMilestones) {
      const badgeName = `Participation ${milestone}`;
      let badge = await Badge.findOne({ where: { name: badgeName } });
      if (!badge) {
        badge = await Badge.create({
          name: badgeName,
          description: `Arritje për pjesëmarrje në ${milestone} ndeshje!`,
          icon: '⚽',
          rarity: 'rare',
        });
      }
      let achievement = await Achievement.findOne({ where: { name: badgeName } });
      if (!achievement) {
        achievement = await Achievement.create({
          name: badgeName,
          description: `Arritje për pjesëmarrje në ${milestone} ndeshje!`,
          icon: '⚽',
          criteria: { type: 'participation', value: milestone, badgeId: badge.id },
        });
      }
      const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!hasAchievement && postsCount >= milestone) {
        await UserAchievement.create({ userId, achievementId: achievement.id, unlockedAt: new Date() });
        const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
        if (!hasBadge) {
          await UserBadge.create({ userId, badgeId: badge.id, earnedAt: new Date() });
        }
      }
    }

    // Award like badges/achievements
    for (const milestone of likeMilestones) {
      const badgeName = `Likes ${milestone}`;
      let badge = await Badge.findOne({ where: { name: badgeName } });
      if (!badge) {
        badge = await Badge.create({
          name: badgeName,
          description: `Arritje për ${milestone} pelqime të marra në total në postimet e tua!`,
          icon: '👍',
          rarity: 'rare',
        });
      }
      let achievement = await Achievement.findOne({ where: { name: badgeName } });
      if (!achievement) {
        achievement = await Achievement.create({
          name: badgeName,
          description: `Arritje për ${milestone} pelqime të marra në total në postimet e tua!`,
          icon: '👍',
          criteria: { type: 'likes', value: milestone, badgeId: badge.id },
        });
      }
      const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!hasAchievement && likesCount >= milestone) {
        await UserAchievement.create({ userId, achievementId: achievement.id, unlockedAt: new Date() });
        const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
        if (!hasBadge) {
          await UserBadge.create({ userId, badgeId: badge.id, earnedAt: new Date() });
        }
      }
    }

    // Check all achievements for unlock
    const achievements = await Achievement.findAll();
    for (const achievement of achievements) {
      const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!hasAchievement && achievement.criteria) {
        let unlocked = false;
        const criteria = achievement.criteria;
        switch (criteria.type) {
          case 'posts': unlocked = postsCount >= criteria.value; break;
          case 'followers': unlocked = followersCount >= criteria.value; break;
          case 'likes': unlocked = likesCount >= criteria.value; break;
          case 'comments': unlocked = commentsCount >= criteria.value; break;
          case 'level': unlocked = user.level >= criteria.value; break;
          case 'points': unlocked = user.points >= criteria.value; break;
        }
        if (unlocked) {
          await UserAchievement.create({ userId, achievementId: achievement.id, unlockedAt: new Date() });
          if (criteria.badgeId) {
            const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: criteria.badgeId } });
            if (!hasBadge) {
              await UserBadge.create({ userId, badgeId: criteria.badgeId, earnedAt: new Date() });
            }
          }
        }
      }
    }

    res.json({ level: user.level, points: user.points, postsCount, followersCount, likesCount, commentsCount });
  } catch (error) {
    console.error('Get user gamification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get achievements
exports.getAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    const achievements = await Achievement.findAll({ order: [['points', 'DESC']] });
    const userAchievements = await UserAchievement.findAll({ where: { userId }, attributes: ['achievementId', 'unlockedAt'] });
    const unlockedMap = {};
    userAchievements.forEach(ua => { unlockedMap[ua.achievementId] = ua.unlockedAt; });
    const postsCount = await Post.count({ where: { userId } });
    const followersCount = await Subscription.count({ where: { subscribedToId: userId } });
    const likesCount = await Like.count({ include: [{ model: Post, where: { userId }, attributes: [] }] });
    const commentsCount = await Comment.count({ include: [{ model: Post, where: { userId }, attributes: [] }] });
    const user = await User.findByPk(userId, { attributes: ['level', 'points'] });
    const achievementsWithProgress = achievements.map(achievement => {
      const unlocked = !!unlockedMap[achievement.id];
      let progress = 0;
      if (!unlocked && achievement.criteria) {
        const criteria = achievement.criteria;
        let current = 0;
        switch (criteria.type) {
          case 'posts': current = postsCount; break;
          case 'followers': current = followersCount; break;
          case 'likes': current = likesCount; break;
          case 'comments': current = commentsCount; break;
          case 'level': current = user.level; break;
          case 'points': current = user.points; break;
        }
        progress = Math.min(100, Math.round((current / criteria.value) * 100));
      }
      return { ...achievement.toJSON(), unlocked, unlockedAt: unlockedMap[achievement.id] || null, progress };
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
        [sequelize.literal(`CASE WHEN rarity = 'legendary' THEN 1 WHEN rarity = 'epic' THEN 2 WHEN rarity = 'rare' THEN 3 ELSE 4 END`), 'ASC'],
        ['name', 'ASC'],
      ],
    });
    const userBadges = await UserBadge.findAll({ where: { userId }, attributes: ['badgeId', 'earnedAt'] });
    const earnedMap = {};
    userBadges.forEach(ub => { earnedMap[ub.badgeId] = ub.earnedAt; });
    const badgesWithStatus = badges.map(badge => ({ ...badge.toJSON(), earned: !!earnedMap[badge.id], earnedAt: earnedMap[badge.id] || null }));
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
    const claimed = await UserReward.findOne({ where: { userId, rewardId } });
    if (claimed) return res.status(400).json({ error: 'Reward already claimed' });
    if (reward.badgeId) {
      const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: reward.badgeId } });
      if (!hasBadge) return res.status(403).json({ error: 'Badge required to claim this reward' });
    }
    await UserReward.create({ userId, rewardId, claimedAt: new Date() });
    if (reward.value) {
      await exports.awardPoints(userId, reward.value, 'Reward claimed');
    }
    res.json({ msg: 'Reward claimed successfully' });
  } catch (error) {
    console.error('Claim reward error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
          if (streak5) {
            const badgeName = '5 Wins Streak';
            let badge = await Badge.findOne({ where: { name: badgeName } });
            if (!badge) {
              badge = await Badge.create({
                name: badgeName,
                description: 'Arritje për 5 fitore radhazi!',
                icon: '🔥',
                rarity: 'epic',
              });
            }
            let achievement = await Achievement.findOne({ where: { name: badgeName } });
            if (!achievement) {
              achievement = await Achievement.create({
                name: badgeName,
                description: 'Arritje për 5 fitore radhazi!',
                icon: '🔥',
                criteria: { type: 'streak', value: 5, badgeId: badge.id },
              });
            }
            const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
            if (!hasAchievement) {
              await UserAchievement.create({
                userId,
                achievementId: achievement.id,
                unlockedAt: new Date(),
              });
              const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
              if (!hasBadge) {
                await UserBadge.create({
                  userId,
                  badgeId: badge.id,
                  earnedAt: new Date(),
                });
              }
            }
          }
      // Arritje sportive automatike
      // 1. Fitore ndeshje
      const winMilestones = [1, 5, 10, 50, 100];
      const winCount = await Post.count({ where: { userId, type: 'win' } }); // ose perdor modelin tuaj te ndeshjeve
      for (const milestone of winMilestones) {
        const badgeName = `Wins ${milestone}`;
        let badge = await Badge.findOne({ where: { name: badgeName } });
        if (!badge) {
          badge = await Badge.create({
            name: badgeName,
            description: `Arritje për ${milestone} fitore në ndeshje!`,
            icon: '🏆',
            rarity: 'epic',
          });
        }
        let achievement = await Achievement.findOne({ where: { name: badgeName } });
        if (!achievement) {
          achievement = await Achievement.create({
            name: badgeName,
            description: `Arritje për ${milestone} fitore në ndeshje!`,
            icon: '🏆',
            criteria: { type: 'wins', value: milestone, badgeId: badge.id },
          });
        }
        const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
        if (!hasAchievement && winCount >= milestone) {
          await UserAchievement.create({
            userId,
            achievementId: achievement.id,
            unlockedAt: new Date(),
          });
          const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
          if (!hasBadge) {
            await UserBadge.create({
              userId,
              badgeId: badge.id,
              earnedAt: new Date(),
            });
          }
        }
      }

      // 2. Streak fitore (5 fitore radhazi)
      // Kjo kerkon logjike shtese sipas modelit tuaj te ndeshjeve
      // 3. Fair Play
      const fairPlayBadge = await Badge.findOrCreate({
        where: { name: 'Fair Play' },
        defaults: {
          description: 'Arritje për sjellje të shkëlqyer sportive!',
          icon: '🤝',
          rarity: 'rare',
        }
      });
      // Jepni manualisht ose me logjike te dedikuar sipas rastit

      // 4. Top 3 Leaderboard
      const leaderboardBadge = await Badge.findOrCreate({
        where: { name: 'Top 3 Leaderboard' },
        defaults: {
          description: 'Arritje për renditje në top 3 të leaderboard!',
          icon: '🥇',
          rarity: 'legendary',
        }
      });
      // Jepni kur useri hyn ne top 3 (logjike ne update leaderboard)

      // 5. Pjesemarrje ne ndeshje
      const participationMilestones = [1, 10, 50, 100];
      const participationCount = await Post.count({ where: { userId, type: 'match' } }); // ose modelin tuaj te pjesemarrjes
      for (const milestone of participationMilestones) {
        const badgeName = `Participation ${milestone}`;
        let badge = await Badge.findOne({ where: { name: badgeName } });
        if (!badge) {
          badge = await Badge.create({
            name: badgeName,
            description: `Arritje për pjesëmarrje në ${milestone} ndeshje!`,
            icon: '⚽',
            rarity: 'common',
          });
        }
        let achievement = await Achievement.findOne({ where: { name: badgeName } });
        if (!achievement) {
          achievement = await Achievement.create({
            name: badgeName,
            description: `Arritje për pjesëmarrje në ${milestone} ndeshje!`,
            icon: '⚽',
            criteria: { type: 'participation', value: milestone, badgeId: badge.id },
          });
        }
        const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
        if (!hasAchievement && participationCount >= milestone) {
          await UserAchievement.create({
            userId,
            achievementId: achievement.id,
            unlockedAt: new Date(),
          });
          const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
          if (!hasBadge) {
            await UserBadge.create({
              userId,
              badgeId: badge.id,
              earnedAt: new Date(),
            });
          }
        }
      }
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

    // Likes milestones: 100, 1,000, 10,000, 100,000, 1,000,000
    const likeMilestones = [100, 1000, 10000, 100000, 1000000];
    for (const milestone of likeMilestones) {
      const badgeName = `Likes ${milestone}`;
      // Kontrollo nëse ekziston badge/achievement për këtë milestone
      let badge = await Badge.findOne({ where: { name: badgeName } });
      if (!badge) {
        badge = await Badge.create({
          name: badgeName,
          description: `Arritje për ${milestone} pelqime të marra në total në postimet e tua!`,
          icon: '👍',
          rarity: 'rare',
        });
      }
      let achievement = await Achievement.findOne({ where: { name: badgeName } });
      if (!achievement) {
        achievement = await Achievement.create({
          name: badgeName,
          description: `Arritje për ${milestone} pelqime të marra në total në postimet e tua!`,
          icon: '👍',
          criteria: { type: 'likes', value: milestone, badgeId: badge.id },
        });
      }
      // Jep badge/achievement nëse milestone është arritur
      const hasAchievement = await UserAchievement.findOne({ where: { userId, achievementId: achievement.id } });
      if (!hasAchievement && likesCount >= milestone) {
        await UserAchievement.create({
          userId,
          achievementId: achievement.id,
          unlockedAt: new Date(),
        });
        const hasBadge = await UserBadge.findOne({ where: { userId, badgeId: badge.id } });
        if (!hasBadge) {
          await UserBadge.create({
            userId,
            badgeId: badge.id,
            earnedAt: new Date(),
          });
        }
      }
    }

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
  };
  

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

