const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ClubStaff = sequelize.define('ClubStaff', {
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
  staffId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  staffRole: {
    type: DataTypes.ENUM(
      'head_coach',
      'assistant_coach',
      'fitness_coach',
      'goalkeeper_coach',
      'technical_coach',
      'tactical_coach',
      'medical_staff',
      'physiotherapist',
      'sports_psychologist',
      'scout',
      'analyst',
      'kit_manager',
      'other'
    ),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'inactive'),
    defaultValue: 'pending',
  },
  joinedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  leftAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  contractUntil: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  teamType: {
    type: DataTypes.ENUM('first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'),
    defaultValue: 'first_team',
  },
});

// Relationships
ClubStaff.belongsTo(User, { foreignKey: 'clubId', as: 'club' });
ClubStaff.belongsTo(User, { foreignKey: 'staffId', as: 'staff' });

module.exports = ClubStaff;
