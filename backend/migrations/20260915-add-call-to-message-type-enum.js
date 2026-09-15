'use strict';

/** Add Messages.type enum value `call` for call system bubbles in chat. */
module.exports = {
  async up(queryInterface) {
    // Postgres enum name from Sequelize createTable ENUM on Messages.type
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'enum_Messages_type' AND e.enumlabel = 'call'
        ) THEN
          ALTER TYPE "enum_Messages_type" ADD VALUE 'call';
        END IF;
      END $$;
    `);
  },

  async down() {
    // Postgres cannot easily remove enum values; leave as no-op.
  },
};
