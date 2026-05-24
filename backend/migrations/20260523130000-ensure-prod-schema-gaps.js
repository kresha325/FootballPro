'use strict';

/**
 * Idempotent catch-up for production: columns/tables that older migrations
 * may have skipped (e.g. broken 20260119 export) or that never had a migration.
 */

async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => String(t).toLowerCase());
  return normalized.includes(String(name).toLowerCase());
}

async function columnExists(queryInterface, table, column) {
  try {
    const desc = await queryInterface.describeTable(table);
    return !!desc[column];
  } catch (_e) {
    return false;
  }
}

async function addColumnIfMissing(queryInterface, Sequelize, table, column, definition) {
  if (await columnExists(queryInterface, table, column)) return;
  await queryInterface.addColumn(table, column, definition);
}

async function ensureClubStaffEnums(queryInterface) {
  const blocks = [
    {
      typname: 'enum_ClubStaff_staffRole',
      values: `'president', 'vice_president', 'chairman', 'ceo', 'general_manager', 'sporting_director', 'technical_director',
          'director_of_football', 'academy_director', 'youth_director', 'team_manager', 'secretary_general', 'secretary',
          'head_coach', 'assistant_coach', 'fitness_coach', 'goalkeeper_coach', 'technical_coach', 'tactical_coach',
          'medical_staff', 'doctor', 'assistant_doctor', 'physiotherapist', 'sports_psychologist', 'nutritionist',
          'masseur', 'scout', 'analyst', 'video_analyst', 'media_officer', 'security_officer', 'logistics_manager',
          'kit_manager', 'equipment_manager', 'groundskeeper', 'other'`,
    },
    {
      typname: 'enum_ClubStaff_status',
      values: `'pending', 'active', 'inactive'`,
    },
    {
      typname: 'enum_ClubStaff_teamType',
      values: `'first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'`,
    },
  ];

  for (const { typname, values } of blocks) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typname}') THEN
          CREATE TYPE "${typname}" AS ENUM (${values});
        END IF;
      END$$;
    `);
  }
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') {
      console.warn('ensure-prod-schema-gaps: optimized for Postgres; skipping some enum helpers.');
    }

    // --- Users ---
    if (await tableExists(queryInterface, 'Users')) {
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'resetPasswordToken', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'resetPasswordExpire', {
        type: Sequelize.BIGINT,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'parentEmail', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'parentVerified', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'parentVerificationToken', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'parentVerificationExpire', {
        type: Sequelize.BIGINT,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'clubVerified', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'clubVerifiedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'joncoinBalance', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'premium', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'googleId', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'facebookId', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'pushTokenMobile', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'pushTokenWeb', {
        type: Sequelize.JSON,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'points', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'level', {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Users', 'experience', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });

      if (dialect === 'postgres') {
        await queryInterface.sequelize.query(
          "ALTER TYPE \"enum_Users_role\" ADD VALUE IF NOT EXISTS 'referee';"
        );
        await queryInterface.sequelize.query(
          "ALTER TYPE \"enum_Users_role\" ADD VALUE IF NOT EXISTS 'liga';"
        );
      }
    }

    // --- Profiles ---
    if (await tableExists(queryInterface, 'Profiles')) {
      const profileJsonCols = ['achievements', 'matches', 'media', 'performanceTrend', 'liveVideos'];
      for (const col of profileJsonCols) {
        await addColumnIfMissing(queryInterface, Sequelize, 'Profiles', col, {
          type: Sequelize.JSON,
          allowNull: true,
        });
      }
      await addColumnIfMissing(queryInterface, Sequelize, 'Profiles', 'coverPhoto', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Profiles', 'clubId', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Profiles', 'clubLogo', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Profiles', 'age', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Profiles', 'ageGroup', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Profiles', 'youtubeChannelId', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
      if (!(await columnExists(queryInterface, 'Profiles', 'coachAffiliation'))) {
        await queryInterface.addColumn('Profiles', 'coachAffiliation', {
          type: Sequelize.ENUM('club', 'independent', 'personal_trainer'),
          allowNull: true,
        });
      }
      if (!(await columnExists(queryInterface, 'Profiles', 'coachCategory'))) {
        await queryInterface.addColumn('Profiles', 'coachCategory', {
          type: Sequelize.ENUM(
            'general_trainer',
            'assistant_trainer',
            'fitness_trainer',
            'goalkeeper_trainer',
            'technical_trainer',
            'tactical_trainer',
            'psychological_trainer',
            'youth_trainer',
            'rehabilitation_trainer'
          ),
          allowNull: true,
        });
      }
    }

    // --- Posts / Likes ---
    if (await tableExists(queryInterface, 'Posts')) {
      await addColumnIfMissing(queryInterface, Sequelize, 'Posts', 'location', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Posts', 'locationLat', {
        type: Sequelize.DOUBLE,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Posts', 'locationLng', {
        type: Sequelize.DOUBLE,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Posts', 'mentions', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: [],
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Posts', 'videoUrl', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (await tableExists(queryInterface, 'Likes')) {
      await addColumnIfMissing(queryInterface, Sequelize, 'Likes', 'emoji', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // --- Tournaments ---
    if (await tableExists(queryInterface, 'Tournaments')) {
      await addColumnIfMissing(queryInterface, Sequelize, 'Tournaments', 'participantType', {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'individual',
      });
      await addColumnIfMissing(queryInterface, Sequelize, 'Tournaments', 'season', {
        type: Sequelize.STRING(16),
        allowNull: true,
      });
    }

    // --- Streams (YouTube channel on live sessions) ---
    if (await tableExists(queryInterface, 'Streams')) {
      await addColumnIfMissing(queryInterface, Sequelize, 'Streams', 'youtubeChannelId', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }

    // --- History tables (fix broken 20260119 no-op on fresh/partial prod) ---
    if (!(await tableExists(queryInterface, 'TransferHistories'))) {
      await queryInterface.createTable('TransferHistories', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        transferType: {
          type: Sequelize.ENUM('player_transfer', 'coach_appointment', 'staff_appointment', 'loan'),
          allowNull: false,
        },
        fromClub: { type: Sequelize.STRING, allowNull: true },
        toClub: { type: Sequelize.STRING, allowNull: false },
        position: { type: Sequelize.STRING, allowNull: true },
        season: { type: Sequelize.STRING, allowNull: false },
        transferDate: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        transferFee: { type: Sequelize.STRING, allowNull: true },
        contractUntil: { type: Sequelize.STRING, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (dialect === 'postgres') {
      await ensureClubStaffEnums(queryInterface);
    }

    if (!(await tableExists(queryInterface, 'ClubStaff'))) {
      await queryInterface.createTable('ClubStaff', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        clubId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        staffId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        staffRole: {
          type: Sequelize.ENUM(
            'president',
            'vice_president',
            'chairman',
            'ceo',
            'general_manager',
            'sporting_director',
            'technical_director',
            'director_of_football',
            'academy_director',
            'youth_director',
            'team_manager',
            'secretary_general',
            'secretary',
            'head_coach',
            'assistant_coach',
            'fitness_coach',
            'goalkeeper_coach',
            'technical_coach',
            'tactical_coach',
            'medical_staff',
            'doctor',
            'assistant_doctor',
            'physiotherapist',
            'sports_psychologist',
            'nutritionist',
            'masseur',
            'scout',
            'analyst',
            'video_analyst',
            'media_officer',
            'security_officer',
            'logistics_manager',
            'kit_manager',
            'equipment_manager',
            'groundskeeper',
            'other'
          ),
          allowNull: false,
        },
        status: { type: Sequelize.ENUM('pending', 'active', 'inactive'), defaultValue: 'pending' },
        joinedAt: { type: Sequelize.DATE, allowNull: true },
        leftAt: { type: Sequelize.DATE, allowNull: true },
        contractUntil: { type: Sequelize.STRING, allowNull: true },
        teamType: {
          type: Sequelize.ENUM('first_team', 'youth', 'women', 'men', 'u23', 'u21', 'u19', 'u17', 'u15', 'u13', 'u11', 'u9'),
          defaultValue: 'first_team',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!(await tableExists(queryInterface, 'NationalTeams'))) {
      await queryInterface.createTable('NationalTeams', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        nationalTeamId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        playerId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        teamCategory: {
          type: Sequelize.ENUM(
            'senior',
            'u23',
            'u21',
            'u19',
            'u17',
            'u15',
            'women_senior',
            'women_u23',
            'women_u21',
            'women_u19',
            'women_u17'
          ),
          allowNull: false,
        },
        position: { type: Sequelize.STRING, allowNull: true },
        jerseyNumber: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.ENUM('pending', 'active', 'inactive', 'retired'), defaultValue: 'pending' },
        capsEarned: { type: Sequelize.INTEGER, defaultValue: 0 },
        goals: { type: Sequelize.INTEGER, defaultValue: 0 },
        debutDate: { type: Sequelize.DATE, allowNull: true },
        captaincy: { type: Sequelize.BOOLEAN, defaultValue: false },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!(await tableExists(queryInterface, 'ClubRosterRequests'))) {
      await queryInterface.createTable('ClubRosterRequests', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        athleteId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        clubId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        position: { type: Sequelize.STRING, allowNull: false },
        jerseyNumber: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
        message: { type: Sequelize.TEXT, allowNull: true },
        responseMessage: { type: Sequelize.TEXT, allowNull: true },
        approvedBy: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        approvedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!(await tableExists(queryInterface, 'ScoutingRecommendations'))) {
      await queryInterface.createTable('ScoutingRecommendations', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        scoutId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        playerId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        score: { type: Sequelize.FLOAT, allowNull: false },
        reasons: { type: Sequelize.JSON, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!(await tableExists(queryInterface, 'ScheduledLiveStreams'))) {
      await queryInterface.createTable('ScheduledLiveStreams', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        title: { type: Sequelize.STRING, allowNull: false },
        description: { type: Sequelize.STRING, allowNull: true },
        scheduledAt: { type: Sequelize.DATE, allowNull: false },
        status: {
          type: Sequelize.ENUM('scheduled', 'live', 'completed', 'cancelled'),
          defaultValue: 'scheduled',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!(await tableExists(queryInterface, 'ScheduledCalls'))) {
      await queryInterface.createTable('ScheduledCalls', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        callerId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        receiverId: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
        scheduledTime: { type: Sequelize.DATE, allowNull: false },
        status: {
          type: Sequelize.ENUM('scheduled', 'completed', 'cancelled'),
          defaultValue: 'scheduled',
        },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!(await tableExists(queryInterface, 'Ligas'))) {
      await queryInterface.createTable('Ligas', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          unique: true,
          references: { model: 'Users', key: 'id' },
        },
        name: { type: Sequelize.STRING, allowNull: false },
        logo: { type: Sequelize.STRING, allowNull: true },
        country: { type: Sequelize.STRING, allowNull: true },
        level: {
          type: Sequelize.ENUM('national', 'regional', 'youth', 'women', 'other'),
          allowNull: false,
        },
        foundedYear: { type: Sequelize.INTEGER, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        website: { type: Sequelize.STRING, allowNull: true },
        clubs: { type: Sequelize.JSON, allowNull: true },
        competitions: { type: Sequelize.JSON, allowNull: true },
        contact: { type: Sequelize.JSON, allowNull: true },
        socialLinks: { type: Sequelize.JSON, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    if (!(await tableExists(queryInterface, 'VideoCalls'))) {
      await queryInterface.createTable('VideoCalls', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        callerId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        receiverId: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        status: { type: Sequelize.ENUM('ringing', 'connected', 'ended'), defaultValue: 'ringing' },
        startTime: { type: Sequelize.DATE, allowNull: true },
        endTime: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }
  },

  down: async () => {
    // Intentionally no-op: production catch-up migration must not drop schema.
  },
};
