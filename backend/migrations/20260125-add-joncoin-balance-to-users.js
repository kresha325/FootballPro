// Migration to add joncoinBalance to User
'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'joncoinBalance', {
      type: Sequelize.DECIMAL(12,2),
      allowNull: false,
      defaultValue: 0
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'joncoinBalance');
  }
};
