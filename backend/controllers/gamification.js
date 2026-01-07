// Award XP for real actions (idempotent, anti-abuse)
exports.awardXPEvent = async (userId, action, meta = {}) => {
  // Shembull: action = 'complete_profile', 'join_match', 'win_match', 'daily_login'
  // meta mund të jetë { matchId: 123 }
  const XP_VALUES = {
    complete_profile: 50,
    join_match: 100,
    win_match: 200,
    daily_login: 5,
    create_post: 10,
    create_comment: 2,
    fair_play: 30,
    streak_5_matches: 50,
    top3_leaderboard: 100,
  };
  const points = XP_VALUES[action];
  if (!points) return;

  // Idempotency: kontrollo nëse është dhënë XP për këtë event
  const rewardKey = `${action}_${meta.matchId || ''}`;
  const [event, created] = await UserReward.findOrCreate({
    where: { userId, rewardId: rewardKey },
    defaults: { claimedAt: new Date() }
  });
  if (!created) return; // XP është dhënë më parë

  // Anti-abuse për daily_login
  if (action === 'daily_login') {
    const today = new Date().toISOString().slice(0, 10);
    if (event.claimedAt && event.claimedAt.toISOString().slice(0, 10) === today) return;
  }

  // Jep XP
  await exports.awardPoints(userId, points, action);
};
const { User, Achievement, Badge, Reward, UserAchievement, UserBadge, UserReward, Post, Like, Comment, Subscription, Profile } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Get user gamification data
exports.getUserGamification = async (req, res) => {
  try {
    const userId = req.params.userId || (req.user && req.user.id);
    if (!userId) {
      console.error('Gamification: No userId found in request. req.user:', req.user, 'req.params:', req.params);
      return res.status(400).json({ error: 'No userId provided' });
    }
    const user = await User.findByPk(userId, {
      attributes: ['id', 'firstName', 'lastName', 'points', 'level', 'experience'],
      include: [{ model: Profile, attributes: ['profilePicture', 'position', 'club'] }],
    });
    if (!user) {
      console.error('Gamification: User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    let achievements = [];
    let badges = [];
    let recentPosts = 0;
    let recentLikes = 0;
    let rank = 0;
    try {
      achievements = await UserAchievement.findAll({
        where: { userId },
        include: [{ model: Achievement }],
        order: [['unlockedAt', 'DESC']],
      });
      if (!achievements) achievements = [];
    } catch (err) {
      console.error('Gamification: Error loading achievements:', err);
      achievements = [];
    }
    try {
      badges = await UserBadge.findAll({
        where: { userId },
        include: [{ model: Badge }],
        order: [['earnedAt', 'DESC']],
      });
      if (!badges) badges = [];
    } catch (err) {
      console.error('Gamification: Error loading badges:', err);
      badges = [];
    }
    let progressToNextLevel = 0;
    try {
      const currentLevelXP = (user.level - 1) * 100;
      const nextLevelXP = user.level * 100;
      progressToNextLevel = ((user.experience - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    } catch (err) {
      console.error('Gamification: Error calculating XP progress:', err, 'user:', user);
      progressToNextLevel = 0;
    }
    try {
      rank = await User.count({
        where: { points: { [Op.gt]: user.points } },
      }) + 1;
    } catch (err) {
      console.error('Gamification: Error calculating rank:', err, 'user:', user);
    }
    try {
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);
      recentPosts = await Post.count({
        where: { userId, createdAt: { [Op.gte]: last7Days } },
      });
      recentLikes = await Like.count({
        where: { userId, createdAt: { [Op.gte]: last7Days } },
      });
    } catch (err) {
      console.error('Gamification: Error loading recent activity:', err, 'user:', user);
    }
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
    console.error('Get user gamification error:', error, '\nRequest user:', req.user, '\nRequest params:', req.params, '\nRequest headers:', req.headers, '\nStack:', error.stack);
    res.status(500).json({ error: 'Server error', details: error?.message, stack: error?.stack });
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
                                                                      // 17. Arritje për fitore pa faull
                                                                      if (lastWin && lastWin.events && Array.isArray(lastWin.events)) {
                                                                        const fouls = lastWin.events.filter(ev => ev.type === 'foul' && ev.userId === userId).length;
                                                                        if (fouls === 0) {
                                                                          const badgeName = 'Fair Play Winner';
                                                                          let badge = await Badge.findOne({ where: { name: badgeName } });
                                                                          if (!badge) {
                                                                            badge = await Badge.create({
                                                                              name: badgeName,
                                                                              description: 'Arritje për fitore pa bërë asnjë faull!',
                                                                              icon: '🤝',
                                                                              rarity: 'rare',
                                                                            });
                                                                          }
                                                                          let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                                                          if (!achievement) {
                                                                            achievement = await Achievement.create({
                                                                              name: badgeName,
                                                                              description: 'Arritje për fitore pa bërë asnjë faull!',
                                                                              icon: '🤝',
                                                                              criteria: { type: 'fair_play_win', badgeId: badge.id },
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
                                                                      }
                                                                  // 16. Arritje për rikthim nga humbja në pjesën e dytë
                                                                  // Supozon që Match ka evente me minutë dhe rezultat gjatë ndeshjes
                                                                  if (lastWin && lastWin.events && Array.isArray(lastWin.events)) {
                                                                    // Gjej rezultatin në fillim të pjesës së dytë (minuta 46)
                                                                    let myGoals = 0, oppGoals = 0;
                                                                    lastWin.events.forEach(ev => {
                                                                      if (ev.type === 'goal') {
                                                                        if (ev.userId === userId) myGoals++;
                                                                        else oppGoals++;
                                                                      }
                                                                      if (ev.minute && ev.minute === 45) {
                                                                        ev.halftimeMyGoals = myGoals;
                                                                        ev.halftimeOppGoals = oppGoals;
                                                                      }
                                                                    });
                                                                    // Gjej rezultatin në pushim
                                                                    const halftime = lastWin.events.find(ev => ev.halftimeMyGoals !== undefined);
                                                                    if (halftime) {
                                                                      const losingAtHalf = halftime.halftimeMyGoals < halftime.halftimeOppGoals;
                                                                      if (losingAtHalf) {
                                                                        const badgeName = 'Second Half Comeback';
                                                                        let badge = await Badge.findOne({ where: { name: badgeName } });
                                                                        if (!badge) {
                                                                          badge = await Badge.create({
                                                                            name: badgeName,
                                                                            description: 'Arritje për fitore pas disavantazhit në pjesën e dytë!',
                                                                            icon: '⏱️',
                                                                            rarity: 'epic',
                                                                          });
                                                                        }
                                                                        let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                                                        if (!achievement) {
                                                                          achievement = await Achievement.create({
                                                                            name: badgeName,
                                                                            description: 'Arritje për fitore pas disavantazhit në pjesën e dytë!',
                                                                            icon: '⏱️',
                                                                            criteria: { type: 'second_half_comeback', badgeId: badge.id },
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
                                                                    }
                                                                  }
                                                              // 15. Arritje për fitore në finale
                                                              // Supozon që Match ka fushën isFinale
                                                              const lastFinalWin = await Match.findOne({
                                                                where: { winnerUserId: userId, isFinale: true },
                                                                order: [['matchDate', 'DESC']]
                                                              });
                                                              if (lastFinalWin) {
                                                                const badgeName = 'Final Winner';
                                                                let badge = await Badge.findOne({ where: { name: badgeName } });
                                                                if (!badge) {
                                                                  badge = await Badge.create({
                                                                    name: badgeName,
                                                                    description: 'Arritje për fitore në finale!',
                                                                    icon: '🥇',
                                                                    rarity: 'legendary',
                                                                  });
                                                                }
                                                                let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                                                if (!achievement) {
                                                                  achievement = await Achievement.create({
                                                                    name: badgeName,
                                                                    description: 'Arritje për fitore në finale!',
                                                                    icon: '🥇',
                                                                    criteria: { type: 'final_win', badgeId: badge.id },
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
                                                          // 14. Arritje për pjesëmarrje në 100 ndeshje
                                                          const totalMatches = await Match.count({
                                                            where: {
                                                              [sequelize.Op.or]: [
                                                                { homeUserId: userId },
                                                                { awayUserId: userId }
                                                              ]
                                                            }
                                                          });
                                                          if (totalMatches >= 100) {
                                                            const badgeName = '100 Matches';
                                                            let badge = await Badge.findOne({ where: { name: badgeName } });
                                                            if (!badge) {
                                                              badge = await Badge.create({
                                                                name: badgeName,
                                                                description: 'Arritje për pjesëmarrje në 100 ndeshje!',
                                                                icon: '💯',
                                                                rarity: 'legendary',
                                                              });
                                                            }
                                                            let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                                            if (!achievement) {
                                                              achievement = await Achievement.create({
                                                                name: badgeName,
                                                                description: 'Arritje për pjesëmarrje në 100 ndeshje!',
                                                                icon: '💯',
                                                                criteria: { type: 'matches_played', value: 100, badgeId: badge.id },
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
                                                      // 13. Arritje për MVP (lojtari me më shumë pikë në ndeshje)
                                                      // Supozon që ekziston një fushë points ose një mënyrë për të llogaritur pikët për çdo lojtar në ndeshje
                                                      if (lastPlayed && lastPlayed.players && Array.isArray(lastPlayed.players)) {
                                                        // players: [{ userId, points }]
                                                        const maxPoints = Math.max(...lastPlayed.players.map(p => p.points || 0));
                                                        const isMVP = lastPlayed.players.some(p => p.userId === userId && (p.points || 0) === maxPoints && maxPoints > 0);
                                                        if (isMVP) {
                                                          const badgeName = 'MVP';
                                                          let badge = await Badge.findOne({ where: { name: badgeName } });
                                                          if (!badge) {
                                                            badge = await Badge.create({
                                                              name: badgeName,
                                                              description: 'Arritje për MVP të ndeshjes!',
                                                              icon: '🏆',
                                                              rarity: 'epic',
                                                            });
                                                          }
                                                          let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                                          if (!achievement) {
                                                            achievement = await Achievement.create({
                                                              name: badgeName,
                                                              description: 'Arritje për MVP të ndeshjes!',
                                                              icon: '🏆',
                                                              criteria: { type: 'mvp', badgeId: badge.id },
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
                                                      }
                                                  // 12. Arritje për asistues (3+ asiste në një ndeshje)
                                                  if (lastPlayed && lastPlayed.events && Array.isArray(lastPlayed.events)) {
                                                    const assists = lastPlayed.events.filter(ev => ev.type === 'assist' && ev.userId === userId).length;
                                                    if (assists >= 3) {
                                                      const badgeName = 'Playmaker';
                                                      let badge = await Badge.findOne({ where: { name: badgeName } });
                                                      if (!badge) {
                                                        badge = await Badge.create({
                                                          name: badgeName,
                                                          description: 'Arritje për 3+ asiste në një ndeshje!',
                                                          icon: '🎩',
                                                          rarity: 'rare',
                                                        });
                                                      }
                                                      let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                                      if (!achievement) {
                                                        achievement = await Achievement.create({
                                                          name: badgeName,
                                                          description: 'Arritje për 3+ asiste në një ndeshje!',
                                                          icon: '🎩',
                                                          criteria: { type: 'playmaker', value: 3, badgeId: badge.id },
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
                                                  }
                                              // 11. Arritje për clean sheet si portier (pa pësuar gol në një ndeshje)
                                              // Supozon që Match ka fushën goalkeeperUserId për secilën skuadër
                                              if (lastPlayed) {
                                                let isGoalie = false;
                                                let cleanSheet = false;
                                                if (lastPlayed.homeGoalkeeperId === userId) {
                                                  isGoalie = true;
                                                  cleanSheet = lastPlayed.awayGoals === 0;
                                                } else if (lastPlayed.awayGoalkeeperId === userId) {
                                                  isGoalie = true;
                                                  cleanSheet = lastPlayed.homeGoals === 0;
                                                }
                                                if (isGoalie && cleanSheet) {
                                                  const badgeName = 'Clean Sheet (GK)';
                                                  let badge = await Badge.findOne({ where: { name: badgeName } });
                                                  if (!badge) {
                                                    badge = await Badge.create({
                                                      name: badgeName,
                                                      description: 'Arritje për clean sheet si portier!',
                                                      icon: '🧤',
                                                      rarity: 'rare',
                                                    });
                                                  }
                                                  let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                                  if (!achievement) {
                                                    achievement = await Achievement.create({
                                                      name: badgeName,
                                                      description: 'Arritje për clean sheet si portier!',
                                                      icon: '🧤',
                                                      criteria: { type: 'clean_sheet_gk', badgeId: badge.id },
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
                                              }
                                          // 10. Arritje për super-sub (gol si zëvendësues)
                                          if (lastPlayed && lastPlayed.events && Array.isArray(lastPlayed.events)) {
                                            // Supozon që eventet kanë tipin 'substitution' dhe 'goal', dhe substitution ka userId të zëvendësuesit
                                            const wasSub = lastPlayed.events.some(ev => ev.type === 'substitution' && ev.userId === userId);
                                            const scored = lastPlayed.events.some(ev => ev.type === 'goal' && ev.userId === userId);
                                            if (wasSub && scored) {
                                              const badgeName = 'Super-Sub';
                                              let badge = await Badge.findOne({ where: { name: badgeName } });
                                              if (!badge) {
                                                badge = await Badge.create({
                                                  name: badgeName,
                                                  description: 'Arritje për gol si zëvendësues!',
                                                  icon: '🔁',
                                                  rarity: 'rare',
                                                });
                                              }
                                              let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                              if (!achievement) {
                                                achievement = await Achievement.create({
                                                  name: badgeName,
                                                  description: 'Arritje për gol si zëvendësues!',
                                                  icon: '🔁',
                                                  criteria: { type: 'super_sub', badgeId: badge.id },
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
                                          }
                                      // 9. Arritje për poker (4 gola në një ndeshje)
                                      if (lastPlayed && lastPlayed.events && Array.isArray(lastPlayed.events)) {
                                        const goals = lastPlayed.events.filter(ev => ev.type === 'goal' && ev.userId === userId).length;
                                        if (goals >= 4) {
                                          const badgeName = 'Poker';
                                          let badge = await Badge.findOne({ where: { name: badgeName } });
                                          if (!badge) {
                                            badge = await Badge.create({
                                              name: badgeName,
                                              description: 'Arritje për 4 gola në një ndeshje!',
                                              icon: '🎯',
                                              rarity: 'epic',
                                            });
                                          }
                                          let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                          if (!achievement) {
                                            achievement = await Achievement.create({
                                              name: badgeName,
                                              description: 'Arritje për 4 gola në një ndeshje!',
                                              icon: '🎯',
                                              criteria: { type: 'poker', value: 4, badgeId: badge.id },
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
                                      }
                                  // 8. Arritje për hat-trick (3 gola në një ndeshje)
                                  // Kontrollo ndeshjen e fundit të userId
                                  const lastPlayed = await Match.findOne({
                                    where: {
                                      [sequelize.Op.or]: [
                                        { homeUserId: userId },
                                        { awayUserId: userId }
                                      ]
                                    },
                                    order: [['matchDate', 'DESC']]
                                  });
                                  if (lastPlayed && lastPlayed.events && Array.isArray(lastPlayed.events)) {
                                    const goals = lastPlayed.events.filter(ev => ev.type === 'goal' && ev.userId === userId).length;
                                    if (goals >= 3) {
                                      const badgeName = 'Hat-trick';
                                      let badge = await Badge.findOne({ where: { name: badgeName } });
                                      if (!badge) {
                                        badge = await Badge.create({
                                          name: badgeName,
                                          description: 'Arritje për 3 gola në një ndeshje!',
                                          icon: '⚽',
                                          rarity: 'rare',
                                        });
                                      }
                                      let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                      if (!achievement) {
                                        achievement = await Achievement.create({
                                          name: badgeName,
                                          description: 'Arritje për 3 gola në një ndeshje!',
                                          icon: '⚽',
                                          criteria: { type: 'hat_trick', value: 3, badgeId: badge.id },
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
                                  }
                              // 7. Arritje për debutim me gol (shënon gol në ndeshjen e parë të luajtur)
                              // Gjej ndeshjen e parë të userId
                              const firstMatch = await Match.findOne({
                                where: {
                                  [sequelize.Op.or]: [
                                    { homeUserId: userId },
                                    { awayUserId: userId }
                                  ]
                                },
                                order: [['matchDate', 'ASC']]
                              });
                              if (firstMatch && firstMatch.events && Array.isArray(firstMatch.events)) {
                                // Kontrollo nëse userId ka shënuar gol në këtë ndeshje
                                const scored = firstMatch.events.some(ev => ev.type === 'goal' && ev.userId === userId);
                                if (scored) {
                                  const badgeName = 'Debut Goal';
                                  let badge = await Badge.findOne({ where: { name: badgeName } });
                                  if (!badge) {
                                    badge = await Badge.create({
                                      name: badgeName,
                                      description: 'Arritje për gol në debutim!',
                                      icon: '🥇',
                                      rarity: 'rare',
                                    });
                                  }
                                  let achievement = await Achievement.findOne({ where: { name: badgeName } });
                                  if (!achievement) {
                                    achievement = await Achievement.create({
                                      name: badgeName,
                                      description: 'Arritje për gol në debutim!',
                                      icon: '🥇',
                                      criteria: { type: 'debut_goal', badgeId: badge.id },
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
                              }
                          // 6. Arritje për "kthesë të madhe" (fitore pasi ka qenë në disavantazh me 2+ gola)
                          // Supozon që Match ka një array events ose një mënyrë për të parë rezultatin gjatë ndeshjes
                          // Nëse modeli Match nuk ka evente, ky kod është shembull logjike që mund të përshtatet
                          if (lastWin && lastWin.events && Array.isArray(lastWin.events)) {
                            // Gjej nëse userId ka qenë në disavantazh me 2+ gola
                            let deficit = 0;
                            let myGoals = 0;
                            let oppGoals = 0;
                            lastWin.events.forEach(ev => {
                              if (ev.type === 'goal') {
                                if (ev.userId === userId) myGoals++;
                                else oppGoals++;
                              }
                              deficit = Math.max(deficit, oppGoals - myGoals);
                            });
                            if (deficit >= 2) {
                              const badgeName = 'Big Comeback';
                              let badge = await Badge.findOne({ where: { name: badgeName } });
                              if (!badge) {
                                badge = await Badge.create({
                                  name: badgeName,
                                  description: 'Arritje për fitore pas disavantazhit 2+ gola!',
                                  icon: '🔄',
                                  rarity: 'epic',
                                });
                              }
                              let achievement = await Achievement.findOne({ where: { name: badgeName } });
                              if (!achievement) {
                                achievement = await Achievement.create({
                                  name: badgeName,
                                  description: 'Arritje për fitore pas disavantazhit 2+ gola!',
                                  icon: '🔄',
                                  criteria: { type: 'comeback', value: 2, badgeId: badge.id },
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
                          }
                      // 5. Arritje për fitore me rezultat të thellë (fitore me +5 gola diferencë)
                      // Kontrollo ndeshjen e fundit të fituar
                      const lastWin = await Match.findOne({
                        where: { winnerUserId: userId },
                        order: [['matchDate', 'DESC']]
                      });
                      let bigWin = false;
                      if (lastWin) {
                        let goalDiff = 0;
                        if (lastWin.homeUserId === userId) goalDiff = lastWin.homeGoals - lastWin.awayGoals;
                        else if (lastWin.awayUserId === userId) goalDiff = lastWin.awayGoals - lastWin.homeGoals;
                        bigWin = goalDiff >= 5;
                      }
                      if (bigWin) {
                        const badgeName = 'Big Win (+5 Goals)';
                        let badge = await Badge.findOne({ where: { name: badgeName } });
                        if (!badge) {
                          badge = await Badge.create({
                            name: badgeName,
                            description: 'Arritje për fitore me +5 gola diferencë!',
                            icon: '⚡',
                            rarity: 'rare',
                          });
                        }
                        let achievement = await Achievement.findOne({ where: { name: badgeName } });
                        if (!achievement) {
                          achievement = await Achievement.create({
                            name: badgeName,
                            description: 'Arritje për fitore me +5 gola diferencë!',
                            icon: '⚡',
                            criteria: { type: 'big_win', value: 5, badgeId: badge.id },
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
                  // 4. Streak fitore të pastër (3 ndeshje radhazi pa pësuar gol)
                  // Supozon që Match ka fushat: winnerUserId, homeUserId, awayUserId, homeGoals, awayGoals
                  const last3Wins = await Match.findAll({
                    where: { winnerUserId: userId },
                    order: [['matchDate', 'DESC']],
                    limit: 3
                  });
                  let cleanSheetStreak = false;
                  if (last3Wins.length === 3) {
                    cleanSheetStreak = last3Wins.every(m => {
                      if (m.homeUserId === userId) return m.awayGoals === 0;
                      if (m.awayUserId === userId) return m.homeGoals === 0;
                      return false;
                    });
                  }
                  if (cleanSheetStreak) {
                    const badgeName = '3 Clean Sheet Streak';
                    let badge = await Badge.findOne({ where: { name: badgeName } });
                    if (!badge) {
                      badge = await Badge.create({
                        name: badgeName,
                        description: 'Arritje për 3 fitore radhazi pa pësuar gol!',
                        icon: '🧤',
                        rarity: 'epic',
                      });
                    }
                    let achievement = await Achievement.findOne({ where: { name: badgeName } });
                    if (!achievement) {
                      achievement = await Achievement.create({
                        name: badgeName,
                        description: 'Arritje për 3 fitore radhazi pa pësuar gol!',
                        icon: '🧤',
                        criteria: { type: 'clean_sheet_streak', value: 3, badgeId: badge.id },
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
              // 3. Streak pjesëmarrjesh (10 ndeshje radhazi të luajtura)
              // Merr 10 ndeshjet e fundit të luajtura nga userId
              const last10Matches = await Match.findAll({
                where: {
                  [sequelize.Op.or]: [
                    { homeUserId: userId },
                    { awayUserId: userId }
                  ]
                },
                order: [['matchDate', 'DESC']],
                limit: 10
              });
              let streak10 = false;
              if (last10Matches.length === 10) {
                // Kontrollo që nuk ka asnjë ndeshje të humbur (forfeited, DNF, etj.)
                streak10 = last10Matches.every(m => m.status === 'finished');
              }
              if (streak10) {
                const badgeName = '10 Participation Streak';
                let badge = await Badge.findOne({ where: { name: badgeName } });
                if (!badge) {
                  badge = await Badge.create({
                    name: badgeName,
                    description: 'Arritje për 10 ndeshje radhazi të luajtura!',
                    icon: '🏅',
                    rarity: 'rare',
                  });
                }
                let achievement = await Achievement.findOne({ where: { name: badgeName } });
                if (!achievement) {
                  achievement = await Achievement.create({
                    name: badgeName,
                    description: 'Arritje për 10 ndeshje radhazi të luajtura!',
                    icon: '🏅',
                    criteria: { type: 'streak_participation', value: 10, badgeId: badge.id },
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
          // 2. Streak fitore (5 fitore radhazi)
          // Kjo logjike supozon qe ekziston nje model Match me userId dhe status 'win', dhe nje date
          // Merr 5 ndeshjet e fundit te fituara radhazi
          const Match = require('../models/Match');
          const last5Matches = await Match.findAll({
            where: { winnerUserId: userId },
            order: [['matchDate', 'DESC']],
            limit: 5
          });
          let streak5 = false;
          if (last5Matches.length === 5) {
            // Kontrollo nese jane 5 fitore radhazi (pa humbje ne mes)
            const allWins = await Match.findAll({
              where: { [sequelize.Op.or]: [
                { homeUserId: userId },
                { awayUserId: userId }
              ] },
              order: [['matchDate', 'DESC']],
              limit: 5
            });
            streak5 = allWins.every(m => m.winnerUserId === userId);
          }
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
