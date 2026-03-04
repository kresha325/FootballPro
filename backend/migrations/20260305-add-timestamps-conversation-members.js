module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('ConversationMembers')) return;

    const tableInfo = await queryInterface.describeTable('ConversationMembers');

    if (!tableInfo.createdAt) {
      await queryInterface.addColumn('ConversationMembers', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    if (!tableInfo.updatedAt) {
      await queryInterface.addColumn('ConversationMembers', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('ConversationMembers');
    if (tableInfo.createdAt) {
      await queryInterface.removeColumn('ConversationMembers', 'createdAt');
    }
    if (tableInfo.updatedAt) {
      await queryInterface.removeColumn('ConversationMembers', 'updatedAt');
    }
  },
};
