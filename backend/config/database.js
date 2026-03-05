const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();


let sequelize;
// Respect PGSSLMODE if provided (avoid libpq warning about deprecated aliases)
const pgSslMode = (process.env.PGSSLMODE || '').toLowerCase();
const sslRequired = pgSslMode !== 'disable' && pgSslMode !== 'allow' && pgSslMode !== 'prefer' ? true : (pgSslMode === 'prefer' ? true : false);
// treat 'verify-full' and 'verify-ca' as strict (rejectUnauthorized = true)
const rejectUnauthorized = ['verify-full', 'verify-ca'].includes(pgSslMode);

if (process.env.NODE_ENV === 'production') {
  // If a DATABASE_URL contains sslmode param, libpq will still log a warning if it uses legacy aliases.
  // Best practice: set PGSSLMODE=verify-full in environment and provide CA certs.
  const dialectOptions = {};
  if (sslRequired) {
    dialectOptions.ssl = { require: true, rejectUnauthorized };
  }

  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions,
  });
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

  const dialectOptions = {};
  if (config.ssl || sslRequired) {
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