module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Brackets')) {
      await queryInterface.createTable('Brackets', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        tournamentId: { type: Sequelize.INTEGER, references: { model: 'Tournaments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        round: { type: Sequelize.INTEGER, allowNull: false },
        position: { type: Sequelize.INTEGER, allowNull: true },
        matchId: { type: Sequelize.INTEGER, references: { model: 'Matches', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Brackets');
  },
};
