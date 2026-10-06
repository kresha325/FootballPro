'use strict';

/**
 * Early migrations create Comments, Likes, Products, Profiles, Posts, Streams
 * and Tournaments before Users exists. Foreign keys are added here, after every
 * parent table is available, and only when the constraint is still missing.
 */

async function columnExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = :table AND column_name = :column
     LIMIT 1`,
    { replacements: { table, column } }
  );
  return rows.length > 0;
}

async function foreignKeyExists(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
     FROM pg_constraint c
     JOIN pg_class rel ON rel.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = rel.relnamespace
     JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f'
       AND n.nspname = 'public'
       AND rel.relname = :table
       AND a.attname = :column
     LIMIT 1`,
    { replacements: { table, column } }
  );
  return rows.length > 0;
}

async function addForeignKey(queryInterface, spec) {
  const refColumn = spec.refColumn || 'id';
  if (!(await columnExists(queryInterface, spec.table, spec.column))) return;
  if (!(await columnExists(queryInterface, spec.refTable, refColumn))) return;
  if (await foreignKeyExists(queryInterface, spec.table, spec.column)) return;
  await queryInterface.addConstraint(spec.table, {
    fields: [spec.column],
    type: 'foreign key',
    name: spec.name,
    references: { table: spec.refTable, field: refColumn },
    onDelete: spec.onDelete,
    onUpdate: 'CASCADE',
  });
}

const FOREIGN_KEYS = [
  { table: 'Comments', column: 'userId', refTable: 'Users', onDelete: 'CASCADE', name: 'Comments_userId_fkey' },
  { table: 'Comments', column: 'postId', refTable: 'Posts', onDelete: 'CASCADE', name: 'Comments_postId_fkey' },
  { table: 'Likes', column: 'userId', refTable: 'Users', onDelete: 'CASCADE', name: 'Likes_userId_fkey' },
  { table: 'Likes', column: 'postId', refTable: 'Posts', onDelete: 'CASCADE', name: 'Likes_postId_fkey' },
  { table: 'Products', column: 'sellerId', refTable: 'Users', onDelete: 'CASCADE', name: 'Products_sellerId_fkey' },
  { table: 'Profiles', column: 'userId', refTable: 'Users', onDelete: 'CASCADE', name: 'Profiles_userId_fkey' },
  { table: 'UserRewards', column: 'userId', refTable: 'Users', onDelete: 'CASCADE', name: 'UserRewards_userId_fkey' },
  { table: 'Streams', column: 'streamerId', refTable: 'Users', onDelete: 'CASCADE', name: 'Streams_streamerId_fkey' },
  { table: 'Posts', column: 'userId', refTable: 'Users', onDelete: 'SET NULL', name: 'Posts_userId_fkey' },
  { table: 'Tournaments', column: 'creatorId', refTable: 'Users', onDelete: 'SET NULL', name: 'Tournaments_creatorId_fkey' },
  { table: 'TournamentParticipants', column: 'userId', refTable: 'Users', onDelete: 'CASCADE', name: 'TournamentParticipants_userId_fkey' },
];

module.exports = {
  up: async (queryInterface) => {
    for (const spec of FOREIGN_KEYS) {
      await addForeignKey(queryInterface, spec);
    }
  },

  down: async (queryInterface) => {
    for (const spec of FOREIGN_KEYS) {
      await queryInterface.removeConstraint(spec.table, spec.name).catch(() => {});
    }
  },
};
