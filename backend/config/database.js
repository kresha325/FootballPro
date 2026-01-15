const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let config;
if (process.env.NODE_ENV === 'production') {
  const configPath = path.join(__dirname, 'config.json');
  const rawConfig = JSON.parse(fs.readFileSync(configPath));
  config = rawConfig.production;
} else {
  config = {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5435,
    dialect: 'postgres',
    ssl: process.env.DB_SSL === 'true'
  };
}

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  dialectOptions: config.ssl ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {},
});

module.exports = sequelize;