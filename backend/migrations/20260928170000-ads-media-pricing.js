'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Ads', 'mediaType', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'image',
    });
    await queryInterface.addColumn('Ads', 'videoUrl', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Ads', 'displaySeconds', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 3,
    });
    await queryInterface.addColumn('Ads', 'priceEur', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn('Ads', 'mediaDurationSec', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Ads', 'mediaDurationSec');
    await queryInterface.removeColumn('Ads', 'priceEur');
    await queryInterface.removeColumn('Ads', 'displaySeconds');
    await queryInterface.removeColumn('Ads', 'videoUrl');
    await queryInterface.removeColumn('Ads', 'mediaType');
  },
};
