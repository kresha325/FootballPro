const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');
const User = require('./User');
const JonCoinTransaction = require('./JonCoinTransaction')(sequelize, DataTypes);
const WithdrawalRequest = require('./WithdrawalRequest')(sequelize, DataTypes);
const Product = require('./Product');
const Payment = require('./Payment');
const Order = require('./Order');
// Product/Seller association
Product.belongsTo(User, { as: 'Seller', foreignKey: 'sellerId' });
User.hasMany(Product, { as: 'Products', foreignKey: 'sellerId' });
// JonCoin / User
User.hasMany(JonCoinTransaction, { foreignKey: 'userId' });
JonCoinTransaction.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(WithdrawalRequest, { foreignKey: 'userId' });
WithdrawalRequest.belongsTo(User, { foreignKey: 'userId' });
const ProfileView = require('./ProfileView');
const TournamentModule = require('./Tournament');
const Tournament = TournamentModule.Tournament;
const TournamentParticipant = TournamentModule.TournamentParticipant;
const TournamentSquadMember = require('./TournamentSquadMember');
const Match = require('./Match');
const MatchScorer = require('./MatchScorer');
const MatchEvent = require('./MatchEvent');
const PlayerMatchStat = require('./PlayerMatchStat');
const Stadium = require('./Stadium');
// Lidhjet kryesore për Match
if (Match && Tournament && User) {
  Match.belongsTo(Tournament, { foreignKey: 'tournamentId' });
  Tournament.hasMany(Match, { foreignKey: 'tournamentId' });
  // Lidhjet për homeUser dhe awayUser
  Match.belongsTo(User, { as: 'homeUser', foreignKey: 'homeUserId' });
  Match.belongsTo(User, { as: 'awayUser', foreignKey: 'awayUserId' });
  Match.belongsTo(Stadium, { as: 'Stadium', foreignKey: 'stadiumId' });
  Stadium.hasMany(Match, { as: 'matches', foreignKey: 'stadiumId' });
}
// Lidhjet për MatchScorer
if (Match && MatchScorer && User) {
  Match.hasMany(MatchScorer, { foreignKey: 'matchId' });
  MatchScorer.belongsTo(Match, { foreignKey: 'matchId' });
  MatchScorer.belongsTo(User, { foreignKey: 'userId' });
  User.hasMany(MatchScorer, { foreignKey: 'userId' });
}
if (Match && MatchEvent && User) {
  Match.hasMany(MatchEvent, { foreignKey: 'matchId', as: 'events' });
  MatchEvent.belongsTo(Match, { foreignKey: 'matchId' });
  MatchEvent.belongsTo(User, { foreignKey: 'userId', as: 'player' });
  MatchEvent.belongsTo(User, { foreignKey: 'relatedUserId', as: 'relatedPlayer' });
}
if (Match && PlayerMatchStat && User) {
  Match.hasMany(PlayerMatchStat, { foreignKey: 'matchId', as: 'playerStats' });
  PlayerMatchStat.belongsTo(Match, { foreignKey: 'matchId' });
  PlayerMatchStat.belongsTo(User, { foreignKey: 'userId', as: 'player' });
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
const MediaItem = require('./MediaItem');
const MediaEvent = require('./MediaEvent');
const PostSponsor = require('./PostSponsor');
const EngagementMetrics = require('./EngagementMetrics');
const VideoCallHistory = require('./VideoCallHistory')(sequelize, DataTypes);
const LiveStream = require('./LiveStream');
const Stream = require('./Stream');

MediaItem.belongsTo(User, { as: 'uploader', foreignKey: 'uploadedBy' });
MediaItem.belongsTo(User, { as: 'player', foreignKey: 'playerId' });
MediaItem.belongsTo(User, { as: 'club', foreignKey: 'clubId' });
MediaItem.belongsTo(User, { as: 'team', foreignKey: 'teamId' });
MediaItem.belongsTo(Match, { as: 'match', foreignKey: 'matchId' });
MediaItem.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
User.hasMany(MediaItem, { as: 'uploadedMedia', foreignKey: 'uploadedBy' });
MediaEvent.belongsTo(MediaItem, { foreignKey: 'mediaId', as: 'media' });
MediaItem.hasMany(MediaEvent, { foreignKey: 'mediaId', as: 'events' });
MediaEvent.belongsTo(User, { foreignKey: 'userId', as: 'user' });

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
Follow.belongsTo(User, { as: 'following', foreignKey: 'followingId' });
// User/Profile
User.hasOne(Profile, { foreignKey: 'userId' });
Profile.belongsTo(User, { foreignKey: 'userId' });
Profile.belongsTo(Stadium, { foreignKey: 'stadiumId', as: 'Stadium' });
Stadium.hasMany(Profile, { foreignKey: 'stadiumId', as: 'clubs' });
// User/Liga
User.hasOne(Liga, { foreignKey: 'userId' });
Liga.belongsTo(User, { foreignKey: 'userId' });
if (Tournament && Liga) {
  Tournament.belongsTo(Liga, { foreignKey: 'ligaId', as: 'liga' });
  Liga.hasMany(Tournament, { foreignKey: 'ligaId', as: 'tournaments' });
}
if (Tournament && TournamentSquadMember && User) {
  Tournament.hasMany(TournamentSquadMember, { foreignKey: 'tournamentId', as: 'squadMembers' });
  TournamentSquadMember.belongsTo(Tournament, { foreignKey: 'tournamentId' });
}
// User/Achievement
User.hasMany(UserAchievement, { foreignKey: 'userId' });
UserAchievement.belongsTo(User, { foreignKey: 'userId' });
Achievement.hasMany(UserAchievement, { foreignKey: 'achievementId' });
UserAchievement.belongsTo(Achievement, { foreignKey: 'achievementId' });


Like.belongsTo(User, { foreignKey: 'userId' });
Post.hasMany(Like, { foreignKey: 'postId' });
Like.belongsTo(Post, { foreignKey: 'postId' });

const Report = require('./Report');
const Block = require('./Block');
const IapPurchase = require('./IapPurchase');
Report.belongsTo(User, { as: 'reporter', foreignKey: 'reporterId' });
User.hasMany(Report, { as: 'reportsFiled', foreignKey: 'reporterId' });
Block.belongsTo(User, { as: 'blocker', foreignKey: 'blockerId' });
Block.belongsTo(User, { as: 'blockedUser', foreignKey: 'blockedId' });
User.hasMany(Block, { as: 'blocksCreated', foreignKey: 'blockerId' });
User.hasMany(Block, { as: 'blocksReceived', foreignKey: 'blockedId' });
User.hasMany(IapPurchase, { foreignKey: 'userId' });
IapPurchase.belongsTo(User, { foreignKey: 'userId' });

const Invoice = require('./Invoice');
User.hasMany(Invoice, { foreignKey: 'userId' });
Invoice.belongsTo(User, { foreignKey: 'userId' });

const ScoutShortlist = require('./ScoutShortlist');
const ScoutWatchlist = require('./ScoutWatchlist');
const ScoutWatchEvent = require('./ScoutWatchEvent');
const ScoutingReport = require('./ScoutingReport');
const ScoutPreference = require('./ScoutPreference');
const ScoutingRecommendation = require('./ScoutingRecommendation');

module.exports = {
  User,
  Product,
  Payment,
  Order,
  Match,
  Sponsor,
  Ad,
  Achievement,
  Badge,
  UserAchievement,
  UserBadge,
  Tournament,
  TournamentParticipant,
  TournamentSquadMember,
  Follow,
  Subscription,
  Profile,
  Liga,
  Stadium,
  Like,
  Comment,
  Post,
  Gallery,
  Video,
  MediaItem,
  MediaEvent,
  PostSponsor,
  ProfileView,
  EngagementMetrics,
  MatchScorer,
  MatchEvent,
  PlayerMatchStat,
  VideoCallHistory,
  Stream,
  JonCoinTransaction,
  WithdrawalRequest,
  LiveStream,
  Report,
  Block,
  IapPurchase,
  Invoice,
  ScoutShortlist,
  ScoutWatchlist,
  ScoutWatchEvent,
  ScoutingReport,
  ScoutPreference,
  ScoutingRecommendation,
};


