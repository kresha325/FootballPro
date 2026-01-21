'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Streams');
    if (!table.type) {
      await queryInterface.addColumn('Streams', 'type', {
        type: Sequelize.STRING,
        allowNull: true, // Mund të bëhet false nëse të gjitha stream-et duhet ta kenë këtë fushë
        defaultValue: null
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Streams');
    if (table.type) {
      await queryInterface.removeColumn('Streams', 'type');
    }
  }
};
