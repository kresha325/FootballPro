const User = require('./User');
const Match = require('./Match');
// Centralized model import and association setup for Sequelize
const Profile = require('./Profile');
const Achievement = require('./Achievement');
const Badge = require('./Badge');
const UserAchievement = require('./UserAchievement');

const Like = require('./Like');
const Comment = require('./Comment');
const Post = require('./Post');

const Subscription = require('./Subscription');
const UserReward = require('./UserReward');
const Reward = require('./Reward');
const Follow = require('./Follow');
// User/Reward
User.hasMany(UserReward, { foreignKey: 'userId' });
UserReward.belongsTo(User, { foreignKey: 'userId' });
Reward.hasMany(UserReward, { foreignKey: 'rewardId' });
UserReward.belongsTo(Reward, { foreignKey: 'rewardId' });
Reward.belongsTo(Badge, { foreignKey: 'badgeId' });

// Follow associations
Follow.belongsTo(User, { as: 'following', foreignKey: 'followingId' });

// User/Profile
User.hasOne(Profile, { foreignKey: 'userId' });
Profile.belongsTo(User, { foreignKey: 'userId' });

// User/Achievement
User.hasMany(UserAchievement, { foreignKey: 'userId' });
UserAchievement.belongsTo(User, { foreignKey: 'userId' });
Achievement.hasMany(UserAchievement, { foreignKey: 'achievementId' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'achievementId' });



const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);
const db = {};

fs.readdirSync(__dirname)
  .filter(file => file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js')
  .forEach(file => {
    const model = require(path.join(__dirname, file));
    const name = file.replace('.js', '');
    db[name] = model;
  });

module.exports = db;
Like.belongsTo(User, { foreignKey: 'userId' });
