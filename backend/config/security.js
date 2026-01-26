// Security dependencies
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');

module.exports = {
  helmet,
  rateLimit,
  xss,
  mongoSanitize
};
