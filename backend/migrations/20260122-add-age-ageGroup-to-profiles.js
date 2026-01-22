module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Profiles');
    if (!desc['age']) {
      await queryInterface.addColumn('Profiles', 'age', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
    if (!desc['ageGroup']) {
      await queryInterface.addColumn('Profiles', 'ageGroup', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('Profiles', 'age');
    await queryInterface.removeColumn('Profiles', 'ageGroup');
  }
};
