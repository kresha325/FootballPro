'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Kontrollo nëse kolona ekziston
    const table = await queryInterface.describeTable('Messages');
    if (!table.isRead) {
      await queryInterface.addColumn('Messages', 'isRead', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
    } else {
      console.log('Kolona isRead ekziston, nuk u shtua përsëri.');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Messages', 'isRead');
  },
};
