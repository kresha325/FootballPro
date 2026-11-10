const { Op } = require('sequelize');
const db = require('../models');
const sequelize = require('../config/database');
const ClubMember = require('../models/ClubMember');
const ClubStaff = require('../models/ClubStaff');
const { createAthleteIdentityKey, normalizeAthleteIdentityKey } = require('../utils/athleteIdentity');

const GROUPS = new Set('ABCDEFGH'.split(''));
const MANAGER_ROLES = new Set(['president', 'vice_president', 'chairman', 'ceo', 'general_manager', 'sporting_director', 'technical_director', 'director_of_football', 'academy_director', 'youth_director', 'team_manager', 'secretary_general', 'secretary', 'head_coach']);

function normalized(value) {
  return String(value || '').trim().normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ');
}

async function activeAuthorizedClubStaff(staffId, clubId) {
  if (!staffId || !clubId) return false;
  const assignment = await ClubStaff.findOne({
    where: { clubId, staffId, status: 'active', leftAt: null, staffRole: { [Op.in]: [...MANAGER_ROLES] } },
    include: [{ model: db.User, as: 'staff', attributes: ['id', 'role', 'bannedAt', 'deletedAt'], required: true }],
  });
  if (!assignment || assignment.staff?.bannedAt || assignment.staff?.deletedAt || assignment.staff?.role !== 'coach') return false;
  const expiryText = String(assignment.contractUntil || '').trim();
  if (!expiryText || expiryText.toLowerCase() === 'vazhdon') return true;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiryText);
  const expiry = new Date(isDateOnly ? `${expiryText}T23:59:59.999Z` : expiryText);
  return Number.isFinite(expiry.getTime()) && expiry >= new Date();
}

async function tournamentForLiga(tournamentId, user) {
  const tournament = await db.Tournament.findByPk(tournamentId);
  if (!tournament) return { error: { status: 404, msg: 'Turneu nuk u gjet.' } };
  if (user?.role !== 'admin' && (user?.role !== 'liga' || Number(tournament.creatorId) !== Number(user.id))) {
    return { error: { status: 403, msg: 'Vetëm liga që e menaxhon turneun mund t’i ndryshojë ekipet.' } };
  }
  if (!(tournament.ligaId || tournament.sourceRole === 'liga')) {
    return { error: { status: 400, msg: 'Regjistrimi manual i ekipeve vlen vetëm për turnetë e ligës.' } };
  }
  return { tournament };
}

async function getVerifiedClubs(req, res) {
  try {
    if (!['liga', 'admin'].includes(req.user?.role)) return res.status(403).json({ msg: 'Vetëm ligat mund të zgjedhin klubet pjesëmarrëse.' });
    const q = String(req.query.q || '').trim();
    const clubs = await db.User.findAll({
      where: { role: 'club', adminVerified: true, bannedAt: null, deletedAt: null },
      attributes: ['id', 'firstName', 'lastName'],
      include: [{ model: db.Profile, attributes: ['club', 'profilePhoto'], required: false }],
      order: [['id', 'ASC']],
      limit: 500,
    });
    const result = clubs.map((club) => ({
      id: club.id,
      name: String(club.Profile?.club || `${club.firstName || ''} ${club.lastName || ''}`).trim() || `Klubi #${club.id}`,
      logo: club.Profile?.profilePhoto || null,
    })).filter((club) => !q || normalized(club.name).includes(normalized(q)));
    return res.json(result);
  } catch (err) {
    console.error('getVerifiedTournamentClubs:', err);
    return res.status(500).json({ msg: 'Klubet nuk mund të ngarkoheshin.' });
  }
}

