'use strict';

/** Track when X TALENTI Premium access ends (e.g. sponsor / IAP / Stripe). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'premiumExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'premiumExpiresAt');
  },
};
