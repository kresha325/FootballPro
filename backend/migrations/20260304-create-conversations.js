module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Conversations')) {
      await queryInterface.createTable('Conversations', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        isGroup: { type: Sequelize.BOOLEAN, defaultValue: false },
        name: { type: Sequelize.STRING, allowNull: true },
        avatar: { type: Sequelize.STRING, allowNull: true },
        lastMessageAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
    if (!tables.includes('ConversationMembers')) {
      await queryInterface.createTable('ConversationMembers', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        conversationId: { type: Sequelize.INTEGER, references: { model: 'Conversations', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        role: { type: Sequelize.ENUM('admin','member'), defaultValue: 'member' },
        lastReadAt: { type: Sequelize.DATE, allowNull: true },
        joinedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('ConversationMembers');
    await queryInterface.dropTable('Conversations');
  },
};
