// Migration to add joncoinBalance to User
'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Users');
    if (!table.joncoinBalance) {
      await queryInterface.addColumn('Users', 'joncoinBalance', {
        type: Sequelize.DECIMAL(12,2),
        allowNull: false,
        defaultValue: 0
      });
    }
  },
  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Users');
    if (table.joncoinBalance) {
      await queryInterface.removeColumn('Users', 'joncoinBalance');
    }
  }
};
