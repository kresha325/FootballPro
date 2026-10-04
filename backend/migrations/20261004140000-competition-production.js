'use strict';

/**
 * Production columns for competitions, fixtures, match events, and player match stats.
 * Status/type columns become VARCHAR so lifecycle and new formats can be stored
 * without a second competition table.
 */

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
  return names.includes(table);
}

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

async function widenEnumColumn(queryInterface, table, column) {
  const dialect = queryInterface.sequelize.getDialect();
  if (dialect !== 'postgres') return;
  try {
    await queryInterface.sequelize.query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE VARCHAR(32) USING "${column}"::text`
    );
  } catch (_err) {
    /* already varchar, or column missing */
  }
}

async function ensureIndex(queryInterface, table, fields, options) {
  try {
    await queryInterface.addIndex(table, fields, options);
  } catch (_err) {
    /* duplicate data or index already present */
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'Tournaments'))) return;

    await widenEnumColumn(queryInterface, 'Tournaments', 'status');
    await widenEnumColumn(queryInterface, 'Tournaments', 'type');
    if (await tableExists(queryInterface, 'Matches')) {
      await widenEnumColumn(queryInterface, 'Matches', 'status');
    }

    const string = (len, extra = {}) => ({ type: Sequelize.STRING(len), allowNull: true, ...extra });
    const integer = (extra = {}) => ({ type: Sequelize.INTEGER, allowNull: true, ...extra });
    const bool = (defaultValue) => ({
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue,
    });

    const tournamentColumns = {
      slug: string(80),
      logo: string(500),
      organizer: string(160),
      country: string(80),
      city: string(80),
      gender: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'open' },
      registrationDeadline: { type: Sequelize.DATE, allowNull: true },
      lifecycle: { type: Sequelize.STRING(32), allowNull: true },
      qualifyPerGroup: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 2 },
      homeAndAway: bool(false),
      groupsCount: integer(),
    };
    for (const [name, spec] of Object.entries(tournamentColumns)) {
      await ensureColumn(queryInterface, 'Tournaments', name, spec);
    }

    await ensureColumn(queryInterface, 'TournamentParticipants', 'groupName', string(8));
    await ensureColumn(queryInterface, 'TournamentParticipants', 'seed', integer());

    const matchColumns = {
      groupName: string(8),
      stage: string(16),
      roundLabel: string(40),
      halfTimeHome: integer(),
      halfTimeAway: integer(),
      extraTimeHome: integer(),
      extraTimeAway: integer(),
      penaltiesHome: integer(),
      penaltiesAway: integer(),
      winnerUserId: integer(),
      decidedBy: string(24),
      refereeUserId: integer(),
      refereeName: string(120),
      venue: string(160),
      highlightsUrl: string(500),
      publicSlug: string(80),
      clockMinute: integer(),
      clockPhase: string(8),
      lineup: { type: Sequelize.JSON, allowNull: true },
    };
    if (await tableExists(queryInterface, 'Matches')) {
      for (const [name, spec] of Object.entries(matchColumns)) {
        await ensureColumn(queryInterface, 'Matches', name, spec);
      }
    }

    try {
      await queryInterface.sequelize.query(`
        UPDATE "Tournaments"
        SET "lifecycle" = CASE
          WHEN "status" = 'open' THEN 'registration'
          WHEN "status" = 'ongoing' THEN 'in_progress'
          WHEN "status" = 'finished' THEN 'completed'
          WHEN "status" = 'draft' THEN 'draft'
          WHEN "status" = 'cancelled' THEN 'cancelled'
          WHEN "status" = 'active' THEN 'active'
          ELSE COALESCE("lifecycle", 'registration')
        END
        WHERE "lifecycle" IS NULL OR "lifecycle" = ''
      `);
    } catch (_err) {
      /* naming differences on a fresh database */
    }

    await ensureIndex(queryInterface, 'Tournaments', ['slug'], {
      unique: true,
      name: 'tournaments_slug_unique',
    });
    await ensureIndex(queryInterface, 'Tournaments', ['status'], { name: 'tournaments_status_idx' });
    await ensureIndex(queryInterface, 'Tournaments', ['season'], { name: 'tournaments_season_idx' });
    await ensureIndex(queryInterface, 'TournamentParticipants', ['tournamentId', 'userId'], {
      unique: true,
      name: 'tournament_participant_unique',
    });
    if (await tableExists(queryInterface, 'Matches')) {
      await ensureIndex(queryInterface, 'Matches', ['tournamentId', 'status'], { name: 'matches_tournament_status_idx' });
      await ensureIndex(queryInterface, 'Matches', ['matchDate'], { name: 'matches_match_date_idx' });
      await ensureIndex(queryInterface, 'Matches', ['publicSlug'], {
        unique: true,
        name: 'matches_public_slug_unique',
      });
    }

    if (!(await tableExists(queryInterface, 'MatchEvents'))) {
      await queryInterface.createTable('MatchEvents', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        matchId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Matches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        type: { type: Sequelize.STRING(32), allowNull: false },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        relatedUserId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        side: { type: Sequelize.STRING(8), allowNull: true },
        minute: { type: Sequelize.INTEGER, allowNull: true },
        detail: { type: Sequelize.STRING(500), allowNull: true },
        eventKey: { type: Sequelize.STRING(200), allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await ensureIndex(queryInterface, 'MatchEvents', ['matchId', 'eventKey'], {
        unique: true,
        name: 'match_events_unique_key',
      });
      await ensureIndex(queryInterface, 'MatchEvents', ['matchId'], { name: 'match_events_match_idx' });
    }

    if (!(await tableExists(queryInterface, 'PlayerMatchStats'))) {
      await queryInterface.createTable('PlayerMatchStats', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        matchId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Matches', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        side: { type: Sequelize.STRING(8), allowNull: true },
        started: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        goals: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        assists: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        shots: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        shotsOnTarget: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        passes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        keyPasses: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        fouls: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        yellowCards: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        redCards: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        saves: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        cleanSheet: { type: Sequelize.BOOLEAN, allowNull: true },
        goalkeeper: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        rating: { type: Sequelize.DECIMAL(3, 1), allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await ensureIndex(queryInterface, 'PlayerMatchStats', ['matchId', 'userId'], {
        unique: true,
        name: 'player_match_stats_unique',
      });
      await ensureIndex(queryInterface, 'PlayerMatchStats', ['userId'], { name: 'player_match_stats_user_idx' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PlayerMatchStats').catch(() => {});
    await queryInterface.dropTable('MatchEvents').catch(() => {});
  },
};
