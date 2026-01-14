module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Profiles');
    if (!desc['birthDate']) {
      await queryInterface.addColumn('Profiles', 'birthDate', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
    if (!desc['clubLogo']) {
      await queryInterface.addColumn('Profiles', 'clubLogo', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Profiles', 'birthDate');
    await queryInterface.removeColumn('Profiles', 'clubLogo');
  }
};
