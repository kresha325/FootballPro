const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Stadium = sequelize.define(
  'Stadium',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    photo: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    featuredStart: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    featuredEnd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'Stadiums',
    timestamps: true,
  }
);

module.exports = Stadium;
