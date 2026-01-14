module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Helper to check if column exists
    async function columnExists(table, column) {
      const desc = await queryInterface.describeTable(table);
      return !!desc[column];
    }
    if (!(await columnExists('Posts', 'location'))) {
      await queryInterface.addColumn('Posts', 'location', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!(await columnExists('Posts', 'locationLat'))) {
      await queryInterface.addColumn('Posts', 'locationLat', {
        type: Sequelize.DOUBLE,
        allowNull: true,
      });
    }
    if (!(await columnExists('Posts', 'locationLng'))) {
      await queryInterface.addColumn('Posts', 'locationLng', {
        type: Sequelize.DOUBLE,
        allowNull: true,
      });
    }
    if (!(await columnExists('Posts', 'mentions'))) {
      await queryInterface.addColumn('Posts', 'mentions', {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    // Remove columns if migration is reverted
    await queryInterface.removeColumn('Posts', 'location');
    await queryInterface.removeColumn('Posts', 'locationLat');
    await queryInterface.removeColumn('Posts', 'locationLng');
    await queryInterface.removeColumn('Posts', 'mentions');
  }
};