async function replaceTournamentClubEntries(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { tournament, error } = await tournamentForLiga(req.params.id, req.user);
    if (error) { await transaction.rollback(); return res.status(error.status).json({ msg: error.msg }); }
    if (['active', 'completed', 'cancelled'].includes(tournament.lifecycle || tournament.status)) {
      await transaction.rollback();
      return res.status(409).json({ msg: 'Ekipet nuk mund të ndryshohen pasi turneu ka filluar.' });
    }
    const rows = req.body?.teams;
    if (!Array.isArray(rows) || rows.length > 500) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Dërgo listën e ekipeve pjesëmarrëse.' });
    }
    const ids = [...new Set(rows.map((row) => Number(row.clubUserId)).filter((id) => Number.isInteger(id) && id > 0))];
    const registered = ids.length ? await db.User.findAll({
      where: { id: ids, role: 'club', adminVerified: true, bannedAt: null, deletedAt: null },
      attributes: ['id', 'firstName', 'lastName'],
      include: [{ model: db.Profile, attributes: ['club'], required: false }],
      transaction,
    }) : [];
    if (registered.length !== ids.length) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Zgjidh vetëm klube të verifikuara në platformë.' });
    }
    const clubById = new Map(registered.map((club) => [Number(club.id), club]));
    const names = new Set();
    const prepared = [];
    for (const row of rows) {
      const clubUserId = row.clubUserId ? Number(row.clubUserId) : null;
      const groupName = row.groupName ? String(row.groupName).trim().toUpperCase() : 'A';
      if (groupName && !GROUPS.has(groupName)) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'Grupi duhet të jetë nga A deri në H.' });
      }
      const club = clubUserId ? clubById.get(clubUserId) : null;
      if (row.clubUserId && !club) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'Klubi i zgjedhur nuk është i verifikuar.' });
      }
      const clubName = String(row.clubName || (club && (club.Profile?.club || `${club.firstName || ''} ${club.lastName || ''}`)) || '').trim().replace(/\s+/g, ' ');
      if (!clubName || clubName.length > 160) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'Emri i klubit është i detyrueshëm dhe duhet të jetë deri në 160 karaktere.' });
      }
      const key = normalized(clubName);
      if (names.has(key)) {
        await transaction.rollback();
        return res.status(409).json({ msg: `Klubi "${clubName}" është shtuar më shumë se një herë.` });
      }
      names.add(key);
      prepared.push({ tournamentId: tournament.id, clubUserId, clubName, groupName, claimStatus: clubUserId ? 'linked' : 'unclaimed' });
    }
    if (prepared.length > Number(tournament.maxParticipants || 0)) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Numri i ekipeve tejkalon kapacitetin e turneut.' });
    }
    // Preserve historical team entries/statistics. Unselected teams are removed from the active group only.
    const currentLinked = await db.TournamentClubEntry.findAll({ where: { tournamentId: tournament.id, clubUserId: { [Op.ne]: null } }, transaction });
    for (const existing of currentLinked) {
      if (!prepared.some((row) => Number(row.clubUserId) === Number(existing.clubUserId))) {
        existing.groupName = null;
        await existing.save({ transaction });
        await db.TournamentParticipant.update({ status: 'rejected' }, { where: { tournamentId: tournament.id, userId: existing.clubUserId }, transaction });
      }
    }
    const currentExternal = await db.TournamentClubEntry.findAll({ where: { tournamentId: tournament.id, clubUserId: null }, transaction });
    for (const existing of currentExternal) {
      if (!prepared.some((row) => !row.clubUserId && normalized(row.clubName) === normalized(existing.clubName))) {
        existing.groupName = null;
        await existing.save({ transaction });
      }
    }
    for (const row of prepared) {
      let entry;
      if (row.clubUserId) {
        [entry] = await db.TournamentClubEntry.findOrCreate({ where: { tournamentId: tournament.id, clubUserId: row.clubUserId }, defaults: row, transaction });
      } else {
        const externalRows = await db.TournamentClubEntry.findAll({ where: { tournamentId: tournament.id, clubUserId: null }, transaction });
        entry = externalRows.find((candidate) => normalized(candidate.clubName) === normalized(row.clubName));
        if (!entry) entry = await db.TournamentClubEntry.create(row, { transaction });
      }
      await entry.update({ clubName: row.clubName, groupName: row.groupName, claimStatus: row.clubUserId ? 'linked' : entry.claimStatus }, { transaction });
      if (row.clubUserId) {
        await db.TournamentParticipant.findOrCreate({
          where: { tournamentId: tournament.id, userId: row.clubUserId },
          defaults: { tournamentId: tournament.id, userId: row.clubUserId, status: 'accepted', groupName: row.groupName },
          transaction,
        });
        await db.TournamentParticipant.update({ groupName: row.groupName, status: 'accepted' }, { where: { tournamentId: tournament.id, userId: row.clubUserId }, transaction });
      }
    }
    const entries = await db.TournamentClubEntry.findAll({ where: { tournamentId: tournament.id }, order: [['groupName', 'ASC'], ['clubName', 'ASC']], transaction });
    await transaction.commit();
    return res.json({ entries });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('replaceTournamentClubEntries:', err);
    return res.status(500).json({ msg: 'Ekipet nuk u ruajtën.' });
  }
}

