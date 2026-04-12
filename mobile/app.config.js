const staticConfig = require('./app.json');

module.exports = ({ config }) => {
  const app = staticConfig.expo || {};
  const staticExtra = app.extra || {};

  return {
    ...config,
    ...app,
    extra: {
      ...staticExtra,
      BACKEND_URL: process.env.BACKEND_URL || staticExtra.BACKEND_URL || 'https://footballpro.onrender.com',
    },
  };
};
