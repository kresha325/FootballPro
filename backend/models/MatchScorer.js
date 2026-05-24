const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Match = require('./Match');
const User = require('./User');

const MatchScorer = sequelize.define('MatchScorer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  matchId: {
    type: DataTypes.INTEGER,
    references: {
      model: Match,
      key: 'id',
    },
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
    allowNull: false,
  },
  goals: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
  },
  minute: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  assistUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  side: {
    type: DataTypes.ENUM('home', 'away'),
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

MatchScorer.belongsTo(Match, { foreignKey: 'matchId' });
Match.hasMany(MatchScorer, { foreignKey: 'matchId' });
MatchScorer.belongsTo(User, { foreignKey: 'userId' });
MatchScorer.belongsTo(User, { as: 'assistUser', foreignKey: 'assistUserId' });
User.hasMany(MatchScorer, { foreignKey: 'userId' });

module.exports = MatchScorer;