async function getTournamentClubEntries(req, res) {
  try {
    const entries = await db.TournamentClubEntry.findAll({
      where: { tournamentId: req.params.id },
      order: [['groupName', 'ASC'], ['points', 'DESC'], ['goalsFor', 'DESC'], ['clubName', 'ASC']],
    });
    const tournament = await db.Tournament.findByPk(req.params.id, { attributes: ['id', 'creatorId'] });
    const visibleEntries = [];
    for (const entry of entries) {
      const row = entry.toJSON();
      const isLigaManager = req.user && (req.user.role === 'admin' || (req.user.role === 'liga' && Number(req.user.id) === Number(tournament?.creatorId)));
      const isClubOwner = req.user?.role === 'club' && Number(req.user.id) === Number(entry.clubUserId);
      const isAuthorizedCoach = req.user?.role === 'coach' && await activeAuthorizedClubStaff(req.user.id, entry.clubUserId);
      delete row.claimRequestedBy;
      if (isLigaManager && entry.claimRequestedBy) {
        const claimant = await db.User.findByPk(entry.claimRequestedBy, { attributes: ['id', 'firstName', 'lastName'] });
        if (claimant) row.claimant = { id: claimant.id, name: `${claimant.firstName || ''} ${claimant.lastName || ''}`.trim() };
      }
      if (isLigaManager || isClubOwner || isAuthorizedCoach) {
        row.playerStats = await db.TournamentClubPlayerStat.findAll({
          where: { tournamentClubEntryId: entry.id },
          attributes: ['id', 'athleteIdentityKey', 'athleteUserId', 'athleteName', 'goals', 'assists'],
          order: [['athleteName', 'ASC']],
        });
      }
      visibleEntries.push(row);
    }
    return res.json({ entries: visibleEntries });
  } catch (err) {
    console.error('getTournamentClubEntries:', err);
    return res.status(500).json({ msg: 'Ekipet nuk mund të ngarkoheshin.' });
  }
}

async function updateTournamentClubEntryStats(req, res) {
  try {
    const { tournament, error } = await tournamentForLiga(req.params.id, req.user);
    if (error) return res.status(error.status).json({ msg: error.msg });
    const entry = await db.TournamentClubEntry.findOne({ where: { id: req.params.entryId, tournamentId: tournament.id } });
    if (!entry) return res.status(404).json({ msg: 'Ekipi nuk u gjet.' });
    const stats = req.body || {};
    for (const key of ['played', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'points']) {
      if (stats[key] === undefined) continue;
      const value = Number(stats[key]);
      if (!Number.isInteger(value) || value < 0 || value > 10000) return res.status(400).json({ msg: `Vlera e pavlefshme për ${key}.` });
      entry[key] = value;
    }
    if (Number(entry.played) !== Number(entry.wins) + Number(entry.draws) + Number(entry.losses)) {
      return res.status(400).json({ msg: 'Numri i ndeshjeve duhet të jetë i barabartë me fitoret, barazimet dhe humbjet.' });
    }
    await entry.save();
    return res.json({ entry });
  } catch (err) {
    console.error('updateTournamentClubEntryStats:', err);
    return res.status(500).json({ msg: 'Statistikat e klubit nuk u ruajtën.' });
  }
}

async function requestClubEntryClaim(req, res) {
  try {
    const club = await db.User.findByPk(req.user.id, { attributes: ['id', 'role', 'adminVerified', 'bannedAt', 'deletedAt'] });
    if (!club || club.role !== 'club' || club.adminVerified !== true || club.bannedAt || club.deletedAt) return res.status(403).json({ msg: 'Kërkesa për lidhje lejohet vetëm për klube të verifikuara.' });
    const entry = await db.TournamentClubEntry.findByPk(req.params.entryId);
    if (!entry || entry.clubUserId) return res.status(404).json({ msg: 'Ekipi nuk është i disponueshëm për pretendim.' });
    entry.claimRequestedBy = club.id;
    entry.claimStatus = 'pending';
    await entry.save();
    return res.json({ msg: 'Kërkesa iu dërgua ligës për verifikim dhe aprovim manual.', entry });
  } catch (err) {
    console.error('requestClubEntryClaim:', err);
    return res.status(500).json({ msg: 'Kërkesa nuk u ruajt.' });
  }
}

