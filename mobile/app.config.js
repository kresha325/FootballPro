const staticConfig = require('./app.json');

/** Lokal: pa `extra.eas.projectId` nuk kërkohet login Expo për code signing. Për EAS në CI: `EAS_PROJECT_ID=...`. */
module.exports = ({ config }) => {
  const app = staticConfig.expo || {};
  const staticExtra = app.extra || {};

  return {
    ...config,
    ...app,
    extra: {
      ...staticExtra,
      BACKEND_URL: process.env.BACKEND_URL || staticExtra.BACKEND_URL || 'https://footballpro.onrender.com',
      WEB_APP_URL:
        process.env.WEB_APP_URL || staticExtra.WEB_APP_URL || 'https://footballpro-1.onrender.com',
      ...(process.env.EAS_PROJECT_ID
        ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
        : {}),
    },
  };
};
