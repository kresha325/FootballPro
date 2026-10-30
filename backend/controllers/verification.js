const crypto = require('crypto');
const User = require('../models/User');
const GuardianConsent = require('../models/GuardianConsent');
const ClubMember = require('../models/ClubMember');
const sequelize = require('../config/database');
const { createRawToken, hashToken: tokenHash, isUnexpired: isFutureDate } = require('../utils/guardianConsentSecurity');
const { sendEmail } = require('../services/emailService');
const { getApiPublicBase } = require('../config/email');
const { needsParentVerification, syncOverallVerified } = require('../utils/userVerification');
const { hasActiveGuardianConsent } = require('../utils/parentalAuthorization');

const CONSENT_POLICY_VERSION = process.env.PARENTAL_CONSENT_POLICY_VERSION || '2026-10-v1';
const CONSENT_SCOPE = ['account_access', 'sports_profile', 'tournaments', 'safety_moderation'];
const PARENT_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const MANAGEMENT_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function setSensitiveResponseHeaders(res) {
  res.set({
    'Cache-Control': 'no-store, private',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  });
}

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
  const consent = await GuardianConsent.findOne({ where: { verificationTokenHash: tokenHash } });
  const user = consent ? await User.findByPk(consent.minorUserId) : null;
  return { user, consent, clean, tokenHash };
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
  <p>Po shqyrton kërkesën për llogarinë e <strong>${name}</strong> në X TALENTI.</p>
  <p>Vazhdo vetëm nëse je prind ose kujdestar ligjor dhe ke autoritetin ta autorizosh këtë llogari.</p>
  <form method="POST" action="${actionUrl}" accept-charset="UTF-8">
  <input type="hidden" name="token" value="${safeToken}"/>
  <label for="guardianName">Emri yt i plotë</label>
  <input id="guardianName" name="guardianName" required maxlength="160" autocomplete="name" style="width:100%;box-sizing:border-box;padding:11px;margin:6px 0 14px;border:1px solid #cbd5e1;border-radius:7px"/>
  <label for="relationship">Marrëdhënia me të miturin</label>
  <select id="relationship" name="relationship" required style="width:100%;box-sizing:border-box;padding:11px;margin:6px 0 14px;border:1px solid #cbd5e1;border-radius:7px">
    <option value="">Zgjidh</option><option value="parent">Prind</option><option value="legal_guardian">Kujdestar ligjor</option>
  </select>
  <label class="muted"><input type="checkbox" name="attestGuardian" value="yes" required/> Konfirmoj se jam prind/kujdestar ligjor, se kontrolloj këtë email dhe autorizoj përpunimin e të dhënave të nevojshme për llogarinë sportive të të miturit, turnet dhe masat e sigurisë.</label>
  <p class="muted">Vetëm hapja e emailit nuk jep pëlqim. Duhet të plotësosh këtë deklarim dhe të shtypësh butonin.</p>
    <button type="submit">Konfirmo si prind</button>
  </form>`,
  });
}

function successPageHtml({ athleteName, managementUrl }) {
  const name = escapeHtml(athleteName || 'lojtarit');
  const site = escapeHtml((process.env.FRONTEND_URL || 'https://xtalenti.com').replace(/\/$/, ''));
  return shellHtml({
    title: 'X TALENTI — U konfirmua',
    body: `
  <h1 class="ok">✓ Faleminderit!</h1>
  <p>Verifikimi i prindit për <strong>${name}</strong> u aktivizua.</p>
  <p class="muted">Mund ta mbyllësh këtë faqe. Lojtari duhet të rifreskojë profilin në app.</p>
  ${managementUrl ? `<a class="btn btn-secondary" href="${escapeHtml(managementUrl)}">Menaxho ose tërhiq pëlqimin</a>` : ''}
  <a class="btn" href="${site}/parent-verified">Hap X TALENTI</a>
  <a class="btn btn-secondary" href="${site}">Faqja kryesore</a>`,
  });
}

function revokePageHtml({ token, error }) {
  if (error) return shellHtml({ title: 'X TALENTI — Pëlqimi prindëror', body: `<h1>Menaxhimi i pëlqimit</h1><p class="err">${escapeHtml(error)}</p>` });
  const safeToken = escapeHtml(token);
  const actionUrl = escapeHtml(`${getApiPublicBase()}/api/verification/parent-revoke`);
  return shellHtml({
    title: 'X TALENTI — Tërhiq pëlqimin',
    body: `<h1>Tërhiq pëlqimin</h1><p>Kjo do ta kufizojë menjëherë llogarinë e të miturit derisa të jepet përsëri autorizim.</p><form method="POST" action="${actionUrl}"><input type="hidden" name="token" value="${safeToken}"/><button type="submit">Tërhiq pëlqimin</button></form>`,
  });
}

// Request parental verification (authenticated athlete)
exports.parentRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { parentEmail } = req.body || {};
    if (!parentEmail) return res.status(400).json({ error: 'parentEmail is required' });

    const normalizedParent = String(parentEmail).trim().toLowerCase();
    if (normalizedParent.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedParent)) {
      return res.status(400).json({ error: 'Invalid parent email address' });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!needsParentVerification(user)) {
      return res.status(400).json({
        error: 'Verifikimi i prindit vlen vetëm për moshat e vogla (nën 18 vjeç).',
      });
    }

    const normalizedAthleteEmail = String(user.email || '').trim().toLowerCase();
    if (normalizedParent === normalizedAthleteEmail) {
      return res.status(400).json({ error: 'Email-i i kujdestarit duhet të jetë i ndryshëm nga email-i i atletit.' });
    }
    if (user.parentVerified && await hasActiveGuardianConsent(user.id)) {
      return res.json({ success: true, alreadyAuthorized: true, emailSent: false, msg: 'Autorizimi prindëror është aktiv.' });
    }

    const token = createRawToken();
    const expiresAt = new Date(Date.now() + PARENT_TOKEN_TTL_MS);
    await sequelize.transaction(async (transaction) => {
      await GuardianConsent.update(
        { verificationTokenHash: null, verificationTokenExpiresAt: null },
        { where: { minorUserId: user.id, verifiedAt: null, revokedAt: null }, transaction }
      );
      await GuardianConsent.create({
        minorUserId: user.id,
        guardianEmail: normalizedParent,
        guardianName: null,
        relationship: null,
        consentPurpose: 'minor_account_authorization',
        consentScope: CONSENT_SCOPE,
        policyVersion: CONSENT_POLICY_VERSION,
        verificationMethod: 'guardian_email_attestation',
        verificationTokenHash: tokenHash(token),
        verificationTokenExpiresAt: expiresAt,
      }, { transaction });
      user.parentEmail = normalizedParent;
      user.parentVerificationToken = null;
      user.parentVerificationExpire = null;
      user.parentVerified = false;
      await user.save({ transaction });
    });

    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Lojtari';
    const emailResult = await sendEmail(normalizedParent, 'parentVerification', athleteName, token, user.language || 'sq');

    if (emailResult.success) {
      return res.json({
        success: true,
        emailSent: true,
        msg: 'U dërgua kërkesa te email-i i kujdestarit. Vetëm kujdestari mund të vazhdojë nga emaili.',
      });
    }

    console.warn('Parent verification email not sent for minor account id:', user.id);
    return res.status(503).json({
      success: false,
      emailSent: false,
      error: 'Email-i nuk u dërgua. Kërko sërish më vonë ose kontakto mbështetjen; linku nuk mund të ndahet nga llogaria e atletit.',
    });
  } catch {
    console.error('Parent verification request failed for account id:', req.user?.id);
    res.status(500).json({ error: 'Kërkesa nuk u përfundua. Provo përsëri.' });
  }
};

/**
 * GET: show confirm button page (WhatsApp link preview must NOT consume the token).
 */
exports.parentConfirmPage = async (req, res) => {
  setSensitiveResponseHeaders(res);
  try {
    const token = normalizeToken(req.query.token);
    if (!token) {
      return res.status(400).send(confirmPageHtml({ error: 'Mungon tokeni i konfirmimit.' }));
    }

    const found = await findUserByParentToken(token);
    const { user, consent } = found;
    if (!user) {
      return res.status(400).send(
        confirmPageHtml({
          error:
            'Linku është i pavlefshëm ose është përdorur tashmë. Nëse e ke konfirmuar më parë, verifikimi i prindit është aktiv — rifresko profilin.',
        })
      );
    }

    if (!isFutureDate(consent?.verificationTokenExpiresAt)) {
      return res.status(400).send(confirmPageHtml({ error: 'Linku ka skaduar. Kërko një link të ri nga aplikacioni.' }));
    }

    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Lojtari';
    return res.send(confirmPageHtml({ token, athleteName }));
  } catch {
    console.error('Parent confirmation page failed');
    return res.status(500).send(confirmPageHtml({ error: 'Gabim serveri.' }));
  }
};

/**
 * POST: actually confirm parent verification.
 * Respond with same-origin HTML (WhatsApp in-app browser often breaks cross-domain redirects).
 */
exports.parentConfirm = async (req, res) => {
  setSensitiveResponseHeaders(res);
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) return res.status(400).send(confirmPageHtml({ error: 'Mungon tokeni.' }));

    const found = await findUserByParentToken(token);
    const { user } = found;
    if (!user || !found.consent || !isFutureDate(found.consent.verificationTokenExpiresAt)) {
      return res.status(400).send(
        confirmPageHtml({
          error:
            'Linku është i pavlefshëm ose është përdorur tashmë. Rifresko profilin e lojtarit — verifikimi mund të jetë aktiv.',
        })
      );
    }

    const guardianName = String(req.body?.guardianName || '').trim().slice(0, 160);
    const relationship = String(req.body?.relationship || '');
    if (!guardianName || !['parent', 'legal_guardian'].includes(relationship) || req.body?.attestGuardian !== 'yes') {
      return res.status(400).send(confirmPageHtml({ error: 'Plotëso emrin, marrëdhënien dhe deklarimin e kujdestarit.' }));
    }
    const managementToken = createRawToken();
    const now = new Date();
    const saved = await sequelize.transaction(async (transaction) => {
      const consent = await GuardianConsent.findOne({
        where: { id: found.consent.id, verificationTokenHash: found.tokenHash, revokedAt: null },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const lockedUser = await User.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!consent || !lockedUser || !isFutureDate(consent.verificationTokenExpiresAt) || consent.verifiedAt || !needsParentVerification(lockedUser)) return false;
      consent.guardianName = guardianName;
      consent.relationship = relationship;
      consent.verificationMethod = 'guardian_email_attestation';
      consent.verifiedAt = now;
      consent.verificationTokenHash = null;
      consent.verificationTokenExpiresAt = null;
      consent.managementTokenHash = tokenHash(managementToken);
      consent.managementTokenExpiresAt = new Date(Date.now() + MANAGEMENT_TOKEN_TTL_MS);
      await consent.save({ transaction });
      lockedUser.parentVerified = true;
      lockedUser.parentEmail = consent.guardianEmail;
      lockedUser.parentVerificationToken = null;
      lockedUser.parentVerificationExpire = null;
      syncOverallVerified(lockedUser);
      await lockedUser.save({ transaction });
      await ClubMember.update(
        { status: 'approved', joinedAt: now },
        {
          where: { athleteId: lockedUser.id, creationSource: 'club_managed_registration', status: 'pending' },
          transaction,
        }
      );
      return lockedUser;
    });
    if (!saved) return res.status(400).send(confirmPageHtml({ error: 'Linku është skaduar, përdorur, ose llogaria nuk kualifikohet.' }));

    // Once guardian authorization is active, synchronize the club-managed athlete
    // into the existing tournament squad structures; pending minors stay excluded.
    try {
      const managedMemberships = await ClubMember.findAll({
        where: { athleteId: saved.id, creationSource: 'club_managed_registration', status: 'approved' },
      });
      for (const membership of managedMemberships) {
        try {
          await require('../utils/ligaTournaments').syncClubMemberToLigaTournaments(membership);
          await require('../utils/tournamentSquad').syncAthleteClubSquads(membership);
        } catch (syncError) {
          console.error('Managed athlete tournament sync failed:', syncError?.message || syncError);
        }
      }
    } catch (syncError) {
      console.error('Managed athlete roster sync failed:', syncError?.message || syncError);
    }

    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Lojtari';
    const managementUrl = `${getApiPublicBase()}/api/verification/parent-revoke?token=${encodeURIComponent(managementToken)}`;
    const sent = await sendEmail(found.consent.guardianEmail, 'parentConsentManagement', athleteName, managementUrl, user.language || 'sq');
    if (!sent.success) console.warn('Guardian consent management email not sent for minor account id:', user.id);
    return res.status(200).send(successPageHtml({ athleteName, managementUrl }));
  } catch {
    console.error('Guardian confirmation failed');
    return res.status(500).send(confirmPageHtml({ error: 'Gabim serveri.' }));
  }
};

exports.parentRevokePage = async (req, res) => {
  setSensitiveResponseHeaders(res);
  try {
    const token = normalizeToken(req.query?.token);
    const hash = token ? tokenHash(token) : '';
    const consent = hash ? await GuardianConsent.findOne({ where: { managementTokenHash: hash, revokedAt: null } }) : null;
    if (!consent || !isFutureDate(consent.managementTokenExpiresAt)) {
      return res.status(400).send(revokePageHtml({ error: 'Linku nuk është i vlefshëm ose ka skaduar.' }));
    }
    return res.send(revokePageHtml({ token }));
  } catch {
    return res.status(500).send(revokePageHtml({ error: 'Gabim serveri.' }));
  }
};

exports.parentRevoke = async (req, res) => {
  setSensitiveResponseHeaders(res);
  try {
    const token = normalizeToken(req.body?.token);
    const hash = token ? tokenHash(token) : '';
    if (!hash) return res.status(400).send(revokePageHtml({ error: 'Linku nuk është i vlefshëm.' }));
    let revokedUserId = null;
    await sequelize.transaction(async (transaction) => {
      const consent = await GuardianConsent.findOne({ where: { managementTokenHash: hash, revokedAt: null }, transaction, lock: transaction.LOCK.UPDATE });
      if (!consent || !isFutureDate(consent.managementTokenExpiresAt)) throw new Error('INVALID_OR_EXPIRED');
      const user = await User.findByPk(consent.minorUserId, { transaction, lock: transaction.LOCK.UPDATE });
      consent.revokedAt = new Date();
      consent.managementTokenHash = null;
      consent.managementTokenExpiresAt = null;
      await consent.save({ transaction });
      if (user) {
        // A withdrawn consent removes the managed athlete from active club
        // rosters immediately while preserving match and tournament history.
        const managedMemberships = await ClubMember.findAll({
          where: { athleteId: user.id, creationSource: 'club_managed_registration', status: 'approved' },
          transaction,
        });
        if (managedMemberships.length) {
          await ClubMember.update(
            { status: 'pending', joinedAt: null },
            { where: { id: managedMemberships.map((membership) => membership.id) }, transaction }
          );
          const TournamentSquadMember = require('../models/TournamentSquadMember');
          for (const membership of managedMemberships) {
            await TournamentSquadMember.destroy({
              where: { athleteUserId: user.id, clubUserId: membership.clubId },
              transaction,
            });
          }
        }
        revokedUserId = user.id;
        user.parentVerified = false;
        user.tokenVersion = Number(user.tokenVersion || 0) + 1;
        syncOverallVerified(user);
        await user.save({ transaction });
      }
    });
    if (revokedUserId) req.app.get('io')?.in(String(revokedUserId)).disconnectSockets(true);
    return res.send(shellHtml({ title: 'X TALENTI — Pëlqimi u tërhoq', body: '<h1 class="ok">Pëlqimi u tërhoq</h1><p>Llogaria e të miturit është kufizuar. Mund ta mbyllësh këtë faqe.</p>' }));
  } catch (err) {
    const status = err.message === 'INVALID_OR_EXPIRED' ? 400 : 500;
    if (status === 500) console.error('Guardian consent revocation failed');
    return res.status(status).send(revokePageHtml({ error: status === 400 ? 'Linku nuk është i vlefshëm ose ka skaduar.' : 'Gabim serveri.' }));
  }
};
