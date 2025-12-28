const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ClubMember = sequelize.define('ClubMember', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  clubId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  athleteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  teamType: {
    type: DataTypes.ENUM('first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'),
    defaultValue: 'first_team',
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  jerseyNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  joinedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  leftAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

// Relationships
ClubMember.belongsTo(User, { foreignKey: 'clubId', as: 'club' });
ClubMember.belongsTo(User, { foreignKey: 'athleteId', as: 'athlete' });

module.exports = ClubMember;
