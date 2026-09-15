const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { isEmailConfigured, buildParentConfirmUrl, getApiPublicBase } = require('../config/email');
const { needsParentVerification, markParentVerified } = require('../utils/userVerification');

function normalizeToken(raw) {
  return String(raw || '')
    .trim()
    // WhatsApp / messengers sometimes append punctuation or zero-width chars
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[),.;]+$/g, '');
}

async function findUserByParentToken(token) {
  const clean = normalizeToken(token);
  if (!clean) return { user: null, clean: '' };
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const user = await User.findOne({ where: { parentVerificationToken: tokenHash } });
  return { user, clean, tokenHash };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shellHtml({ title, body }) {
  return `<!DOCTYPE html>
<html lang="sq"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<meta name="robots" content="noindex"/>
<meta property="og:title" content="X TALENTI — Konfirmim prindi"/>
<meta property="og:description" content="Hap linkun dhe shtyp Konfirmo si prind. Preview në WhatsApp nuk e aktivizon automatikisht."/>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;max-width:440px;margin:40px auto;padding:16px;color:#111;background:#f8fafc}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px}
  h1{font-size:1.25rem;margin:0 0 12px;color:#0f766e}
  p{line-height:1.45;color:#334155}
  .muted{color:#64748b;font-size:14px}
  .err{color:#b91c1c}
  .ok{color:#065f46}
  button,.btn{
    display:block;width:100%;box-sizing:border-box;text-align:center;
    background:#0f766e;color:#fff;border:0;padding:14px 24px;border-radius:8px;
    font-weight:700;font-size:16px;cursor:pointer;text-decoration:none;margin-top:16px
  }
  .btn-secondary{background:#fff;color:#0f766e;border:1px solid #0f766e}
</style>
</head><body><div class="card">${body}</div></body></html>`;
}

function confirmPageHtml({ token, athleteName, error }) {
  if (error) {
    return shellHtml({
      title: 'X TALENTI — Verifikim',
      body: `
  <h1>Verifikimi i prindit</h1>
  <p class="err">${escapeHtml(error)}</p>
  <p class="muted">Nëse e ke konfirmuar më parë, badge <strong>Prindi</strong> te profili duhet të jetë blu. Rifresko profilin e lojtarit.</p>`,
    });
  }

  const safeToken = escapeHtml(token);
  const name = escapeHtml(athleteName || 'lojtari');
  const actionUrl = escapeHtml(`${getApiPublicBase()}/api/verification/parent-confirm`);

  return shellHtml({
    title: 'X TALENTI — Konfirmo si prind',
    body: `
  <h1>Konfirmim prindi</h1>
  <p>Po konfirmon llogarinë e <strong>${name}</strong> në X TALENTI.</p>
  <p class="muted">Në WhatsApp hapet një faqe e përkohshme — <strong>duhet të shtypësh butonin</strong> (preview nuk e konfirmon vetë).</p>
  <form method="POST" action="${actionUrl}" accept-charset="UTF-8">
    <input type="hidden" name="token" value="${safeToken}"/>
    <button type="submit">Konfirmo si prind</button>
  </form>`,
  });
}

function successPageHtml({ athleteName }) {
  const name = escapeHtml(athleteName || 'lojtarit');
  const site = escapeHtml((process.env.FRONTEND_URL || 'https://xtalenti.com').replace(/\/$/, ''));
  return shellHtml({
    title: 'X TALENTI — U konfirmua',
    body: `
  <h1 class="ok">✓ Faleminderit!</h1>
  <p>Verifikimi i prindit për <strong>${name}</strong> u aktivizua.</p>
  <p class="muted">Mund ta mbyllësh këtë faqe. Lojtari duhet të rifreskojë profilin në app.</p>
  <a class="btn" href="${site}/parent-verified">Hap X TALENTI</a>
  <a class="btn btn-secondary" href="${site}">Faqja kryesore</a>`,
  });
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
        // Always return link so user can also share on WhatsApp
        confirmUrl,
        msg: 'Email-i u dërgua te prindi. Mund ta dërgosh edhe në WhatsApp me linkun e mëposhtëm.',
      });
    }

    console.warn('Parent verification email not sent:', emailResult.error, '→', normalizedParent);

    return res.json({
      success: true,
      emailSent: false,
      emailConfigured: isEmailConfigured(),
      confirmUrl,
      warning: isEmailConfigured()
        ? `Email-i nuk u dërgua (${emailResult.error || 'gabim SMTP'}). Kopjo linkun më poshtë dhe ia dërgo prindit në WhatsApp.`
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
 * Respond with same-origin HTML (WhatsApp in-app browser often breaks cross-domain redirects).
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

    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Lojtari';
    return res.status(200).send(successPageHtml({ athleteName }));
  } catch (err) {
    console.error('parentConfirm:', err);
    return res.status(500).send(confirmPageHtml({ error: 'Gabim serveri.' }));
  }
};
