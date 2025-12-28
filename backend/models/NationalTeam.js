const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const NationalTeam = sequelize.define('NationalTeam', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nationalTeamId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  playerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  teamCategory: {
    type: DataTypes.ENUM('senior', 'u23', 'u21', 'u19', 'u17', 'u15', 'women_senior', 'women_u23', 'women_u21', 'women_u19', 'women_u17'),
    allowNull: false,
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  jerseyNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'inactive', 'retired'),
    defaultValue: 'pending',
  },
  capsEarned: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  goals: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  debutDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  captaincy: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

// Relationships
NationalTeam.belongsTo(User, { foreignKey: 'nationalTeamId', as: 'nationalTeam' });
NationalTeam.belongsTo(User, { foreignKey: 'playerId', as: 'player' });

module.exports = NationalTeam;
