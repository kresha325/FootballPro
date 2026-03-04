module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Videos')) {
      await queryInterface.createTable('Videos', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        title: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        videoUrl: { type: Sequelize.STRING, allowNull: false },
        publicId: { type: Sequelize.STRING, allowNull: true },
        thumbnailUrl: { type: Sequelize.STRING, allowNull: true },
        duration: { type: Sequelize.INTEGER, defaultValue: 0 },
        views: { type: Sequelize.INTEGER, defaultValue: 0 },
        likes: { type: Sequelize.INTEGER, defaultValue: 0 },
        category: { type: Sequelize.STRING, allowNull: true },
        tags: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true, defaultValue: [] },
        isPremium: { type: Sequelize.BOOLEAN, defaultValue: false },
        isProcessing: { type: Sequelize.BOOLEAN, defaultValue: false },
        processingStatus: { type: Sequelize.ENUM('pending','processing','completed','failed'), defaultValue: 'pending' },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Videos');
  },
};
