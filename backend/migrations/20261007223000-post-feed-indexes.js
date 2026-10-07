'use strict';

/**
 * Indexes for paginated post lists and the bulk like/comment/sponsor lookups.
 * Skips any index that already exists.
 */

const INDEXES = [
  { table: 'Posts', fields: ['createdAt', 'id'], name: 'posts_created_at_id_idx' },
  { table: 'Posts', fields: ['userId', 'createdAt'], name: 'posts_user_created_at_idx' },
  { table: 'Likes', fields: ['userId', 'postId'], name: 'likes_user_post_idx' },
  { table: 'PostSponsors', fields: ['postId'], name: 'post_sponsors_post_id_idx' },
  { table: 'PostSponsors', fields: ['sponsorId'], name: 'post_sponsors_sponsor_id_idx' },
  { table: 'Sponsors', fields: ['userId'], name: 'sponsors_user_id_idx' },
  { table: 'Follows', fields: ['followingId'], name: 'follows_following_id_idx' },
  { table: 'Follows', fields: ['followerId', 'status'], name: 'follows_follower_status_idx' },
];

async function indexExists(queryInterface, name) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = :name LIMIT 1`,
    { replacements: { name } }
  );
  return rows.length > 0;
}

async function columnsExist(queryInterface, table, fields) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = :table AND column_name IN (:fields)`,
    { replacements: { table, fields } }
  );
  return rows.length === fields.length;
}

module.exports = {
  up: async (queryInterface) => {
    for (const spec of INDEXES) {
      if (await indexExists(queryInterface, spec.name)) continue;
      if (!(await columnsExist(queryInterface, spec.table, spec.fields))) continue;
      await queryInterface.addIndex(spec.table, spec.fields, { name: spec.name });
    }
  },

  down: async (queryInterface) => {
    for (const spec of INDEXES) {
      if (await indexExists(queryInterface, spec.name)) {
        await queryInterface.removeIndex(spec.table, spec.name);
      }
    }
  },
};
