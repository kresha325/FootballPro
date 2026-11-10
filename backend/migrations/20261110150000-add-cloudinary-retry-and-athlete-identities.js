'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const hasTable = (name) => tables.some((table) => String(table).toLowerCase() === name.toLowerCase());
    const columns = async (table) => hasTable(table) ? queryInterface.describeTable(table) : {};
    const addIfMissing = async (table, name, definition) => {
      const desc = await columns(table);
      if (desc[name]) return;
      await queryInterface.addColumn(table, name, definition);
    };

    if (!hasTable('CloudinaryMediaJobs')) {
      await queryInterface.createTable('CloudinaryMediaJobs', {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
        resourceType: { type: Sequelize.STRING(16), allowNull: false },
        publicId: { type: Sequelize.STRING(512), allowNull: false },
        fromType: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'upload' },
        toType: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'authenticated' },
        reason: { type: Sequelize.STRING(64), allowNull: false },
        status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'pending' },
        attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        nextAttemptAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        lastError: { type: Sequelize.STRING(500), allowNull: true },
        completedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
    }
    await queryInterface.addIndex('CloudinaryMediaJobs', ['resourceType', 'publicId', 'toType'], { unique: true, name: 'cloudinary_media_jobs_asset_target_uq' }).catch((error) => {
      if (!/already exists|already defined/i.test(error.message)) throw error;
    });
    await queryInterface.addIndex('CloudinaryMediaJobs', ['status', 'nextAttemptAt'], { name: 'cloudinary_media_jobs_retry_idx' }).catch((error) => {
      if (!/already exists|already defined/i.test(error.message)) throw error;
    });

    // The LiveStreamReplay model uses Sequelize timestamps, but older installs
    // may have the original table without updatedAt. Media restriction queries
    // must remain usable for account deletion and consent withdrawal.
    if (hasTable('LiveStreamReplays')) {
      await addIfMissing('LiveStreamReplays', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      });
    }

    const statColumns = await columns('TournamentClubPlayerStats');
    if (Object.keys(statColumns).length) {
      await addIfMissing('TournamentClubPlayerStats', 'athleteIdentityKey', { type: Sequelize.UUID, allowNull: true });
      // Every legacy row receives its own identity. Same-name historical rows
      // intentionally remain separate because their real-world identity is unknown.
      await queryInterface.sequelize.query(`
        UPDATE "TournamentClubPlayerStats"
        SET "athleteIdentityKey" = gen_random_uuid()
        WHERE "athleteIdentityKey" IS NULL
      `);
      await queryInterface.changeColumn('TournamentClubPlayerStats', 'athleteIdentityKey', { type: Sequelize.UUID, allowNull: false });
      await queryInterface.removeIndex('TournamentClubPlayerStats', 'tournament_club_player_stats_entry_name_uq').catch(() => {});
      await queryInterface.addIndex('TournamentClubPlayerStats', ['tournamentClubEntryId', 'athleteIdentityKey'], { unique: true, name: 'tournament_club_player_stats_entry_identity_uq' }).catch((error) => {
        if (!/already exists|already defined/i.test(error.message)) throw error;
      });
    }
    for (const table of ['MatchScorers', 'PlayerMatchStats']) {
      const desc = await columns(table);
      if (!Object.keys(desc).length) continue;
      await addIfMissing(table, 'athleteIdentityKey', { type: Sequelize.UUID, allowNull: true });
      // Registered-user rows are identified by userId and leave this nullable.
      // Unknown-athlete rows receive an independent identity; same-name rows
      // are intentionally never collapsed during backfill.
      await queryInterface.sequelize.query(`
        UPDATE "${table}"
        SET "athleteIdentityKey" = gen_random_uuid()
        WHERE "athleteIdentityKey" IS NULL AND "userId" IS NULL
      `);
      await queryInterface.addIndex(table, ['athleteIdentityKey'], { name: `${table === 'MatchScorers' ? 'match_scorers' : 'player_match_stats'}_athlete_identity_idx` }).catch((error) => {
        if (!/already exists|already defined/i.test(error.message)) throw error;
      });
    }
  },

  async down() {
    throw new Error('Identity keys and Cloudinary retry history are retained; roll back application code only.');
  },
};
