'use strict';

/**
 * Foreign keys created before their parent tables had no supporting indexes.
 * These cover the columns used to load a user's posts, comments, matches and
 * payments. Existing indexes are left alone.
 */

const INDEXES = [
  { table: 'Comments', fields: ['postId'], name: 'comments_post_id_idx' },
  { table: 'Comments', fields: ['userId'], name: 'comments_user_id_idx' },
  { table: 'Likes', fields: ['postId'], name: 'likes_post_id_idx' },
  { table: 'Likes', fields: ['userId'], name: 'likes_user_id_idx' },
  { table: 'Posts', fields: ['userId'], name: 'posts_user_id_idx' },
  { table: 'Products', fields: ['sellerId'], name: 'products_seller_id_idx' },
  { table: 'Matches', fields: ['homeUserId'], name: 'matches_home_user_id_idx' },
  { table: 'Matches', fields: ['awayUserId'], name: 'matches_away_user_id_idx' },
  { table: 'MatchScorers', fields: ['matchId'], name: 'match_scorers_match_id_idx' },
  { table: 'MatchScorers', fields: ['userId'], name: 'match_scorers_user_id_idx' },
  { table: 'MatchEvents', fields: ['matchId'], name: 'match_events_match_id_idx' },
  { table: 'MatchEvents', fields: ['userId'], name: 'match_events_user_id_idx' },
  { table: 'Payments', fields: ['userId'], name: 'payments_user_id_idx' },
  { table: 'Messages', fields: ['receiverId'], name: 'messages_receiver_id_idx' },
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

    const profileIndex = 'profiles_user_id_unique';
    if (!(await indexExists(queryInterface, profileIndex))) {
      const [dupes] = await queryInterface.sequelize.query(
        `SELECT "userId" FROM "Profiles" GROUP BY "userId" HAVING COUNT(*) > 1 LIMIT 1`
      );
      if (!dupes.length) {
        await queryInterface.addIndex('Profiles', ['userId'], { name: profileIndex, unique: true });
      } else {
        console.warn('profiles_user_id_unique skipped: duplicate Profiles.userId rows exist');
      }
    }
  },

  down: async (queryInterface) => {
    for (const spec of INDEXES) {
      if (await indexExists(queryInterface, spec.name)) {
        await queryInterface.removeIndex(spec.table, spec.name);
      }
    }
    if (await indexExists(queryInterface, 'profiles_user_id_unique')) {
      await queryInterface.removeIndex('Profiles', 'profiles_user_id_unique');
    }
  },
};