async function reviewClubEntryClaim(req, res) {
  try {
    const { tournament, error } = await tournamentForLiga(req.params.id, req.user);
    if (error) return res.status(error.status).json({ msg: error.msg });
    const entry = await db.TournamentClubEntry.findOne({ where: { id: req.params.entryId, tournamentId: tournament.id, claimStatus: 'pending' } });
    if (!entry) return res.status(404).json({ msg: 'Kërkesa e pretendimit nuk u gjet.' });
    if (req.body?.approve === true) {
      const club = await db.User.findByPk(entry.claimRequestedBy, { attributes: ['id', 'role', 'adminVerified', 'bannedAt', 'deletedAt'] });
      if (!club || club.role !== 'club' || club.adminVerified !== true || club.bannedAt || club.deletedAt) return res.status(409).json({ msg: 'Klubi nuk është më i verifikuar.' });
      const existing = await db.TournamentClubEntry.findOne({ where: { tournamentId: tournament.id, clubUserId: club.id } });
      if (existing && existing.id !== entry.id) return res.status(409).json({ msg: 'Klubi tashmë ka një hyrje në këtë turne.' });
      entry.clubUserId = club.id;
      entry.claimStatus = 'linked';
      await db.TournamentParticipant.findOrCreate({
        where: { tournamentId: tournament.id, userId: club.id },
        defaults: { tournamentId: tournament.id, userId: club.id, status: 'accepted', groupName: entry.groupName },
      });
    } else {
      entry.claimRequestedBy = null;
      entry.claimStatus = 'unclaimed';
    }
    await entry.save();
    return res.json({ entry });
  } catch (err) {
    console.error('reviewClubEntryClaim:', err);
    return res.status(500).json({ msg: 'Vendimi nuk u ruajt.' });
  }
}

