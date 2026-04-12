const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');
const JonCoinTransaction = require('./JonCoinTransaction')(sequelize, DataTypes);
const Product = require('./Product');
// Product/Seller association
Product.belongsTo(User, { as: 'Seller', foreignKey: 'sellerId' });
User.hasMany(Product, { as: 'Products', foreignKey: 'sellerId' });
const ProfileView = require('./ProfileView');
const TournamentModule = require('./Tournament');
const Tournament = TournamentModule.Tournament;
const TournamentParticipant = TournamentModule.TournamentParticipant;
const Match = require('./Match');
const MatchScorer = require('./MatchScorer');
// Lidhjet kryesore për Match
if (Match && Tournament && User) {
  Match.belongsTo(Tournament, { foreignKey: 'tournamentId' });
  Tournament.hasMany(Match, { foreignKey: 'tournamentId' });
  // Lidhjet për homeUser dhe awayUser
  Match.belongsTo(User, { as: 'homeUser', foreignKey: 'homeUserId' });
  Match.belongsTo(User, { as: 'awayUser', foreignKey: 'awayUserId' });
}
// Lidhjet për MatchScorer
if (Match && MatchScorer && User) {
  Match.hasMany(MatchScorer, { foreignKey: 'matchId' });
  MatchScorer.belongsTo(Match, { foreignKey: 'matchId' });
  MatchScorer.belongsTo(User, { foreignKey: 'userId' });
  User.hasMany(MatchScorer, { foreignKey: 'userId' });
}
const Sponsor = require('./Sponsor');
const Ad = require('./Ad');
const Achievement = require('./Achievement');
const Badge = require('./Badge');
const UserAchievement = require('./UserAchievement');
const UserBadge = require('./UserBadge');
const UserReward = require('./UserReward');
const Reward = require('./Reward');
const Follow = require('./Follow');
const Subscription = require('./Subscription');
const Profile = require('./Profile');
const Liga = require('./Liga');
const Like = require('./Like');
const Comment = require('./Comment');
const Post = require('./Post');
const Gallery = require('./Gallery');
const Video = require('./Video');
const PostSponsor = require('./PostSponsor');
const EngagementMetrics = require('./EngagementMetrics');
const VideoCallHistory = require('./VideoCallHistory')(sequelize, DataTypes);
const LiveStream = require('./LiveStream');
const Stream = require('./Stream');



// User/Reward
User.hasMany(UserReward, { foreignKey: 'userId' });
UserReward.belongsTo(User, { foreignKey: 'userId' });
Reward.hasMany(UserReward, { foreignKey: 'rewardId' });
UserReward.belongsTo(Reward, { foreignKey: 'rewardId' });
Reward.belongsTo(Badge, { foreignKey: 'badgeId' });
// User/Sponsor
User.hasMany(Sponsor, { foreignKey: 'userId' });
Sponsor.belongsTo(User, { foreignKey: 'userId' });
// Follow associations
Follow.belongsTo(User, { as: 'follower', foreignKey: 'followerId' });
// User/Profile
User.hasOne(Profile, { foreignKey: 'userId' });
Profile.belongsTo(User, { foreignKey: 'userId' });
// User/Liga
User.hasOne(Liga, { foreignKey: 'userId' });
Liga.belongsTo(User, { foreignKey: 'userId' });
// User/Achievement
User.hasMany(UserAchievement, { foreignKey: 'userId' });
UserAchievement.belongsTo(User, { foreignKey: 'userId' });
Achievement.hasMany(UserAchievement, { foreignKey: 'achievementId' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'achievementId' });


Like.belongsTo(User, { foreignKey: 'userId' });
Post.hasMany(Like, { foreignKey: 'postId' });
Like.belongsTo(Post, { foreignKey: 'postId' });
module.exports = {
  User,
  Product,
  Match,
  Sponsor,
  Ad,
  Achievement,
  Badge,
  UserAchievement,
  UserBadge,
  Tournament,
  Follow,
  Subscription,
  Profile,
  Liga,
  Like,
  Comment,
  Post,
  Gallery,
  Video,
  PostSponsor,
  ProfileView,
  EngagementMetrics,
  MatchScorer,
  VideoCallHistory,
  Stream,
  JonCoinTransaction,
  LiveStream
};


