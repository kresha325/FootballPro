const staticConfig = require('./app.json');

/**
 * Expo app config — production-safe overrides for EAS.
 * Lokal: pa `extra.eas.projectId` nuk kërkohet login Expo për code signing.
 * Për EAS në CI: `EAS_PROJECT_ID=...`.
 */
module.exports = ({ config }) => {
  const app = staticConfig.expo || {};
  const staticExtra = app.extra || {};
  const easProfile = String(process.env.EAS_BUILD_PROFILE || '').toLowerCase();
  const isProdBuild = easProfile === 'production';

  const backendUrl = String(
    process.env.BACKEND_URL || staticExtra.BACKEND_URL || 'https://footballpro.onrender.com'
  ).replace(/\/$/, '');

  // Never ship localhost / private LAN API hosts in production EAS builds.
  if (isProdBuild && /(localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|0\.0\.0\.0)/i.test(backendUrl)) {
    throw new Error(
      `[app.config] Production build blocked: BACKEND_URL must be public (got ${backendUrl})`
    );
  }

  const allowMobileDigital =
    process.env.ALLOW_MOBILE_DIGITAL_PURCHASES === 'true' ||
    process.env.ALLOW_MOBILE_DIGITAL_PURCHASES === '1' ||
    staticExtra.ALLOW_MOBILE_DIGITAL_PURCHASES === true;

  return {
    ...config,
    ...app,
    // Primary branded scheme + legacy footballpro for existing links / installs
    scheme: ['xtalenti', 'footballpro'],
    ios: {
      ...(app.ios || {}),
      entitlements: {
        ...((app.ios && app.ios.entitlements) || {}),
        // EAS production → production APNs; local/dev client → development
        'aps-environment': isProdBuild ? 'production' : 'development',
      },
    },
    extra: {
      ...staticExtra,
      BACKEND_URL: backendUrl,
      WEB_APP_URL:
        process.env.WEB_APP_URL || staticExtra.WEB_APP_URL || 'https://xtalenti.com',
      // Optional: https://share.xtalenti.com (CNAME → Render) for rich OG while branded
      SHARE_ORIGIN: process.env.SHARE_ORIGIN || staticExtra.SHARE_ORIGIN || '',
      ALLOW_MOBILE_DIGITAL_PURCHASES: allowMobileDigital,
      ...(process.env.EAS_PROJECT_ID
        ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
        : {}),
    },
  };
};
