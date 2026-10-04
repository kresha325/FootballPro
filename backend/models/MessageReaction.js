const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MessageReaction = sequelize.define(
  'MessageReaction',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    emoji: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
  },
  {
    tableName: 'MessageReactions',
    indexes: [
      { unique: true, fields: ['messageId', 'userId', 'emoji'] },
      { fields: ['messageId'] },
    ],
  }
);

module.exports = MessageReaction;
