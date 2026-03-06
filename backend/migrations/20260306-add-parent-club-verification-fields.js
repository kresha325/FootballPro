"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'parentEmail', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'parentVerified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    await queryInterface.addColumn('Users', 'parentVerificationToken', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'parentVerificationExpire', {
      type: Sequelize.BIGINT,
      allowNull: true,
    });

    await queryInterface.addColumn('Users', 'clubVerified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });

    await queryInterface.addColumn('Users', 'clubVerifiedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'parentEmail');
    await queryInterface.removeColumn('Users', 'parentVerified');
    await queryInterface.removeColumn('Users', 'parentVerificationToken');
    await queryInterface.removeColumn('Users', 'parentVerificationExpire');
    await queryInterface.removeColumn('Users', 'clubVerified');
    await queryInterface.removeColumn('Users', 'clubVerifiedAt');
  }
};
