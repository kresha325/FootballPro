'use strict';

function isEmailConfigured() {
  if (isResendConfigured()) return true;

  const user = String(process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || '').trim();
  if (!user || !pass) return false;
  const placeholders = ['your-email@gmail.com', 'your-app-password', 'noreply@footballpro.com'];
  if (placeholders.includes(user) || placeholders.includes(pass)) return false;
  return true;
}

function isResendConfigured() {
  return Boolean(
    String(process.env.RESEND_API_KEY || '').trim() &&
    String(process.env.RESEND_FROM || '').trim()
  );
}

function getApiPublicBase() {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.BACKEND_URL ||
    'https://footballpro.onrender.com'
  ).replace(/\/$/, '');
}

function buildParentConfirmUrl(token) {
  return `${getApiPublicBase()}/api/verification/parent-confirm?token=${encodeURIComponent(token)}`;
}

module.exports = {
  isEmailConfigured,
  isResendConfigured,
  getApiPublicBase,
  buildParentConfirmUrl,
};
