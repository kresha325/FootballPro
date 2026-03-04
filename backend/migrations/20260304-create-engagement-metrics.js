module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('EngagementMetrics')) {
      await queryInterface.createTable('EngagementMetrics', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        profileViews: { type: Sequelize.INTEGER, defaultValue: 0 },
        postViews: { type: Sequelize.INTEGER, defaultValue: 0 },
        likesReceived: { type: Sequelize.INTEGER, defaultValue: 0 },
        commentsReceived: { type: Sequelize.INTEGER, defaultValue: 0 },
        sharesReceived: { type: Sequelize.INTEGER, defaultValue: 0 },
        followersGained: { type: Sequelize.INTEGER, defaultValue: 0 },
        postsCreated: { type: Sequelize.INTEGER, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('EngagementMetrics');
  },
};
