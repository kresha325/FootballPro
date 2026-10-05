'use strict';

async function describeSafe(queryInterface, table) {
  try {
    return await queryInterface.describeTable(table);
  } catch (_err) {
    return null;
  }
}

async function ensureColumn(queryInterface, table, column, spec) {
  const desc = await describeSafe(queryInterface, table);
  if (!desc || desc[column]) return;
  await queryInterface.addColumn(table, column, spec);
}

async function ensureIndex(queryInterface, table, fields, name, options = {}) {
  const desc = await describeSafe(queryInterface, table);
  if (!desc) return;
  try {
    await queryInterface.addIndex(table, fields, { name, ...options });
  } catch (_err) {
    /* index already exists */
  }
}

/** Indexes and peak viewers for the canonical analytics reads. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const int = { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 };

    await ensureColumn(queryInterface, 'LiveStreamAnalytics', 'peakViewers', int);
    await ensureColumn(queryInterface, 'PostAnalytics', 'userId', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, 'PostAnalytics', 'type', { type: Sequelize.STRING(16), allowNull: true });

    await queryInterface.sequelize.query(`
      UPDATE "EngagementMetrics" keep
      SET
        "profileViews" = merged.views,
        "postViews" = merged.post_views,
        "likesReceived" = merged.likes,
        "commentsReceived" = merged.comments,
        "sharesReceived" = merged.shares,
        "followersGained" = merged.followers,
        "postsCreated" = merged.posts
      FROM (
        SELECT MAX(id) AS id,
               SUM(COALESCE("profileViews", 0)) AS views,
               SUM(COALESCE("postViews", 0)) AS post_views,
               SUM(COALESCE("likesReceived", 0)) AS likes,
               SUM(COALESCE("commentsReceived", 0)) AS comments,
               SUM(COALESCE("sharesReceived", 0)) AS shares,
               SUM(COALESCE("followersGained", 0)) AS followers,
               SUM(COALESCE("postsCreated", 0)) AS posts
        FROM "EngagementMetrics"
        GROUP BY "userId", date
        HAVING COUNT(*) > 1
      ) merged
      WHERE keep.id = merged.id
    `).catch(() => {});
    await queryInterface.sequelize.query(`
      DELETE FROM "EngagementMetrics" a
      USING "EngagementMetrics" b
      WHERE a."userId" = b."userId"
        AND a.date = b.date
        AND a.id < b.id
    `).catch(() => {});

    await ensureIndex(queryInterface, 'EngagementMetrics', ['userId', 'date'], 'engagement_metrics_user_date_uidx', { unique: true });
    await ensureIndex(queryInterface, 'PostAnalytics', ['postId', 'type', 'createdAt'], 'post_analytics_post_type_created_idx');
    await ensureIndex(queryInterface, 'PostAnalytics', ['userId', 'type', 'createdAt'], 'post_analytics_user_type_created_idx');
    await ensureIndex(queryInterface, 'ProfileViews', ['profileId', 'viewedAt'], 'profile_views_profile_viewed_idx');
    await ensureIndex(queryInterface, 'LiveStreamAnalytics', ['streamId'], 'live_stream_analytics_stream_idx');
    await ensureIndex(queryInterface, 'Orders', ['sellerId', 'status', 'createdAt'], 'orders_seller_status_created_idx');
    await ensureIndex(queryInterface, 'JonCoinTransactions', ['userId', 'type', 'status', 'createdAt'], 'joncoin_tx_user_type_status_created_idx');
    await ensureIndex(queryInterface, 'Videos', ['userId'], 'videos_user_idx');
    await ensureIndex(queryInterface, 'Videos', ['playerId'], 'videos_player_idx');
    await ensureIndex(queryInterface, 'Videos', ['matchId'], 'videos_match_idx');
    await ensureIndex(queryInterface, 'Videos', ['tournamentId'], 'videos_tournament_idx');
    await ensureIndex(queryInterface, 'Streams', ['streamerId', 'startedAt'], 'streams_streamer_started_idx');
    await ensureIndex(queryInterface, 'Streams', ['tournamentId'], 'streams_tournament_idx');
  },

  async down(queryInterface) {
    const names = [
      'engagement_metrics_user_date_uidx',
      'post_analytics_post_type_created_idx',
      'post_analytics_user_type_created_idx',
      'profile_views_profile_viewed_idx',
      'live_stream_analytics_stream_idx',
      'orders_seller_status_created_idx',
      'joncoin_tx_user_type_status_created_idx',
      'videos_user_idx',
      'videos_player_idx',
      'videos_match_idx',
      'videos_tournament_idx',
      'streams_streamer_started_idx',
      'streams_tournament_idx',
    ];
    for (const name of names) {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${name}"`).catch(() => {});
    }
  },
};
