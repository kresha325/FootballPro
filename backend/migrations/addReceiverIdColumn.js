module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('Messages');
    if (!tableDescription.receiverId) {
      await queryInterface.addColumn('Messages', 'receiverId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      });
    }
    // Make conversationId nullable if not already
    if (tableDescription.conversationId && tableDescription.conversationId.allowNull === false) {
      await queryInterface.changeColumn('Messages', 'conversationId', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    // Remove receiverId column if exists
    const tableDescription = await queryInterface.describeTable('Messages');
    if (tableDescription.receiverId) {
      await queryInterface.removeColumn('Messages', 'receiverId');
    }
    // Optionally revert conversationId to NOT NULL (if needed)
    // await queryInterface.changeColumn('Messages', 'conversationId', {
    //   type: Sequelize.INTEGER,
    //   allowNull: false,
    // });
  }
};
