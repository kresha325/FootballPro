'use strict';

/** Admin confirmation flag for non-athlete role verification (with premium). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Users');
    if (!table.adminVerified) {
      await queryInterface.addColumn('Users', 'adminVerified', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
      // Backfill: non-athletes already marked verified were admin-approved
      await queryInterface.sequelize.query(`
        UPDATE "Users"
        SET "adminVerified" = true
        WHERE verified = true
          AND role IS DISTINCT FROM 'athlete'
      `);
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Users');
    if (table.adminVerified) {
      await queryInterface.removeColumn('Users', 'adminVerified');
    }
  },
};