async function saveClubPlayerStats(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const entry = await db.TournamentClubEntry.findByPk(req.params.entryId, { transaction });
    if (!entry) { await transaction.rollback(); return res.status(404).json({ msg: 'Ekipi nuk u gjet.' }); }
    if (await db.Match.count({ where: { tournamentId: entry.tournamentId }, transaction })) {
      await transaction.rollback();
      return res.status(409).json({ msg: 'Turneu ka ndeshje. Vendos statistikat për çdo ndeshje, brenda rezultatit zyrtar.' });
    }
    const actor = await db.User.findByPk(req.user.id, { attributes: ['id', 'role', 'adminVerified', 'bannedAt', 'deletedAt'], transaction });
    const club = entry.clubUserId ? await db.User.findByPk(entry.clubUserId, { attributes: ['id', 'role', 'adminVerified', 'bannedAt', 'deletedAt'], transaction }) : null;
    const staff = actor?.role === 'coach' ? await activeAuthorizedClubStaff(actor.id, entry.clubUserId) : false;
    const verifiedClub = club?.role === 'club' && club.adminVerified === true && !club.bannedAt && !club.deletedAt;
    const owns = actor?.role === 'club' && Number(actor.id) === Number(entry.clubUserId) && actor.adminVerified === true;
    if ((!owns && !staff) || !verifiedClub || actor?.bannedAt || actor?.deletedAt || !entry.clubUserId) {
      await transaction.rollback();
      return res.status(403).json({ msg: 'Vetëm klubi i verifikuar ose stafi aktiv i autorizuar mund t’i vendosë statistikat.' });
    }
    const rows = req.body?.players;
    if (!Array.isArray(rows) || rows.length > 100) { await transaction.rollback(); return res.status(400).json({ msg: 'Lista e lojtarëve është e pavlefshme.' }); }
    const existingRows = await db.TournamentClubPlayerStat.findAll({ where: { tournamentClubEntryId: entry.id }, transaction });
    const seen = new Set();
    for (const row of rows) {
      const athleteName = String(row.athleteName || '').trim().replace(/\s+/g, ' ');
      const goals = Number(row.goals ?? 0);
      const assists = Number(row.assists ?? 0);
      if (!athleteName || athleteName.length > 160 || !Number.isInteger(goals) || goals < 0 || goals > 1000 || !Number.isInteger(assists) || assists < 0 || assists > 1000) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'Kontrollo emrat dhe vlerat e golave/asisteve.' });
      }
      let athleteUserId = null;
      if (row.athleteUserId) {
        athleteUserId = Number(row.athleteUserId);
        const membership = await ClubMember.findOne({ where: { clubId: entry.clubUserId, athleteId: athleteUserId, status: 'approved' }, transaction });
        if (!membership) { await transaction.rollback(); return res.status(403).json({ msg: 'Lojtari nuk është anëtar i aprovuar i klubit.' }); }
      }
      if (!athleteUserId) {
        const roster = await ClubMember.findAll({
          where: { clubId: entry.clubUserId, status: 'approved' },
          include: [{ model: db.User, as: 'athlete', attributes: ['id', 'firstName', 'lastName'], required: true }],
          transaction,
        });
        const matches = roster.filter((membership) => normalized(`${membership.athlete?.firstName || ''} ${membership.athlete?.lastName || ''}`) === normalized(athleteName));
        if (matches.length === 1) athleteUserId = Number(matches[0].athleteId);
      }
      let athleteIdentityKey = normalizeAthleteIdentityKey(row.athleteIdentityKey);
      if (row.athleteIdentityKey && !athleteIdentityKey) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'Identiteti i atletit është i pavlefshëm.' });
      }
      const sameNameRows = existingRows.filter((stat) => normalized(stat.athleteName) === normalized(athleteName));
      if (!athleteIdentityKey) {
        const existingUser = athleteUserId ? existingRows.find((stat) => Number(stat.athleteUserId) === athleteUserId) : null;
        if (existingUser) athleteIdentityKey = existingUser.athleteIdentityKey;
        else if (!athleteUserId && sameNameRows.length === 1) athleteIdentityKey = sameNameRows[0].athleteIdentityKey;
        else if (!athleteUserId && sameNameRows.length > 1) {
          await transaction.rollback();
          return res.status(409).json({ msg: 'Ka disa atletë me këtë emër. Zgjidh identitetin ekzistues ose krijo një atlet të veçantë.' });
        } else athleteIdentityKey = createAthleteIdentityKey();
      }
      const existing = existingRows.find((stat) => stat.athleteIdentityKey === athleteIdentityKey);
      const identity = athleteUserId ? `u:${athleteUserId}` : `i:${athleteIdentityKey}`;
      if (seen.has(identity)) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'I njëjti atlet është përsëritur në listë.' });
      }
      seen.add(identity);
      if (existing) await existing.update({ athleteUserId, athleteIdentityKey, athleteName, goals, assists, updatedByUserId: actor.id }, { transaction });
      else {
        const created = await db.TournamentClubPlayerStat.create({ tournamentClubEntryId: entry.id, athleteUserId, athleteIdentityKey, athleteName, goals, assists, updatedByUserId: actor.id }, { transaction });
        existingRows.push(created);
      }
    }
    const saved = await db.TournamentClubPlayerStat.findAll({ where: { tournamentClubEntryId: entry.id }, order: [['athleteName', 'ASC'], ['id', 'ASC']], transaction });
    await transaction.commit();
    return res.json({ players: saved });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('saveClubPlayerStats:', err);
    return res.status(500).json({ msg: 'Statistikat e lojtarëve nuk u ruajtën.' });
  }
}

async function getClubTournamentEntries(req, res) {
  try {
    const clubId = Number(req.params.clubId);
    if (!Number.isInteger(clubId) || clubId <= 0) return res.status(400).json({ msg: 'Klubi është i pavlefshëm.' });
    const privateDetails = req.user && (req.user.role === 'admin' || Number(req.user.id) === clubId);
    const entries = await db.TournamentClubEntry.findAll({
      where: { clubUserId: clubId, claimStatus: 'linked' },
      include: [
        { model: db.Tournament, attributes: ['id', 'name', 'season', 'category', 'status'] },
        ...(privateDetails ? [{ model: db.TournamentClubPlayerStat, as: 'playerStats', required: false, attributes: ['id', 'athleteIdentityKey', 'athleteUserId', 'athleteName', 'goals', 'assists'] }] : []),
      ],
      order: [['updatedAt', 'DESC']],
    });
    return res.json({ entries });
  } catch (err) {
    console.error('getClubTournamentEntries:', err);
    return res.status(500).json({ msg: 'Statistikat e turneve nuk mund të ngarkoheshin.' });
  }
}

module.exports = { getVerifiedClubs, replaceTournamentClubEntries, getTournamentClubEntries, updateTournamentClubEntryStats, requestClubEntryClaim, reviewClubEntryClaim, saveClubPlayerStats, getClubTournamentEntries };
