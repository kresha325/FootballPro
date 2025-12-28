const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  isGroup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true, // For group chats
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true, // For group chats
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

const ConversationMember = sequelize.define('ConversationMember', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  conversationId: {
    type: DataTypes.INTEGER,
    references: {
      model: Conversation,
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
  role: {
    type: DataTypes.ENUM('admin', 'member'),
    defaultValue: 'member',
  },
  lastReadAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

// Relationships
Conversation.belongsToMany(User, { through: ConversationMember, foreignKey: 'conversationId', as: 'members' });
User.belongsToMany(Conversation, { through: ConversationMember, foreignKey: 'userId', as: 'conversations' });

Conversation.hasMany(ConversationMember, { foreignKey: 'conversationId', as: 'memberships' });
ConversationMember.belongsTo(Conversation, { foreignKey: 'conversationId' });
ConversationMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Message relationship (defined here to avoid circular dependency)
const Message = require('./Message');
Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });

module.exports = { Conversation, ConversationMember };
