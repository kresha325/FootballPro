const crypto = require('crypto');
const User = require('../models/User');
const GuardianConsent = require('../models/GuardianConsent');
const GuardianConsentEvent = require('../models/GuardianConsentEvent');
const ClubMember = require('../models/ClubMember');
const sequelize = require('../config/database');
const { createRawToken, hashToken: tokenHash, isUnexpired: isFutureDate } = require('../utils/guardianConsentSecurity');
const { sendEmail } = require('../services/emailService');
const { getApiPublicBase } = require('../config/email');
const { needsParentVerification, syncOverallVerified } = require('../utils/userVerification');
const { hasActiveGuardianConsent } = require('../utils/parentalAuthorization');
const { Op } = require('sequelize');
const { CHANNELS: COMMUNICATION_CHANNELS, isMinorAthlete, hasCommunicationConsent } = require('../utils/minorCommunicationPolicy');
const { COACHING_STAFF_ROLES, isActiveCoachAssignment, isVerifiedClub } = require('../utils/managedAthleteRegistration');
const ClubStaff = require('../models/ClubStaff');
const VideoCall = require('../models/VideoCall');
const ScheduledCall = require('../models/ScheduledCall');

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

function communicationConfirmPageHtml({ token, athleteName, adultName, clubName, channel, error }) {
  if (error) return shellHtml({ title: 'X TALENTI — Pëlqimi për komunikim', body: `<h1>Pëlqimi për komunikim</h1><p class="err">${escapeHtml(error)}</p>` });
  const labels = {
    [COMMUNICATION_CHANNELS.DIRECT_MESSAGE]: 'mesazhe private',
    [COMMUNICATION_CHANNELS.GROUP_MESSAGE]: 'mesazhe në grup',
    [COMMUNICATION_CHANNELS.VIDEO_CALL]: 'telefonata me video',
    [COMMUNICATION_CHANNELS.PRIVATE_LIVE_INVITATION]: 'ftesa private live',
    [COMMUNICATION_CHANNELS.GUARDIAN_MEDIATED_GROUP]: 'grup komunikimi ku ti je pjesëmarrës',
  };
  const actionUrl = escapeHtml(`${getApiPublicBase()}/api/verification/parent-confirm`);
  return shellHtml({
    title: 'X TALENTI — Pëlqim specifik',
    body: `<h1>Pëlqim specifik për komunikim</h1><p>Kërkohet vendimi yt për komunikimin e <strong>${escapeHtml(athleteName)}</strong> me <strong>${escapeHtml(adultName)}</strong>${clubName ? ` nga klubi <strong>${escapeHtml(clubName)}</strong>` : ''} përmes <strong>${escapeHtml(labels[channel] || 'komunikimit të kërkuar')}</strong>.</p><p>Ky pëlqim është i veçantë nga autorizimi i llogarisë dhe dukshmëria e profilit. Mund ta tërheqësh në çdo kohë nga linku i menaxhimit.</p><form method="POST" action="${actionUrl}" accept-charset="UTF-8"><input type="hidden" name="token" value="${escapeHtml(token)}"/><label for="guardianName">Emri yt i plotë</label><input id="guardianName" name="guardianName" required maxlength="160" autocomplete="name" style="width:100%;box-sizing:border-box;padding:11px;margin:6px 0 14px;border:1px solid #cbd5e1;border-radius:7px"/><label for="relationship">Marrëdhënia me të miturin</label><select id="relationship" name="relationship" required style="width:100%;box-sizing:border-box;padding:11px;margin:6px 0 14px;border:1px solid #cbd5e1;border-radius:7px"><option value="">Zgjidh</option><option value="parent">Prind</option><option value="legal_guardian">Kujdestar ligjor</option></select><label class="muted"><input type="checkbox" name="attestGuardian" value="yes" required/> Konfirmoj se jam prind/kujdestar ligjor dhe jap këtë pëlqim posaçërisht për personin dhe mënyrën e komunikimit të shënuar më sipër.</label><button type="submit">Mirato këtë komunikim</button></form>`,
  });
}

function communicationChannelsForRole(role) {
  if (role === 'coach') return Object.values(COMMUNICATION_CHANNELS);
  if (role === 'scout' || role === 'manager') return [COMMUNICATION_CHANNELS.GUARDIAN_MEDIATED_GROUP];
  return [];
}

