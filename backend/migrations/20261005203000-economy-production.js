'use strict';

/**
 * Marketplace + JonCoin ledger production columns.
 * Monetary amounts stay DECIMAL. New enum labels are appended, never rewritten.
 */
async function addEnumValue(queryInterface, typeName, value) {
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = '${typeName}' AND e.enumlabel = '${value}'
        ) THEN
          ALTER TYPE "${typeName}" ADD VALUE '${value}';
        END IF;
      END IF;
    END $$;
  `);
}

async function columnExists(queryInterface, table, column) {
  const described = await queryInterface.describeTable(table).catch(() => null);
  return Boolean(described && described[column]);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const has = (name) => tables.map((t) => String(t).toLowerCase()).includes(String(name).toLowerCase());

    for (const value of ['sale', 'subscription', 'reversal', 'fee']) {
      await addEnumValue(queryInterface, 'enum_JonCoinTransactions_type', value);
    }
    for (const value of ['payment_pending', 'processing', 'refunded', 'failed']) {
      await addEnumValue(queryInterface, 'enum_Orders_status', value);
    }

    if (has('JonCoinTransactions')) {
      if (!(await columnExists(queryInterface, 'JonCoinTransactions', 'currency'))) {
        await queryInterface.addColumn('JonCoinTransactions', 'currency', {
          type: Sequelize.STRING(8),
          allowNull: false,
          defaultValue: 'JON',
        });
      }
      if (!(await columnExists(queryInterface, 'JonCoinTransactions', 'balanceBefore'))) {
        await queryInterface.addColumn('JonCoinTransactions', 'balanceBefore', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
        });
      }
      if (!(await columnExists(queryInterface, 'JonCoinTransactions', 'balanceAfter'))) {
        await queryInterface.addColumn('JonCoinTransactions', 'balanceAfter', {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: true,
        });
      }
      if (!(await columnExists(queryInterface, 'JonCoinTransactions', 'idempotencyKey'))) {
        await queryInterface.addColumn('JonCoinTransactions', 'idempotencyKey', {
          type: Sequelize.STRING(191),
          allowNull: true,
        });
      }
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS joncoin_transactions_idempotency_key
        ON "JonCoinTransactions" ("idempotencyKey")
        WHERE "idempotencyKey" IS NOT NULL;
      `);
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS joncoin_transactions_user_status
        ON "JonCoinTransactions" ("userId", "status");
      `);
    }

    if (has('JonCoinWallets')) {
      await queryInterface.sequelize.query(`
        ALTER TABLE "JonCoinWallets"
        ALTER COLUMN "balance" TYPE DECIMAL(12,2)
        USING "balance"::decimal;
      `).catch(() => {});
    }

    if (has('Products')) {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Products_status') THEN
            CREATE TYPE "enum_Products_status" AS ENUM ('draft', 'active', 'out_of_stock', 'paused', 'archived');
          END IF;
        END $$;
      `);
      if (!(await columnExists(queryInterface, 'Products', 'status'))) {
        await queryInterface.sequelize.query(`
          ALTER TABLE "Products"
          ADD COLUMN "status" "enum_Products_status" NOT NULL DEFAULT 'active';
        `);
      }
      if (!(await columnExists(queryInterface, 'Products', 'slug'))) {
        await queryInterface.addColumn('Products', 'slug', { type: Sequelize.STRING(80), allowNull: true });
      }
      if (!(await columnExists(queryInterface, 'Products', 'currency'))) {
        await queryInterface.addColumn('Products', 'currency', {
          type: Sequelize.STRING(8),
          allowNull: false,
          defaultValue: 'EUR',
        });
      }
      if (!(await columnExists(queryInterface, 'Products', 'images'))) {
        await queryInterface.addColumn('Products', 'images', { type: Sequelize.JSON, allowNull: true });
      }
      if (!(await columnExists(queryInterface, 'Products', 'condition'))) {
        await queryInterface.addColumn('Products', 'condition', {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'new',
        });
      }
      if (!(await columnExists(queryInterface, 'Products', 'acceptsJoncoin'))) {
        await queryInterface.addColumn('Products', 'acceptsJoncoin', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        });
      }
      await queryInterface.sequelize.query(`UPDATE "Products" SET stock = 0 WHERE stock < 0;`);
      await queryInterface.sequelize.query(`UPDATE "Products" SET status = 'out_of_stock' WHERE stock <= 0 AND status = 'active';`);
      await queryInterface.sequelize.query(`UPDATE "Products" SET slug = 'product-' || id WHERE slug IS NULL OR slug = '';`);
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON "Products" ("slug") WHERE slug IS NOT NULL;
      `);
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_nonnegative') THEN
            ALTER TABLE "Products" ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0);
          END IF;
        END $$;
      `);
    }

    if (has('Orders')) {
      const orderColumns = {
        currency: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'JON' },
        grossAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        platformFeeAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        sellerNetAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        paymentMethod: { type: Sequelize.STRING(32), allowNull: true },
        idempotencyKey: { type: Sequelize.STRING(120), allowNull: true },
        stockRestored: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        paidAt: { type: Sequelize.DATE, allowNull: true },
        shippedAt: { type: Sequelize.DATE, allowNull: true },
        deliveredAt: { type: Sequelize.DATE, allowNull: true },
        refundedAt: { type: Sequelize.DATE, allowNull: true },
        cancelledAt: { type: Sequelize.DATE, allowNull: true },
      };
      for (const [name, spec] of Object.entries(orderColumns)) {
        if (!(await columnExists(queryInterface, 'Orders', name))) {
          await queryInterface.addColumn('Orders', name, spec);
        }
      }
      await queryInterface.sequelize.query(`
        UPDATE "Orders"
        SET "grossAmount" = "totalAmount",
            "platformFeeAmount" = 0,
            "sellerNetAmount" = "totalAmount"
        WHERE "grossAmount" IS NULL;
      `);
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_idempotency
        ON "Orders" ("userId", "idempotencyKey", "sellerId")
        WHERE "idempotencyKey" IS NOT NULL;
      `);
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS orders_buyer_status ON "Orders" ("userId", "status");
      `);
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS orders_seller_status ON "Orders" ("sellerId", "status");
      `);
    }

    if (!has('CartItems')) {
      await queryInterface.createTable('CartItems', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        productId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Products', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addConstraint('CartItems', {
        fields: ['userId', 'productId'],
        type: 'unique',
        name: 'cart_items_user_product_unique',
      });
    }

    if (!has('PaymentEvents')) {
      await queryInterface.createTable('PaymentEvents', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        provider: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'stripe' },
        eventId: { type: Sequelize.STRING(191), allowNull: false, unique: true },
        type: { type: Sequelize.STRING(120), allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PaymentEvents').catch(() => {});
    await queryInterface.dropTable('CartItems').catch(() => {});
    const orderCols = [
      'currency', 'grossAmount', 'platformFeeAmount', 'sellerNetAmount', 'paymentMethod',
      'idempotencyKey', 'stockRestored', 'paidAt', 'shippedAt', 'deliveredAt', 'refundedAt', 'cancelledAt',
    ];
    for (const col of orderCols) {
      await queryInterface.removeColumn('Orders', col).catch(() => {});
    }
    for (const col of ['slug', 'currency', 'images', 'condition', 'status', 'acceptsJoncoin']) {
      await queryInterface.removeColumn('Products', col).catch(() => {});
    }
    for (const col of ['currency', 'balanceBefore', 'balanceAfter', 'idempotencyKey']) {
      await queryInterface.removeColumn('JonCoinTransactions', col).catch(() => {});
    }
  },
};
