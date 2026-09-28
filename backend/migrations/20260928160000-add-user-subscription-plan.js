'use strict';

/** free | basic (1 active sponsor) | premium (2+ active sponsors) */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'subscriptionPlan', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'free',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'subscriptionPlan');
  },
};
