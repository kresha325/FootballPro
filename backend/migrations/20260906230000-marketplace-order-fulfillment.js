'use strict';

/** Fusha për porosi marketplace: shitës, dërgesë/kontakt, konfirmim. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Orders').catch(() => null);
    if (!table) return;

    if (!table.sellerId) {
      await queryInterface.addColumn('Orders', 'sellerId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!table.deliveryMethod) {
      await queryInterface.addColumn('Orders', 'deliveryMethod', {
        type: Sequelize.STRING(32),
        allowNull: true,
        defaultValue: 'meetup',
      });
    }
    if (!table.deliveryAddress) {
      await queryInterface.addColumn('Orders', 'deliveryAddress', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!table.buyerContact) {
      await queryInterface.addColumn('Orders', 'buyerContact', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!table.deliveryNotes) {
      await queryInterface.addColumn('Orders', 'deliveryNotes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!table.confirmedAt) {
      await queryInterface.addColumn('Orders', 'confirmedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Orders').catch(() => null);
    if (!table) return;
    for (const col of [
      'sellerId',
      'deliveryMethod',
      'deliveryAddress',
      'buyerContact',
      'deliveryNotes',
      'confirmedAt',
    ]) {
      if (table[col]) await queryInterface.removeColumn('Orders', col);
    }
  },
};
