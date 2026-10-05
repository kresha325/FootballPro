'use strict';

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  const names = tables.map((item) => (typeof item === 'string' ? item : item.tableName || item.name));
  return names.includes(table);
}

async function ensureIndex(queryInterface, table, fields, options) {
  try {
    await queryInterface.addIndex(table, fields, options);
  } catch (_err) {
    /* index already present */
  }
}

const userFk = {
  type: 'INTEGER',
  allowNull: false,
  references: { model: 'Users', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'CASCADE',
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const json = { type: Sequelize.JSON, allowNull: true };
    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    };

    if (!(await tableExists(queryInterface, 'ScoutShortlists'))) {
      await queryInterface.createTable('ScoutShortlists', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        scoutId: userFk,
        playerId: userFk,
        note: { type: Sequelize.TEXT, allowNull: true },
        priority: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'MEDIUM' },
        status: { type: Sequelize.STRING(24), allowNull: false, defaultValue: 'NEW' },
        followUpDate: { type: Sequelize.DATEONLY, allowNull: true },
        ...timestamps,
      });
    }
    await ensureIndex(queryInterface, 'ScoutShortlists', ['scoutId', 'playerId'], {
      unique: true,
      name: 'scout_shortlists_scout_player_unique',
    });
    await ensureIndex(queryInterface, 'ScoutShortlists', ['scoutId', 'status'], { name: 'scout_shortlists_scout_status' });
    await ensureIndex(queryInterface, 'ScoutShortlists', ['scoutId', 'followUpDate'], { name: 'scout_shortlists_follow_up' });

    if (!(await tableExists(queryInterface, 'ScoutWatchlists'))) {
      await queryInterface.createTable('ScoutWatchlists', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        scoutId: userFk,
        playerId: userFk,
        lastViewedAt: { type: Sequelize.DATE, allowNull: true },
        snapshot: json,
        ...timestamps,
      });
    }
    await ensureIndex(queryInterface, 'ScoutWatchlists', ['scoutId', 'playerId'], {
      unique: true,
      name: 'scout_watchlists_scout_player_unique',
    });

    if (!(await tableExists(queryInterface, 'ScoutWatchEvents'))) {
      await queryInterface.createTable('ScoutWatchEvents', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        watchlistId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'ScoutWatchlists', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        scoutId: userFk,
        playerId: userFk,
        type: { type: Sequelize.STRING(32), allowNull: false },
        summary: { type: Sequelize.TEXT, allowNull: false },
        payload: json,
        seenAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: timestamps.createdAt,
      });
    }
    await ensureIndex(queryInterface, 'ScoutWatchEvents', ['scoutId', 'createdAt'], { name: 'scout_watch_events_scout_created' });

    if (!(await tableExists(queryInterface, 'ScoutingReports'))) {
      await queryInterface.createTable('ScoutingReports', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        scoutId: userFk,
        playerId: userFk,
        reportDate: { type: Sequelize.DATEONLY, allowNull: false },
        tournamentId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Tournaments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        matchId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Matches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'draft' },
        positionGroup: { type: Sequelize.STRING(24), allowNull: true },
        technical: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
        physical: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
        tactical: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
        mental: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
        positionSpecific: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
        strengths: { type: Sequelize.TEXT, allowNull: true },
        weaknesses: { type: Sequelize.TEXT, allowNull: true },
        potential: { type: Sequelize.TEXT, allowNull: true },
        potentialRating: { type: Sequelize.DECIMAL(3, 1), allowNull: true },
        recommendation: { type: Sequelize.STRING(16), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        technicalRating: { type: Sequelize.DECIMAL(3, 1), allowNull: true },
        physicalRating: { type: Sequelize.DECIMAL(3, 1), allowNull: true },
        tacticalRating: { type: Sequelize.DECIMAL(3, 1), allowNull: true },
        mentalRating: { type: Sequelize.DECIMAL(3, 1), allowNull: true },
        overallRating: { type: Sequelize.DECIMAL(3, 1), allowNull: true },
        ...timestamps,
      });
    }
    await ensureIndex(queryInterface, 'ScoutingReports', ['scoutId', 'playerId'], { name: 'scouting_reports_scout_player' });
    await ensureIndex(queryInterface, 'ScoutingReports', ['scoutId', 'status'], { name: 'scouting_reports_scout_status' });
    await ensureIndex(queryInterface, 'ScoutingReports', ['matchId'], { name: 'scouting_reports_match' });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS scouting_reports_scout_player_match_unique
        ON "ScoutingReports" ("scoutId", "playerId", "matchId")
        WHERE "matchId" IS NOT NULL
      `);
    }

    if (!(await tableExists(queryInterface, 'ScoutPreferences'))) {
      await queryInterface.createTable('ScoutPreferences', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        scoutId: { ...userFk },
        positions: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
        minAge: { type: Sequelize.INTEGER, allowNull: true },
        maxAge: { type: Sequelize.INTEGER, allowNull: true },
        countries: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
        foot: { type: Sequelize.STRING(16), allowNull: true },
        competitionLevel: { type: Sequelize.STRING(80), allowNull: true },
        ...timestamps,
      });
    }
    await ensureIndex(queryInterface, 'ScoutPreferences', ['scoutId'], {
      unique: true,
      name: 'scout_preferences_scout_unique',
    });

    if (await tableExists(queryInterface, 'Profiles')) {
      await ensureIndex(queryInterface, 'Profiles', ['position'], { name: 'profiles_position' });
      await ensureIndex(queryInterface, 'Profiles', ['country'], { name: 'profiles_country' });
      await ensureIndex(queryInterface, 'Profiles', ['age'], { name: 'profiles_age' });
      await ensureIndex(queryInterface, 'Profiles', ['club'], { name: 'profiles_club' });
    }
    if (await tableExists(queryInterface, 'Tournaments')) {
      await ensureIndex(queryInterface, 'Tournaments', ['season'], { name: 'tournaments_season' });
    }
    if (await tableExists(queryInterface, 'Matches')) {
      await ensureIndex(queryInterface, 'Matches', ['matchDate'], { name: 'matches_match_date' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ScoutWatchEvents');
    await queryInterface.dropTable('ScoutWatchlists');
    await queryInterface.dropTable('ScoutingReports');
    await queryInterface.dropTable('ScoutShortlists');
    await queryInterface.dropTable('ScoutPreferences');
  },
};
