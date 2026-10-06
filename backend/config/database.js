const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();


let sequelize;
// Respect PGSSLMODE if provided (avoid libpq warning about deprecated aliases)
const pgSslMode = (process.env.PGSSLMODE || '').toLowerCase();
const sslRequired = pgSslMode !== 'disable' && pgSslMode !== 'allow' && pgSslMode !== 'prefer';
// treat 'verify-full' and 'verify-ca' as strict (rejectUnauthorized = true)
const rejectUnauthorized = ['verify-full', 'verify-ca'].includes(pgSslMode);

function createSequelizeFromDatabaseUrl() {
  const dialectOptions = {};
  if (sslRequired) {
    dialectOptions.ssl = { require: true, rejectUnauthorized };
  }
  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions,
  });
}

// Remote/prod DB from laptop: set DATABASE_URL (e.g. Render External Database URL).
if (process.env.DATABASE_URL) {
  sequelize = createSequelizeFromDatabaseUrl();
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is required in production');
} else {
  const config = {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5435,
    dialect: 'postgres',
    ssl: process.env.DB_SSL === 'true'
  };

  // If connecting to localhost, force SSL off for developer convenience
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes((config.host || '').toLowerCase());
  if (isLocalHost) {
    config.ssl = false;
  }

  const dialectOptions = {};
  if ((config.ssl || sslRequired) && !isLocalHost) {
    dialectOptions.ssl = { require: true, rejectUnauthorized };
  }

  sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    dialectOptions,
  });
}

module.exports = sequelize;