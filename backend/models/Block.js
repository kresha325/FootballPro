const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Block = sequelize.define(
  'Block',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    blockerId: { type: DataTypes.INTEGER, allowNull: false },
    blockedId: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'Blocks' }
);

module.exports = Block;
