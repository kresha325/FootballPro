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

async function ensureIndex(queryInterface, table, fields, name) {
  try {
    await queryInterface.addIndex(table, fields, { name });
  } catch (_err) {
    /* index already exists */
  }
}

async function dropColumnSafe(queryInterface, table, column) {
  const desc = await describeSafe(queryInterface, table);
  if (!desc || !desc[column]) return;
  await queryInterface.removeColumn(table, column);
}

/** Canonical stream lifecycle, associations, and media highlight metadata. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const str = (len, extra = {}) => ({ type: Sequelize.STRING(len), allowNull: true, ...extra });

    await ensureColumn(queryInterface, 'Streams', 'status', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'ready',
    });
    await ensureColumn(queryInterface, 'Streams', 'visibility', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'public',
    });
    await ensureColumn(queryInterface, 'Streams', 'provider', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'livekit',
    });
    await ensureColumn(queryInterface, 'Streams', 'providerId', str(128));
    await ensureColumn(queryInterface, 'Streams', 'thumbnailUrl', str(512));
    await ensureColumn(queryInterface, 'Streams', 'scheduledAt', { type: Sequelize.DATE, allowNull: true });
    await ensureColumn(queryInterface, 'Streams', 'startedAt', { type: Sequelize.DATE, allowNull: true });
    await ensureColumn(queryInterface, 'Streams', 'endedAt', { type: Sequelize.DATE, allowNull: true });
    await ensureColumn(queryInterface, 'Streams', 'matchId', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, 'Streams', 'tournamentId', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, 'Streams', 'playerId', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, 'Streams', 'clubId', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, 'Streams', 'featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await ensureColumn(queryInterface, 'Streams', 'notifiedStartingSoon', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await ensureIndex(queryInterface, 'Streams', ['status', 'scheduledAt'], 'streams_status_scheduled');
    await ensureIndex(queryInterface, 'Streams', ['streamerId', 'isLive'], 'streams_streamer_live');
    await ensureIndex(queryInterface, 'Streams', ['matchId'], 'streams_match');
    await ensureIndex(queryInterface, 'Streams', ['tournamentId'], 'streams_tournament');
    await ensureIndex(queryInterface, 'Streams', ['isLive', 'updatedAt'], 'streams_live_updated');

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS streams_provider_provider_id_unique
      ON "Streams" ("provider", "providerId")
      WHERE "providerId" IS NOT NULL
    `).catch(() => {});

    await ensureColumn(queryInterface, 'Videos', 'visibility', {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: 'public',
    });
    await ensureColumn(queryInterface, 'Videos', 'playerId', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, 'Videos', 'matchId', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, 'Videos', 'tournamentId', { type: Sequelize.INTEGER, allowNull: true });
    await ensureColumn(queryInterface, 'Videos', 'season', str(64));
    await ensureColumn(queryInterface, 'Videos', 'featured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await ensureColumn(queryInterface, 'Videos', 'provider', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'upload',
    });
    await ensureColumn(queryInterface, 'Videos', 'providerId', str(191));
    await ensureIndex(queryInterface, 'Videos', ['userId', 'category'], 'videos_user_category');
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS videos_provider_provider_id_unique
      ON "Videos" ("provider", "providerId")
      WHERE "providerId" IS NOT NULL
    `).catch(() => {});

    await ensureColumn(queryInterface, 'MediaItems', 'tags', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await ensureColumn(queryInterface, 'MediaItems', 'timestampSeconds', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await ensureColumn(queryInterface, 'MediaItems', 'highlightTag', str(32));
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS streams_provider_provider_id_unique').catch(() => {});
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS videos_provider_provider_id_unique').catch(() => {});
    const streamCols = [
      'status', 'visibility', 'provider', 'providerId', 'thumbnailUrl', 'scheduledAt',
      'startedAt', 'endedAt', 'matchId', 'tournamentId', 'playerId', 'clubId',
      'featured', 'notifiedStartingSoon',
    ];
    for (const col of streamCols) {
      await dropColumnSafe(queryInterface, 'Streams', col);
    }
    const videoCols = ['visibility', 'playerId', 'matchId', 'tournamentId', 'season', 'featured', 'provider', 'providerId'];
    for (const col of videoCols) {
      await dropColumnSafe(queryInterface, 'Videos', col);
    }
    for (const col of ['tags', 'timestampSeconds', 'highlightTag']) {
      await dropColumnSafe(queryInterface, 'MediaItems', col);
    }
  },
};
