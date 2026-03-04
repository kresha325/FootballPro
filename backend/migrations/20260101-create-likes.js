module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Likes')) {
      await queryInterface.createTable('Likes', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        postId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Posts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        emoji: { type: Sequelize.STRING, allowNull: true, defaultValue: null },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Likes');
  }
};
