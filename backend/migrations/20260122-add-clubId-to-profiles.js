module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('Profiles');
    if (!desc['clubId']) {
      await queryInterface.addColumn('Profiles', 'clubId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('Profiles', 'clubId');
  }
};