async function validateCommunicationRequest({ athlete, adult, scope, transaction = null }) {
  if (!isMinorAthlete(athlete) || !adult || adult.deletedAt || adult.bannedAt) return false;
  const role = String(adult.role || '').toLowerCase();
  const channels = communicationChannelsForRole(role);
  if (!channels.includes(scope?.channels?.[0])) return false;
  if (role === 'coach') {
    const clubId = Number(scope.clubId);
    if (!Number.isInteger(clubId) || clubId < 1) return false;
    const membership = await ClubMember.findOne({
      where: { athleteId: Number(athlete.id), clubId, status: 'approved', leftAt: null },
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!membership) return false;
    const [club, assignments] = await Promise.all([
      User.findByPk(clubId, { attributes: ['id', 'role', 'adminVerified', 'deletedAt', 'bannedAt'], ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}) }),
      ClubStaff.findAll({ where: { clubId, staffId: Number(adult.id), status: 'active' }, ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}) }),
    ]);
    return isVerifiedClub(club) && assignments.some((assignment) =>
      COACHING_STAFF_ROLES.has(String(assignment.staffRole || '').toLowerCase()) &&
      isActiveCoachAssignment(adult, assignment, clubId));
  }
  return ['scout', 'manager'].includes(role) && adult.adminVerified === true &&
    scope.channels[0] === COMMUNICATION_CHANNELS.GUARDIAN_MEDIATED_GROUP;
}

function communicationRevokePageHtml({ token, error, communication = false }) {
  if (error) return shellHtml({ title: 'X TALENTI — Pëlqimi prindëror', body: `<h1>Menaxhimi i pëlqimit</h1><p class="err">${escapeHtml(error)}</p>` });
  const actionUrl = escapeHtml(`${getApiPublicBase()}/api/verification/parent-revoke`);
  const title = communication ? 'Tërhiq pëlqimin për komunikim' : 'Tërhiq pëlqimin prindëror';
  const body = communication
    ? 'Vetëm miratimi specifik për komunikim do të tërhiqet. Autorizimi i llogarisë sportive nuk ndryshon.'
    : 'Kjo do ta kufizojë menjëherë llogarinë e të miturit dhe do të tërheqë pëlqimet specifike të komunikimit.';
  return shellHtml({ title: `X TALENTI — ${title}`, body: `<h1>${title}</h1><p>${body}</p><form method="POST" action="${actionUrl}"><input type="hidden" name="token" value="${escapeHtml(token)}"/><button type="submit">${title}</button></form>` });
}

