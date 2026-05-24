const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Match = sequelize.define('Match', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tournamentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Tournaments',
      key: 'id',
    },
  },
  homeUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  awayUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  scoreHome: DataTypes.INTEGER,
  scoreAway: DataTypes.INTEGER,
  matchDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'ongoing', 'finished'),
    defaultValue: 'scheduled',
  },
  round: DataTypes.INTEGER, // For knockout rounds
  minutesPlayed: {
    type: DataTypes.STRING, // shembull: "90+", "40"
    allowNull: true,
  },
  goals: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  assists: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'Matches',
});


const Tournament = require('./Tournament').Tournament;
Match.belongsTo(Tournament, { foreignKey: 'tournamentId' });
module.exports = Match;