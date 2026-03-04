module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('UserBadges')) {
      await queryInterface.createTable('UserBadges', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, allowNull: false, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        badgeId: { type: Sequelize.INTEGER, references: { model: 'Badges', key: 'id' }, allowNull: false, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        earnedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('UserBadges');
  },
};
