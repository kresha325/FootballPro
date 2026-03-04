module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Galleries')) {
      await queryInterface.createTable('Galleries', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        title: { type: Sequelize.STRING, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        imageUrl: { type: Sequelize.STRING, allowNull: true },
        videoUrl: { type: Sequelize.STRING, allowNull: true },
        type: { type: Sequelize.ENUM('photo','video','highlight'), defaultValue: 'photo' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Galleries');
  },
};
