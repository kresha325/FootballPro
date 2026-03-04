module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('ClubRosterRequests')) {
      await queryInterface.createTable('ClubRosterRequests', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        athleteId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        clubId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        position: { type: Sequelize.STRING, allowNull: false },
        jerseyNumber: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.ENUM('pending','approved','rejected'), defaultValue: 'pending' },
        message: { type: Sequelize.TEXT, allowNull: true },
        responseMessage: { type: Sequelize.TEXT, allowNull: true },
        approvedBy: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        approvedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('ClubRosterRequests');
  },
};
