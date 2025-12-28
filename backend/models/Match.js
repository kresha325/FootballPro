const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { Tournament } = require('./Tournament');
const User = require('./User');

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    references: {
      model: Tournament,
      key: 'id',
    },
  },
  homeUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  awayUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  scoreHome: DataTypes.INTEGER,
  scoreAway: DataTypes.INTEGER,
  matchDate: DataTypes.DATE,
  status: {
    type: DataTypes.ENUM('scheduled', 'ongoing', 'finished'),
    defaultValue: 'scheduled',
  },
  round: DataTypes.INTEGER, // For knockout rounds
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

Match.belongsTo(Tournament, { foreignKey: 'tournamentId' });
Tournament.hasMany(Match, { foreignKey: 'tournamentId' });

Match.belongsTo(User, { foreignKey: 'homeUserId', as: 'homeUser' });
Match.belongsTo(User, { foreignKey: 'awayUserId', as: 'awayUser' });

User.hasMany(Match, { foreignKey: 'homeUserId' });
User.hasMany(Match, { foreignKey: 'awayUserId' });

module.exports = Match;