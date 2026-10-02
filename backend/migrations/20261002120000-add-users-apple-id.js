'use strict';

/** Add Users.appleId for Sign in with Apple. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Users').catch(() => null);
    if (!table) return;
    if (!table.appleId) {
      await queryInterface.addColumn('Users', 'appleId', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Users').catch(() => null);
    if (!table?.appleId) return;
    await queryInterface.removeColumn('Users', 'appleId');
  },
};
