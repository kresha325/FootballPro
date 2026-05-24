'use strict';

/**
 * Production fix: ensure-prod-schema-gaps / 20260119 pre-created only
 * enum_ClubStaff_staffRole. Sequelize expects enum_ClubStaff_status and
 * enum_ClubStaff_teamType as well — queries fail if those types are missing.
 */

const STAFF_ROLES = [
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
  'other',
];

const STATUS_VALUES = ['pending', 'active', 'inactive'];

const TEAM_TYPE_VALUES = [
  'first_team',
  'youth',
  'women',
  'men',
  'u23',
  'u21',
  'u19',
  'u17',
  'u15',
  'u13',
  'u11',
  'u9',
];

async function ensurePgEnum(queryInterface, typeName, values) {
  const labels = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
        CREATE TYPE "${typeName}" AS ENUM (${labels});
      END IF;
    END$$;
  `);
}

async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => String(t).toLowerCase());
  return normalized.includes(String(name).toLowerCase());
}

async function columnUdtName(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT c.udt_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = :table
      AND c.column_name = :column
    LIMIT 1
    `,
    { replacements: { table, column } }
  );
  return rows[0]?.udt_name || null;
}

async function alignEnumColumn(queryInterface, table, column, enumTypeName, defaultValue) {
  const udt = await columnUdtName(queryInterface, table, column);
  if (!udt) return;

  if (udt === enumTypeName) return;

  const usingExpr = `"${column}"::text::"${enumTypeName}"`;
  const defaultClause = defaultValue
    ? `, ALTER COLUMN "${column}" SET DEFAULT '${defaultValue}'::"${enumTypeName}"`
    : '';

  await queryInterface.sequelize.query(`
    ALTER TABLE "${table}"
    ALTER COLUMN "${column}" TYPE "${enumTypeName}" USING (${usingExpr})${defaultClause};
  `);
}

module.exports = {
  up: async (queryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') {
      return;
    }

    await ensurePgEnum(queryInterface, 'enum_ClubStaff_staffRole', STAFF_ROLES);
    await ensurePgEnum(queryInterface, 'enum_ClubStaff_status', STATUS_VALUES);
    await ensurePgEnum(queryInterface, 'enum_ClubStaff_teamType', TEAM_TYPE_VALUES);

    if (!(await tableExists(queryInterface, 'ClubStaff'))) {
      return;
    }

    await alignEnumColumn(
      queryInterface,
      'ClubStaff',
      'status',
      'enum_ClubStaff_status',
      'pending'
    );
    await alignEnumColumn(
      queryInterface,
      'ClubStaff',
      'teamType',
      'enum_ClubStaff_teamType',
      'first_team'
    );
    await alignEnumColumn(
      queryInterface,
      'ClubStaff',
      'staffRole',
      'enum_ClubStaff_staffRole',
      null
    );
  },

  down: async () => {
    // Do not drop enum types — other columns or history may still reference them.
  },
};
