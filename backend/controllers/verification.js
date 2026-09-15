const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { isEmailConfigured, buildParentConfirmUrl } = require('../config/email');
const { needsParentVerification, markParentVerified } = require('../utils/userVerification');

function normalizeToken(raw) {
  return String(raw || '')
    .trim()
    // WhatsApp / messengers sometimes append punctuation
    .replace(/[),.;]+$/g, '');
}

async function findUserByParentToken(token) {
  const clean = normalizeToken(token);
  if (!clean) return { user: null, clean: '' };
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const user = await User.findOne({ where: { parentVerificationToken: tokenHash } });
  return { user, clean, tokenHash };
}

function confirmPageHtml({ token, athleteName, error }) {
  const safeToken = String(token || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  const name = String(athleteName || 'lojtari')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');

  if (error) {
    return `<!DOCTYPE html>
<html lang="sq"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>X TALENTI — Verifikim</title>
<meta name="robots" content="noindex"/>
</head><body style="font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:16px;color:#111">
  <h1 style="font-size:1.25rem">Verifikimi i prindit</h1>
  <p style="color:#b91c1c">${error}</p>
  <p style="color:#6b7280;font-size:14px">Nëse e ke konfirmuar më parë, badge <strong>Prindi</strong> te profili duhet të jetë blu. Rifresko profilin e lojtarit.</p>
</body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="sq"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>X TALENTI — Konfirmo si prind</title>
<meta name="robots" content="noindex"/>
</head><body style="font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:16px;color:#111">
  <h1 style="font-size:1.25rem;color:#0f766e">Konfirmim prindi</h1>
  <p>Po konfirmon llogarinë e <strong>${name}</strong> në X TALENTI.</p>
  <p style="color:#6b7280;font-size:14px">WhatsApp / preview nuk e aktivizon automatikisht — duhet të shtypësh butonin.</p>
  <form method="POST" action="/api/verification/parent-confirm">
    <input type="hidden" name="token" value="${safeToken}"/>
    <button type="submit" style="background:#0f766e;color:#fff;border:0;padding:14px 24px;border-radius:8px;font-weight:700;width:100%;cursor:pointer;font-size:16px">
      Konfirmo si prind
    </button>
  </form>
</body></html>`;
}

// Request parental verification (authenticated athlete)
exports.parentRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { parentEmail } = req.body;
    if (!parentEmail) return res.status(400).json({ error: 'parentEmail is required' });

    const normalizedParent = String(parentEmail).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedParent)) {
      return res.status(400).json({ error: 'Invalid parent email address' });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!needsParentVerification(user)) {
      return res.status(400).json({
        error: 'Verifikimi i prindit vlen vetëm për moshat e vogla (nën 18 vjeç).',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const confirmUrl = buildParentConfirmUrl(token);

    user.parentEmail = normalizedParent;
    user.parentVerificationToken = tokenHash;
    user.parentVerificationExpire = Date.now() + 7 * 24 * 60 * 60 * 1000;
    user.parentVerified = false;
    await user.save();

    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Lojtari';
    const emailResult = await sendEmail(normalizedParent, 'parentVerification', athleteName, token);

    if (emailResult.success) {
      return res.json({
        success: true,
        emailSent: true,
        // Always return link so user can share on WhatsApp even if email works
        confirmUrl,
        msg: 'Email-i u dërgua te prindi. Kontrollo edhe dosjen Spam.',
      });
    }

    console.warn('Parent verification email not sent:', emailResult.error, '→', normalizedParent);

    return res.json({
      success: true,
      emailSent: false,
      emailConfigured: isEmailConfigured(),
      confirmUrl,
      warning: isEmailConfigured()
        ? `Email-i nuk u dërgua (${emailResult.error || 'gabim SMTP'}). Kopjo linkun më poshtë dhe ia dërgo prindit.`
        : 'Serveri nuk ka EMAIL_USER / EMAIL_PASSWORD (Gmail). Kopjo linkun dhe ia dërgo prindit (WhatsApp/SMS).',
      msg: 'Linku i konfirmimit u krijua',
    });
  } catch (err) {
    console.error('Parent request error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET: show confirm button page (WhatsApp link preview must NOT consume the token).
 */
exports.parentConfirmPage = async (req, res) => {
  try {
    const token = normalizeToken(req.query.token);
    if (!token) {
      return res.status(400).send(confirmPageHtml({ error: 'Mungon tokeni i konfirmimit.' }));
    }

    const { user } = await findUserByParentToken(token);
    if (!user) {
      // Likely already confirmed (token cleared) — or invalid
      return res.status(400).send(
        confirmPageHtml({
          error:
            'Linku është i pavlefshëm ose është përdorur tashmë. Nëse e ke konfirmuar më parë, verifikimi i prindit është aktiv — rifresko profilin.',
        })
      );
    }

    if (user.parentVerificationExpire && Number(user.parentVerificationExpire) < Date.now()) {
      return res.status(400).send(confirmPageHtml({ error: 'Linku ka skaduar. Kërko një link të ri nga aplikacioni.' }));
    }

    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Lojtari';
    return res.send(confirmPageHtml({ token, athleteName }));
  } catch (err) {
    console.error('parentConfirmPage:', err);
    return res.status(500).send(confirmPageHtml({ error: 'Gabim serveri.' }));
  }
};

/**
 * POST: actually confirm parent verification.
 */
exports.parentConfirm = async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token || req.query?.token);
    if (!token) return res.status(400).send(confirmPageHtml({ error: 'Mungon tokeni.' }));

    const { user } = await findUserByParentToken(token);
    if (!user) {
      return res.status(400).send(
        confirmPageHtml({
          error:
            'Linku është i pavlefshëm ose është përdorur tashmë. Rifresko profilin e lojtarit — verifikimi mund të jetë aktiv.',
        })
      );
    }

    if (user.parentVerificationExpire && Number(user.parentVerificationExpire) < Date.now()) {
      return res.status(400).send(confirmPageHtml({ error: 'Linku ka skaduar. Kërko një link të ri.' }));
    }

    await markParentVerified(user);

    const redirectUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/parent-verified`
      : 'https://xtalenti.com/parent-verified';
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('parentConfirm:', err);
    return res.status(500).send(confirmPageHtml({ error: 'Gabim serveri.' }));
  }
};