async function communicationDetails(consent, athlete) {
  const scope = consent?.consentScope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  const adultId = Number(scope.adultUserId);
  const channel = String(scope.channels?.[0] || '');
  if (!Number.isInteger(adultId) || adultId < 1 || !communicationChannelsForRole('coach').includes(channel)) return null;
  const adult = await User.findByPk(adultId, { attributes: ['id', 'firstName', 'lastName', 'role', 'adminVerified', 'deletedAt', 'bannedAt'] });
  if (!await validateCommunicationRequest({ athlete, adult, scope })) return null;
  const club = scope.clubId ? await User.findByPk(Number(scope.clubId), { attributes: ['id', 'firstName', 'lastName'] }) : null;
  return {
    adult,
    adultName: `${adult?.firstName || ''} ${adult?.lastName || ''}`.trim() || 'Përdorues i verifikuar',
    clubName: `${club?.firstName || ''} ${club?.lastName || ''}`.trim(),
    channel,
  };
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
      const accountConsent = await GuardianConsent.create({
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
      await GuardianConsentEvent.create({
        consentId: accountConsent.id,
        minorUserId: user.id,
        actorUserId: user.id,
        actorType: 'athlete',
        eventType: 'account_consent_requested',
        metadata: { policyVersion: CONSENT_POLICY_VERSION },
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

/** Coach/scout/manager requests one guardian approval for one adult + channel. */
exports.requestCommunicationConsent = async (req, res) => {
  try {
    const athleteId = Number(req.body?.athleteId);
    const requestedChannel = String(req.body?.channel || '');
    const requestedClubId = req.body?.clubId == null ? null : Number(req.body.clubId);
    if (!Number.isInteger(athleteId) || athleteId < 1) return res.status(400).json({ msg: 'Atleti nuk është i vlefshëm.' });

    const [adult, athlete] = await Promise.all([
      User.findByPk(Number(req.user.id)),
      User.findByPk(athleteId),
    ]);
    if (!adult || adult.deletedAt || adult.bannedAt) return res.status(403).json({ msg: 'Llogaria nuk është aktive.' });
    if (!athlete || !isMinorAthlete(athlete) || !athlete.parentVerified || !await hasActiveGuardianConsent(athlete.id)) {
      return res.status(403).json({ msg: 'Atleti nuk ka autorizim aktiv të kujdestarit.' });
    }
    const role = String(adult.role || '').toLowerCase();
    const allowedChannels = communicationChannelsForRole(role);
    if (!allowedChannels.includes(requestedChannel)) return res.status(403).json({ msg: 'Ky rol nuk mund ta kërkojë këtë lloj komunikimi.' });
    if (!athlete.parentEmail || String(athlete.parentEmail).trim().toLowerCase() === String(athlete.email || '').trim().toLowerCase()) {
      return res.status(409).json({ msg: 'Nuk ka kontakt të vlefshëm kujdestari për kërkesën.' });
    }

    let clubId = null;
    if (role === 'coach') {
      const memberships = await ClubMember.findAll({
        where: { athleteId, status: 'approved', leftAt: null },
      });
      const clubIds = [...new Set(memberships.map((membership) => Number(membership.clubId)).filter(Number.isInteger))];
      const candidates = requestedClubId == null ? clubIds : clubIds.filter((id) => id === requestedClubId);
      for (const candidate of candidates) {
        const valid = await validateCommunicationRequest({
          athlete,
          adult,
          scope: { adultUserId: adult.id, clubId: candidate, channels: [requestedChannel] },
        });
        if (valid) { clubId = candidate; break; }
      }
      if (!clubId) return res.status(403).json({ msg: 'Nuk ke caktim aktiv në klubin e atletit.' });
    } else if (adult.adminVerified !== true) {
      return res.status(403).json({ msg: 'Llogaria profesionale duhet të jetë e verifikuar.' });
    }

    if (await hasCommunicationConsent({
      GuardianConsent,
      minorUserId: athleteId,
      adultUserId: adult.id,
      channel: requestedChannel,
      clubId,
    })) {
      return res.status(200).json({ success: true, alreadyAuthorized: true, emailSent: false, channel: requestedChannel });
    }

    const pendingRows = await GuardianConsent.findAll({
      where: { minorUserId: athleteId, consentPurpose: 'minor_communication', verifiedAt: null, revokedAt: null },
    });
    for (const pending of pendingRows) {
      if (Number(pending.consentScope?.adultUserId) === Number(adult.id) &&
        pending.consentScope?.channels?.includes(requestedChannel)) {
        pending.verificationTokenHash = null;
        pending.verificationTokenExpiresAt = new Date();
        await pending.save();
      }
    }

    const rawToken = createRawToken();
    const expiresAt = new Date(Date.now() + PARENT_TOKEN_TTL_MS);
    const scope = {
      version: 1,
      adultUserId: Number(adult.id),
      adultRole: role,
      clubId,
      channels: [requestedChannel],
      requestedAt: new Date().toISOString(),
      requestedByUserId: Number(adult.id),
    };
    let consent;
    await sequelize.transaction(async (transaction) => {
      consent = await GuardianConsent.create({
        minorUserId: athlete.id,
        guardianEmail: String(athlete.parentEmail).trim().toLowerCase(),
        consentPurpose: 'minor_communication',
        consentScope: scope,
        policyVersion: `${CONSENT_POLICY_VERSION}-communication-v1`,
        verificationMethod: 'guardian_email_attestation',
        verificationTokenHash: tokenHash(rawToken),
        verificationTokenExpiresAt: expiresAt,
      }, { transaction });
      await GuardianConsentEvent.create({
        consentId: consent.id,
        minorUserId: athlete.id,
        actorUserId: adult.id,
        actorType: 'professional',
        eventType: 'communication_consent_requested',
        metadata: { adultUserId: Number(adult.id), adultRole: role, clubId, channel: requestedChannel, policyVersion: `${CONSENT_POLICY_VERSION}-communication-v1` },
      }, { transaction });
    });
    const athleteName = `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim() || 'Atleti';
    const adultName = `${adult.firstName || ''} ${adult.lastName || ''}`.trim() || 'Përdorues i verifikuar';
    const club = clubId ? await User.findByPk(clubId, { attributes: ['firstName', 'lastName'] }) : null;
    const clubName = `${club?.firstName || ''} ${club?.lastName || ''}`.trim();
    const sent = await sendEmail(
      consent.guardianEmail,
      'parentCommunicationConsent',
      athleteName,
      adultName,
      clubName,
      requestedChannel,
      rawToken,
      athlete.language || 'sq'
    );
    if (!sent.success) {
      console.warn('Communication consent email not sent for minor account id:', athlete.id);
      await GuardianConsentEvent.create({
        consentId: consent.id,
        minorUserId: athlete.id,
        actorUserId: adult.id,
        actorType: 'system',
        eventType: 'communication_email_failed',
        metadata: { channel: requestedChannel },
      });
      return res.status(503).json({ success: false, emailSent: false, msg: 'Email-i i kërkesës nuk u dërgua. Provo përsëri më vonë.' });
    }
    await GuardianConsentEvent.create({
      consentId: consent.id,
      minorUserId: athlete.id,
      actorUserId: adult.id,
      actorType: 'system',
      eventType: 'communication_email_sent',
      metadata: { channel: requestedChannel },
    });
    return res.status(202).json({
      success: true,
      emailSent: true,
      consentId: consent.id,
      channel: requestedChannel,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      msg: 'Kërkesa iu dërgua kujdestarit për shqyrtim.',
    });
  } catch (error) {
    console.error('Communication consent request failed:', error?.message || error);
    return res.status(500).json({ msg: 'Kërkesa për pëlqim nuk u përfundua.' });
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
    if (consent.consentPurpose === 'minor_communication') {
      const details = await communicationDetails(consent, user);
      if (!details) return res.status(400).send(communicationConfirmPageHtml({ error: 'Kërkesa nuk është më e vlefshme ose caktimi nuk është aktiv.' }));
      return res.send(communicationConfirmPageHtml({
        token,
        athleteName,
        adultName: details.adultName,
        clubName: details.clubName,
        channel: details.channel,
      }));
    }
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
      const page = found.consent.consentPurpose === 'minor_communication' ? communicationConfirmPageHtml : confirmPageHtml;
      return res.status(400).send(page({ error: 'Plotëso emrin, marrëdhënien dhe deklarimin e kujdestarit.' }));
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
      const communication = consent?.consentPurpose === 'minor_communication';
      if (!consent || !lockedUser || !isFutureDate(consent.verificationTokenExpiresAt) || consent.verifiedAt ||
        (!communication && !needsParentVerification(lockedUser))) return false;

      let communicationScope = null;
      if (communication) {
        communicationScope = consent.consentScope;
        const activeAccountConsent = await GuardianConsent.findOne({
          where: {
            minorUserId: lockedUser.id,
            consentPurpose: 'minor_account_authorization',
            verifiedAt: { [Op.ne]: null },
            revokedAt: null,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const adult = await User.findByPk(Number(communicationScope?.adultUserId), {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!activeAccountConsent || !lockedUser.parentVerified ||
          String(lockedUser.parentEmail || '').trim().toLowerCase() !== String(consent.guardianEmail || '').trim().toLowerCase() ||
          !await validateCommunicationRequest({ athlete: lockedUser, adult, scope: communicationScope, transaction })) return false;
      }
      consent.guardianName = guardianName;
      consent.relationship = relationship;
      consent.verificationMethod = 'guardian_email_attestation';
      consent.verifiedAt = now;
      consent.verificationTokenHash = null;
      consent.verificationTokenExpiresAt = null;
      consent.managementTokenHash = tokenHash(managementToken);
      consent.managementTokenExpiresAt = new Date(Date.now() + MANAGEMENT_TOKEN_TTL_MS);
      await consent.save({ transaction });
      await GuardianConsentEvent.create({
        consentId: consent.id,
        minorUserId: lockedUser.id,
        actorUserId: null,
        actorType: 'guardian_email',
        eventType: communication ? 'communication_consent_approved' : 'account_consent_approved',
        metadata: communication
          ? { adultUserId: Number(communicationScope?.adultUserId), clubId: Number(communicationScope?.clubId) || null, channel: communicationScope?.channels?.[0] }
          : { policyVersion: consent.policyVersion },
        eventAt: now,
      }, { transaction });
      if (communication) return { user: lockedUser, communication: true, scope: communicationScope };

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
      return { user: lockedUser, communication: false, scope: null };
    });
    if (!saved) return res.status(400).send(found.consent.consentPurpose === 'minor_communication'
      ? communicationConfirmPageHtml({ error: 'Linku ka skaduar, është përdorur ose kërkesa nuk kualifikohet më.' })
      : confirmPageHtml({ error: 'Linku është skaduar, përdorur, ose llogaria nuk kualifikohet.' }));

    const savedUser = saved.user;
    const athleteName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Lojtari';
    const managementUrl = `${getApiPublicBase()}/api/verification/parent-revoke?token=${encodeURIComponent(managementToken)}`;
    if (saved.communication) {
      const details = await communicationDetails({ consentScope: saved.scope }, savedUser);
      const sent = await sendEmail(
        found.consent.guardianEmail,
        'parentCommunicationManagement',
        athleteName,
        details?.adultName || 'Përdorues i verifikuar',
        details?.channel || saved.scope.channels?.[0],
        managementUrl,
        user.language || 'sq'
      );
      if (!sent.success) console.warn('Communication consent management email not sent for minor account id:', savedUser.id);
      return res.status(200).send(shellHtml({
        title: 'X TALENTI — Pëlqimi u regjistrua',
        body: `<h1 class="ok">✓ Pëlqimi u regjistrua</h1><p>Miratimi yt specifik për komunikimin e <strong>${escapeHtml(athleteName)}</strong> u aktivizua.</p><p class="muted">Mund ta tërheqësh në çdo kohë. Kjo nuk ndryshon pëlqimin bazë të llogarisë sportive.</p><a class="btn btn-secondary" href="${escapeHtml(managementUrl)}">Menaxho ose tërhiq pëlqimin</a>`,
      }));
    }

    // Once guardian authorization is active, synchronize the club-managed athlete
    // into the existing tournament squad structures; pending minors stay excluded.
    try {
      const managedMemberships = await ClubMember.findAll({
        where: { athleteId: savedUser.id, creationSource: 'club_managed_registration', status: 'approved' },
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

    const sent = await sendEmail(found.consent.guardianEmail, 'parentConsentManagement', athleteName, managementUrl, user.language || 'sq');
    if (!sent.success) console.warn('Guardian consent management email not sent for minor account id:', savedUser.id);
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
      return res.status(400).send(communicationRevokePageHtml({ error: 'Linku nuk është i vlefshëm ose ka skaduar.' }));
    }
    return res.send(communicationRevokePageHtml({ token, communication: consent.consentPurpose === 'minor_communication' }));
  } catch {
    return res.status(500).send(communicationRevokePageHtml({ error: 'Gabim serveri.' }));
  }
};

exports.parentRevoke = async (req, res) => {
  setSensitiveResponseHeaders(res);
  try {
    const token = normalizeToken(req.body?.token);
    const hash = token ? tokenHash(token) : '';
    if (!hash) return res.status(400).send(revokePageHtml({ error: 'Linku nuk është i vlefshëm.' }));
    let revokedUserId = null;
    let communicationOnly = false;
    let revokedAdultUserId = null;
    await sequelize.transaction(async (transaction) => {
      const consent = await GuardianConsent.findOne({ where: { managementTokenHash: hash, revokedAt: null }, transaction, lock: transaction.LOCK.UPDATE });
      if (!consent || !isFutureDate(consent.managementTokenExpiresAt)) throw new Error('INVALID_OR_EXPIRED');
      const user = await User.findByPk(consent.minorUserId, { transaction, lock: transaction.LOCK.UPDATE });
      const revokedAt = new Date();
      communicationOnly = consent.consentPurpose === 'minor_communication';
      revokedAdultUserId = communicationOnly ? Number(consent.consentScope?.adultUserId) || null : null;
      consent.revokedAt = revokedAt;
      consent.managementTokenHash = null;
      consent.managementTokenExpiresAt = null;
      await consent.save({ transaction });
      await GuardianConsentEvent.create({
        consentId: consent.id,
        minorUserId: consent.minorUserId,
        actorUserId: null,
        actorType: 'guardian_email',
        eventType: communicationOnly ? 'communication_consent_revoked' : 'account_consent_revoked',
        metadata: communicationOnly
          ? { adultUserId: revokedAdultUserId, channel: consent.consentScope?.channels?.[0] }
          : { policyVersion: consent.policyVersion },
        eventAt: revokedAt,
      }, { transaction });
      if (user) {
        revokedUserId = user.id;
        if (communicationOnly) return;

        // Base account-consent withdrawal also revokes every communication grant.
        const communicationConsents = await GuardianConsent.findAll({
          where: { minorUserId: user.id, consentPurpose: 'minor_communication', revokedAt: null },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        await GuardianConsent.update({
          revokedAt,
          verificationTokenHash: null,
          verificationTokenExpiresAt: null,
          managementTokenHash: null,
          managementTokenExpiresAt: null,
        }, {
          where: { minorUserId: user.id, consentPurpose: 'minor_communication', revokedAt: null },
          transaction,
        });
        for (const communicationConsent of communicationConsents) {
          await GuardianConsentEvent.create({
            consentId: communicationConsent.id,
            minorUserId: user.id,
            actorUserId: null,
            actorType: 'guardian_email',
            eventType: 'communication_consent_revoked_with_account',
            metadata: { adultUserId: Number(communicationConsent.consentScope?.adultUserId) || null, channel: communicationConsent.consentScope?.channels?.[0] },
            eventAt: revokedAt,
          }, { transaction });
        }

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
        user.parentVerified = false;
        user.tokenVersion = Number(user.tokenVersion || 0) + 1;
        syncOverallVerified(user);
        await user.save({ transaction });
      }
    });
    if (revokedUserId) {
      if (!communicationOnly) {
        try {
          const mediaResult = await require('../services/restrictUserCloudinaryMedia').restrictUserCloudinaryMedia(revokedUserId);
          if (mediaResult.errors.length) {
            console.error('Guardian withdrawal left Cloudinary media to retry:', mediaResult.errors.length);
          }
        } catch (mediaError) {
          // Authorization is already revoked. Report the failed asset cleanup
          // for operator retry instead of restoring the withdrawn consent.
          console.error('Cloudinary media restriction after guardian withdrawal failed:', mediaError?.message || 'provider cleanup error');
        }
      }
      // Consent withdrawal must stop active and already-scheduled private calls,
      // while preserving their historical records.
      try {
        const pairWhere = communicationOnly && revokedAdultUserId
          ? { [Op.or]: [
            { callerId: revokedUserId, receiverId: revokedAdultUserId },
            { callerId: revokedAdultUserId, receiverId: revokedUserId },
          ] }
          : { [Op.or]: [{ callerId: revokedUserId }, { receiverId: revokedUserId }] };
        const activeCalls = await VideoCall.findAll({
          where: { ...pairWhere, status: { [Op.in]: ['ringing', 'connected'] } },
          attributes: ['id', 'callerId', 'receiverId'],
        });
        if (activeCalls.length) {
          await VideoCall.update(
            { status: 'ended', endTime: new Date() },
            { where: { id: { [Op.in]: activeCalls.map((call) => call.id) }, status: { [Op.in]: ['ringing', 'connected'] } } }
          );
          for (const call of activeCalls) {
            const io = req.app.get('io');
            io?.to(String(call.callerId)).emit('call:ended', { callId: call.id, reason: 'guardian_consent_revoked' });
            io?.to(String(call.receiverId)).emit('call:ended', { callId: call.id, reason: 'guardian_consent_revoked' });
          }
        }
        await ScheduledCall.update(
          { status: 'cancelled' },
          { where: { ...pairWhere, status: 'scheduled' } }
        );
      } catch (callRevocationError) {
        console.error('Call cleanup after guardian consent withdrawal failed:', callRevocationError?.message || callRevocationError);
      }
      req.app.get('io')?.in(String(revokedUserId)).disconnectSockets(true);
    }
    const body = communicationOnly
      ? '<h1 class="ok">Pëlqimi për komunikim u tërhoq</h1><p>Kontakti i ri përmes këtij kanali është bllokuar menjëherë. Pëlqimi bazë i llogarisë sportive mbetet aktiv.</p>'
      : '<h1 class="ok">Pëlqimi prindëror u tërhoq</h1><p>Llogaria e të miturit dhe të gjitha pëlqimet e komunikimit janë kufizuar menjëherë.</p>';
    return res.send(shellHtml({ title: 'X TALENTI — Pëlqimi u tërhoq', body }));
  } catch (err) {
    const status = err.message === 'INVALID_OR_EXPIRED' ? 400 : 500;
    if (status === 500) console.error('Guardian consent revocation failed');
    return res.status(status).send(communicationRevokePageHtml({ error: status === 400 ? 'Linku nuk është i vlefshëm ose ka skaduar.' : 'Gabim serveri.' }));
  }
};
