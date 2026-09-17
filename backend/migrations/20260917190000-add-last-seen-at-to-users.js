'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Users');
    if (!table.lastSeenAt) {
      await queryInterface.addColumn('Users', 'lastSeenAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Users');
    if (table.lastSeenAt) {
      await queryInterface.removeColumn('Users', 'lastSeenAt');
    }
  },
};
