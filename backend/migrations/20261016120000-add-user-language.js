'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('Users');
    if (!columns.language) {
      await queryInterface.addColumn('Users', 'language', {
        type: Sequelize.STRING(5),
        allowNull: false,
        defaultValue: 'sq',
      });
    }
  },
  down: async (queryInterface) => {
    const columns = await queryInterface.describeTable('Users');
    if (columns.language) await queryInterface.removeColumn('Users', 'language');
  },
};
