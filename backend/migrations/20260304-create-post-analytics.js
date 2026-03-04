module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('PostAnalytics')) {
      await queryInterface.createTable('PostAnalytics', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        postId: { type: Sequelize.INTEGER, references: { model: 'Posts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        date: { type: Sequelize.DATEONLY, allowNull: false },
        views: { type: Sequelize.INTEGER, defaultValue: 0 },
        likes: { type: Sequelize.INTEGER, defaultValue: 0 },
        comments: { type: Sequelize.INTEGER, defaultValue: 0 },
        shares: { type: Sequelize.INTEGER, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('PostAnalytics');
  },
};
