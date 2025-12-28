const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Tournament = sequelize.define('Tournament', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: DataTypes.TEXT,
  type: {
    type: DataTypes.ENUM('league', 'cup', 'knockout'),
    allowNull: false,
  },
  startDate: DataTypes.DATE,
  endDate: DataTypes.DATE,
  maxParticipants: DataTypes.INTEGER,
  status: {
    type: DataTypes.ENUM('open', 'ongoing', 'finished'),
    defaultValue: 'open',
  },
  creatorId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
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

Tournament.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });
User.hasMany(Tournament, { foreignKey: 'creatorId' });

// Many-to-many with participants
const TournamentParticipant = sequelize.define('TournamentParticipant', {
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
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  wins: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  draws: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  losses: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  goalsFor: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  goalsAgainst: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

Tournament.belongsToMany(User, { through: TournamentParticipant, foreignKey: 'tournamentId', as: 'participants' });
User.belongsToMany(Tournament, { through: TournamentParticipant, foreignKey: 'userId', as: 'tournaments' });

module.exports = { Tournament, TournamentParticipant };