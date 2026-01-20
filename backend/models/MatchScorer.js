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
User.hasMany(MatchScorer, { foreignKey: 'userId' });

module.exports = MatchScorer;
