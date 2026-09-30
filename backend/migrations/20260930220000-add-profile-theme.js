'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Profiles').catch(() => null);
    if (!table) return;
    if (!table.profileTheme) {
      await queryInterface.addColumn('Profiles', 'profileTheme', {
        type: Sequelize.STRING(32),
        allowNull: true,
        defaultValue: 'default',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Profiles').catch(() => null);
    if (!table?.profileTheme) return;
    await queryInterface.removeColumn('Profiles', 'profileTheme');
  },
};
