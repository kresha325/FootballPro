module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Profiles')) {
      await queryInterface.createTable('Profiles', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        bio: { type: Sequelize.TEXT, allowNull: true },
        city: { type: Sequelize.STRING, allowNull: true },
        country: { type: Sequelize.STRING, allowNull: true },
        club: { type: Sequelize.STRING, allowNull: true },
        clubId: { type: Sequelize.INTEGER, allowNull: true },
        clubLogo: { type: Sequelize.STRING, allowNull: true },
        position: { type: Sequelize.STRING, allowNull: true },
        stats: { type: Sequelize.JSON, allowNull: true },
        careerHistory: { type: Sequelize.JSON, allowNull: true },
        contact: { type: Sequelize.JSON, allowNull: true },
        coverPhoto: { type: Sequelize.STRING, allowNull: true },
        profilePhoto: { type: Sequelize.STRING, allowNull: true },
        age: { type: Sequelize.INTEGER, allowNull: true },
        ageGroup: { type: Sequelize.STRING, allowNull: true },
        achievements: { type: Sequelize.JSON, allowNull: true },
        matches: { type: Sequelize.JSON, allowNull: true },
        media: { type: Sequelize.JSON, allowNull: true },
        performanceTrend: { type: Sequelize.JSON, allowNull: true },
        coachAffiliation: { type: Sequelize.ENUM('club','independent','personal_trainer'), allowNull: true },
        coachCategory: { type: Sequelize.ENUM('general_trainer','assistant_trainer','fitness_trainer','goalkeeper_trainer','technical_trainer','tactical_trainer','psychological_trainer','youth_trainer','rehabilitation_trainer'), allowNull: true },
        liveVideos: { type: Sequelize.JSON, allowNull: true, defaultValue: [] },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('Profiles');
  },
};
