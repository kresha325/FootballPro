const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Profile = sequelize.define('Profile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  bio: DataTypes.TEXT,
  city: DataTypes.STRING,
  country: DataTypes.STRING,
  club: DataTypes.STRING,
  position: DataTypes.STRING,
  stats: DataTypes.JSON,
  careerHistory: DataTypes.JSON,
  contact: DataTypes.JSON,
  coverPhoto: DataTypes.STRING,
  profilePhoto: DataTypes.STRING,
  coachAffiliation: {
    type: DataTypes.ENUM('club', 'independent', 'personal_trainer'),
    allowNull: true,
  },
  coachCategory: {
    type: DataTypes.ENUM(
      'general_trainer',
      'assistant_trainer',
      'fitness_trainer',
      'goalkeeper_trainer',
      'technical_trainer',
      'tactical_trainer',
      'psychological_trainer',
      'youth_trainer',
      'rehabilitation_trainer'
    ),
    allowNull: true,
  },
});

Profile.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(Profile, { foreignKey: 'userId' });

module.exports = Profile;