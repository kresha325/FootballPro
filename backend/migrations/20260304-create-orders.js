module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('Orders')) {
      await queryInterface.createTable('Orders', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
        products: { type: Sequelize.JSON, allowNull: false },
        totalAmount: { type: Sequelize.DECIMAL(10,2), allowNull: false },
        status: { type: Sequelize.ENUM('pending','paid','shipped','delivered','cancelled'), defaultValue: 'pending' },
        paymentId: { type: Sequelize.INTEGER, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });

      // If Payments table already exists, add the foreign key constraint.
      if (tables.includes('Payments')) {
        await queryInterface.addConstraint('Orders', {
          fields: ['paymentId'],
          type: 'foreign key',
          name: 'orders_paymentId_fkey',
          references: { table: 'Payments', field: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        });
      }
    } else {
      // Orders already exists; ensure constraint exists if Payments exists
      if (tables.includes('Payments')) {
        try {
          await queryInterface.addConstraint('Orders', {
            fields: ['paymentId'],
            type: 'foreign key',
            name: 'orders_paymentId_fkey',
            references: { table: 'Payments', field: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          });
        } catch (e) {
          // constraint likely already exists — ignore
        }
      }
    }
  },
  down: async (queryInterface) => {
    // Remove FK constraint if present, then drop the table
    try {
      await queryInterface.removeConstraint('Orders', 'orders_paymentId_fkey');
    } catch (e) {
      // ignore if constraint doesn't exist
    }
    await queryInterface.dropTable('Orders');
  },
};
