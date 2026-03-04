module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('ProfileViews')) {
      await queryInterface.createTable('ProfileViews', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        viewerId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        profileId: { type: Sequelize.INTEGER, references: { model: 'Profiles', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        viewedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('ProfileViews');
  },
};
