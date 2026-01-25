'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    // Empty migration to satisfy SequelizeMeta for Render
  },

  async down (queryInterface, Sequelize) {
    // No revert needed
  }
};

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Videos', 'publicId');
  },
};
