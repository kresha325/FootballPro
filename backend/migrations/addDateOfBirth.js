module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Users');
    if (!desc['dateOfBirth']) {
      await queryInterface.addColumn('Users', 'dateOfBirth', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'dateOfBirth');
  }
};
