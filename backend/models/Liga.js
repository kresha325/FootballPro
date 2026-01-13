const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Liga = sequelize.define('Liga', {
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
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  logo: DataTypes.STRING,
  country: DataTypes.STRING,
  level: {
    type: DataTypes.ENUM('national', 'regional', 'youth', 'women', 'other'),
    allowNull: false,
  },
  foundedYear: DataTypes.INTEGER,
  description: DataTypes.TEXT,
  website: DataTypes.STRING,
  clubs: DataTypes.JSON, // Array of club IDs or names
  competitions: DataTypes.JSON, // Array of competition names
  contact: DataTypes.JSON,
  socialLinks: DataTypes.JSON,
});

Liga.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(Liga, { foreignKey: 'userId' });

module.exports = Liga;