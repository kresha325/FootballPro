'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const testDatabaseUrl = process.env.XTALENTI_COMPETITION_TEST_DB_URL;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

require('../models'); // establish the production Sequelize associations used by the service
const sequelize = require('../config/database');
const { Tournament } = require('../models/Tournament');
const User = require('../models/User');
const Match = require('../models/Match');
const MatchScorer = require('../models/MatchScorer');
const Bracket = require('../models/Bracket');
const TournamentClubEntry = require('../models/TournamentClubEntry');
const CompetitionAuditEvent = require('../models/CompetitionAuditEvent');
const ClubMember = require('../models/ClubMember');
const ClubStaff = require('../models/ClubStaff');
const GuardianConsent = require('../models/GuardianConsent');
const service = require('../services/competitionService');
const tournamentController = require('../controllers/tournaments');
const { authorizeMinorDirectContact, CHANNELS } = require('../utils/minorCommunicationPolicy');

sequelize.options.logging = false;

test('PostgreSQL competition service protects fixture creation, audits deletion, advances manual group entries, and keeps standings reads read-only', {
  skip: !testDatabaseUrl && 'Set XTALENTI_COMPETITION_TEST_DB_URL to a fully migrated disposable PostgreSQL database',
}, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let actor;
  const tournamentIds = [];
  const userIds = [];
  try {
    await sequelize.authenticate();
    actor = await User.create({ email: `competition-liga-${suffix}@example.test`, password: 'test-only', role: 'liga' });
    userIds.push(actor.id);
    const coach = await User.create({ email: `competition-coach-${suffix}@example.test`, password: 'test-only', role: 'coach' });
    const club = await User.create({ email: `competition-club-${suffix}@example.test`, password: 'test-only', role: 'club', adminVerified: true });
    const minor = await User.create({ email: `competition-minor-${suffix}@example.test`, password: 'test-only', role: 'athlete', dateOfBirth: '2012-05-01' });
    userIds.push(coach.id, club.id, minor.id);
    await ClubMember.create({ clubId: club.id, athleteId: minor.id, status: 'approved' });
    await ClubStaff.create({ clubId: club.id, staffId: coach.id, staffRole: 'head_coach', status: 'active', contractUntil: '2030-12-31' });
    const channelConsent = await GuardianConsent.create({
      minorUserId: minor.id,
      guardianEmail: 'guardian@example.test',
      guardianName: 'Test Guardian',
      relationship: 'parent',
      consentPurpose: 'minor_communication',
      consentScope: { adultUserId: coach.id, clubId: club.id, channels: [CHANNELS.DIRECT_MESSAGE] },
      policyVersion: 'integration-test',
      verificationMethod: 'email',
      verifiedAt: new Date(),
      consentExpiresAt: new Date(Date.now() + 60_000),
    });
    const policyContext = { User, ClubMember, ClubStaff, GuardianConsent };
    const allowedCoach = await authorizeMinorDirectContact({ actorId: coach.id, targetId: minor.id, channel: CHANNELS.DIRECT_MESSAGE, ...policyContext });
    assert.equal(allowedCoach.allowed, true, 'active, assigned coach with exact valid consent is allowed');
    const wrongChannel = await authorizeMinorDirectContact({ actorId: coach.id, targetId: minor.id, channel: CHANNELS.VIDEO_CALL, ...policyContext });
    assert.equal(wrongChannel.allowed, false, 'DM consent does not authorize video calls');
    const unrelatedAdult = await authorizeMinorDirectContact({ actorId: actor.id, targetId: minor.id, channel: CHANNELS.DIRECT_MESSAGE, ...policyContext });
    assert.equal(unrelatedAdult.allowed, false, 'unrelated adult is denied despite having a platform account');
    await channelConsent.update({ consentExpiresAt: new Date(Date.now() - 1_000) });
    const expiredConsent = await authorizeMinorDirectContact({ actorId: coach.id, targetId: minor.id, channel: CHANNELS.DIRECT_MESSAGE, ...policyContext });
    assert.equal(expiredConsent.allowed, false, 'expired communication permission is denied');
    await channelConsent.update({ consentExpiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() });
    const revokedConsent = await authorizeMinorDirectContact({ actorId: coach.id, targetId: minor.id, channel: CHANNELS.DIRECT_MESSAGE, ...policyContext });
    assert.equal(revokedConsent.allowed, false, 'withdrawn consent is denied immediately');

    const createTournament = async (name, type = 'league', lifecycle = 'active') => {
      const tournament = await Tournament.create({
        name,
        type,
        creatorId: actor.id,
        ligaId: null,
        sourceRole: 'liga',
        participantType: 'individual',
        lifecycle,
        status: lifecycle === 'registration' ? 'open' : 'ongoing',
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2027-12-31T23:59:59Z'),
        qualifyPerGroup: 1,
      });
      tournamentIds.push(tournament.id);
      return tournament;
    };

    const league = await createTournament(`Competition integration ${suffix}`);
    const [home, away] = await Promise.all([
      TournamentClubEntry.create({ tournamentId: league.id, clubName: 'Manual Home', groupName: 'A' }),
      TournamentClubEntry.create({ tournamentId: league.id, clubName: 'Manual Away', groupName: 'A' }),
    ]);
    const fixturePayload = {
      homeClubEntryId: home.id,
      awayClubEntryId: away.id,
      matchDate: '2025-06-01T12:00:00.000Z',
      round: 1,
    };
    const simultaneous = await Promise.allSettled([
      service.createLeagueFixture({ tournamentId: league.id, user: actor, payload: fixturePayload }),
      service.createLeagueFixture({ tournamentId: league.id, user: actor, payload: fixturePayload }),
    ]);
    assert.equal(simultaneous.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = simultaneous.find((result) => result.status === 'rejected');
    assert.equal(rejected?.reason?.status, 409);
    const createdFixture = simultaneous.find((result) => result.status === 'fulfilled').value;
    assert.equal(await Match.count({ where: { tournamentId: league.id } }), 1);
    const unauthorized = await User.create({ email: `competition-other-${suffix}@example.test`, password: 'test-only', role: 'liga' });
    userIds.push(unauthorized.id);
    await assert.rejects(
      () => service.createLeagueFixture({ tournamentId: league.id, user: unauthorized, payload: fixturePayload }),
      (error) => error.status === 403,
    );
    const editedFixture = await service.updateLeagueFixture({ matchId: createdFixture.id, user: actor, payload: { venue: 'Pilot Field' } });
    assert.equal(editedFixture.venue, 'Pilot Field');
    assert.ok(await CompetitionAuditEvent.findOne({ where: { matchId: createdFixture.id, eventType: 'fixture_updated' } }));
    await MatchScorer.create({ matchId: createdFixture.id, athleteName: 'Scorer One', goals: 1, side: 'home' });
    await assert.rejects(
      () => service.recordOfficialResult({ matchId: createdFixture.id, user: actor, payload: { scoreHome: 0, scoreAway: 1 } }),
      (error) => error.status === 409,
      'official result cannot be reduced below already-recorded scorer totals without replacing scorer events',
    );
    const unchangedFixture = await Match.findByPk(createdFixture.id);
    assert.equal(unchangedFixture.scoreHome, null, 'rejected result change leaves the official result untouched');
    assert.equal(unchangedFixture.scoreAway, null);

    const participantBefore = await TournamentClubEntry.findByPk(home.id);
    const participantUpdatedAt = participantBefore.updatedAt.getTime();
    await service.getStandings(league.id);
    const participantAfter = await TournamentClubEntry.findByPk(home.id);
    const tournamentAfter = await Tournament.findByPk(league.id);
    assert.equal(participantAfter.updatedAt.getTime(), participantUpdatedAt);
    assert.equal(tournamentAfter.participantType, 'individual', 'GET standings does not persist league-specific participant type repair');

    await service.deleteLeagueFixture({ matchId: createdFixture.id, user: actor });
    assert.equal(await Match.count({ where: { id: createdFixture.id } }), 0);
    const deletionAudit = await CompetitionAuditEvent.findOne({ where: { matchId: createdFixture.id, eventType: 'fixture_deleted' } });
    assert.ok(deletionAudit);
    assert.equal(deletionAudit.metadata.homeClubEntryId, home.id);

    const startRace = await createTournament(`Start race integration ${suffix}`, 'league', 'registration');
    await Promise.all([
      TournamentClubEntry.create({ tournamentId: startRace.id, clubName: 'Race Home' }),
      TournamentClubEntry.create({ tournamentId: startRace.id, clubName: 'Race Away' }),
    ]);
    const startResults = await Promise.allSettled([
      service.startCompetition({ tournamentId: startRace.id, user: actor }),
      service.startCompetition({ tournamentId: startRace.id, user: actor }),
    ]);
    assert.equal(startResults.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(await Match.count({ where: { tournamentId: startRace.id } }), 2, 'concurrent starts create only one double round-robin schedule');

    const groups = await createTournament(`Group knockout integration ${suffix}`, 'group_knockout');
    const entrySpecs = [
      ['A winner', 'A'], ['A runner', 'A'], ['B winner', 'B'], ['B runner', 'B'],
    ];
    const entries = await Promise.all(entrySpecs.map(([clubName, groupName]) => TournamentClubEntry.create({
      tournamentId: groups.id,
      clubName,
      groupName,
    })));
    const groupMatchA = await Match.create({
      tournamentId: groups.id,
      homeClubEntryId: entries[0].id,
      awayClubEntryId: entries[1].id,
      homeName: entries[0].clubName,
      awayName: entries[1].clubName,
      matchDate: new Date('2025-07-01T12:00:00Z'),
      round: 1,
      groupName: 'A',
      stage: 'group',
      status: 'scheduled',
    });
    const groupMatchB = await Match.create({
      tournamentId: groups.id,
      homeClubEntryId: entries[2].id,
      awayClubEntryId: entries[3].id,
      homeName: entries[2].clubName,
      awayName: entries[3].clubName,
      matchDate: new Date('2025-07-02T12:00:00Z'),
      round: 1,
      groupName: 'B',
      stage: 'group',
      status: 'scheduled',
    });
    await service.recordOfficialResult({ matchId: groupMatchA.id, user: actor, payload: { scoreHome: 2, scoreAway: 0 } });
    const secondResult = await service.recordOfficialResult({ matchId: groupMatchB.id, user: actor, payload: { scoreHome: 1, scoreAway: 0 } });
    assert.equal(secondResult.advancement?.kind, 'group_knockout');
    assert.equal(secondResult.advancement?.entryMode, true);
    let knockout = await Match.findOne({ where: { tournamentId: groups.id, stage: 'knockout' } });
    assert.ok(knockout?.homeClubEntryId && knockout?.awayClubEntryId, 'manual club entries survive group qualification');
    const finalistEntryId = knockout.homeClubEntryId;
    const finalResult = await service.recordOfficialResult({ matchId: knockout.id, user: actor, payload: { scoreHome: 1, scoreAway: 0 } });
    assert.equal(finalResult.advancement?.championClubEntryId, finalistEntryId);
    assert.equal(finalResult.advancement?.championUserId, null, 'manual club champions do not expose synthetic IDs');

    const statsTournament = await createTournament(`Full tournament stats integration ${suffix}`);
    const [statsHome, statsAway] = await Promise.all([
      TournamentClubEntry.create({ tournamentId: statsTournament.id, clubName: 'Stats Home', groupName: 'A' }),
      TournamentClubEntry.create({ tournamentId: statsTournament.id, clubName: 'Stats Away', groupName: 'A' }),
    ]);
    const statsMatches = [];
    const homeScorerIdentity = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const awayScorerIdentity = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    for (let index = 0; index < 15; index += 1) {
      const homeScored = index < 13;
      const match = await Match.create({
        tournamentId: statsTournament.id,
        homeClubEntryId: statsHome.id,
        awayClubEntryId: statsAway.id,
        homeName: statsHome.clubName,
        awayName: statsAway.clubName,
        matchDate: new Date(Date.UTC(2025, 7, 1 + index)),
        round: index + 1,
        stage: 'league',
        status: 'finished',
        scoreHome: homeScored ? 1 : 0,
        scoreAway: homeScored ? 0 : 1,
      });
      statsMatches.push(match);
      await MatchScorer.create({
        matchId: match.id,
        athleteName: 'Same Name',
        athleteIdentityKey: homeScored ? homeScorerIdentity : awayScorerIdentity,
        goals: 1,
        side: homeScored ? 'home' : 'away',
      });
    }
    let responseCode = 200;
    let statsBody;
    const response = {
      status(code) { responseCode = code; return this; },
      json(body) { statsBody = body; return this; },
    };
    await tournamentController.getTournamentStats({ params: { id: statsTournament.id } }, response);
    assert.equal(responseCode, 200);
    assert.equal(statsBody.totalMatches, 15, 'summary count includes matches outside the latest-results window');
    assert.equal(statsBody.finishedMatches, 15);
    assert.equal(statsBody.totalGoals, 15);
    assert.equal(Number(statsBody.avgGoalsPerMatch), 1);
    assert.equal(statsBody.recentResults.length, 12, 'only the recent-results list is capped at twelve');
    assert.equal(statsBody.topScorerGoals, 13, 'same-name scorers on different clubs are not merged');
  } finally {
    if (tournamentIds.length) {
      await CompetitionAuditEvent.destroy({ where: { tournamentId: tournamentIds } });
      await Bracket.destroy({ where: { tournamentId: tournamentIds } });
      const matchesToClean = await Match.findAll({ where: { tournamentId: tournamentIds }, attributes: ['id'], raw: true });
      if (matchesToClean.length) await MatchScorer.destroy({ where: { matchId: { [Op.in]: matchesToClean.map((row) => row.id) } } });
      await Match.destroy({ where: { tournamentId: tournamentIds } });
      await TournamentClubEntry.destroy({ where: { tournamentId: tournamentIds } });
      await Tournament.destroy({ where: { id: tournamentIds } });
    }
    if (userIds.length) {
      await GuardianConsent.destroy({ where: { minorUserId: userIds } });
      await ClubMember.destroy({ where: { athleteId: userIds } });
      await ClubStaff.destroy({ where: { staffId: userIds, clubId: userIds } });
    }
    if (userIds.length) await User.destroy({ where: { id: userIds } });
    await sequelize.close();
  }
});
