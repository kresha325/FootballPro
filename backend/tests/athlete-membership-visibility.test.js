'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { visibleAthleteMemberships } = require('../utils/athleteMembershipVisibility');

const memberships = [
  { id: 1, clubId: 10, athleteId: 50, status: 'approved' },
  { id: 2, clubId: 10, athleteId: 50, status: 'pending' },
  { id: 3, clubId: 20, athleteId: 50, status: 'rejected' },
];
const athlete = { id: 50, role: 'athlete' };
const verifiedClubs = [
  { id: 10, role: 'club', adminVerified: true },
  { id: 20, role: 'club', adminVerified: true },
];

describe('athlete membership object-level visibility', () => {
  it('keeps approved sports affiliations visible but hides pending and rejected state from other users', () => {
    const visible = visibleAthleteMemberships({ viewer: { id: 7, role: 'scout' }, athlete, memberships });
    assert.deepEqual(visible.map((row) => row.id), [1]);
  });

  it('allows only a verified club to see its own pending or rejected membership states', () => {
    const viewer = { id: 10, role: 'club' };
    const visible = visibleAthleteMemberships({ viewer, athlete, memberships, verifiedClubs });
    assert.deepEqual(visible.map((row) => row.id), [1, 2]);
    const unverified = visibleAthleteMemberships({
      viewer,
      athlete,
      memberships,
      verifiedClubs: [{ id: 10, role: 'club', adminVerified: false }],
    });
    assert.deepEqual(unverified.map((row) => row.id), [1]);
  });

  it('requires the active authorized coaching assignment for private roster states', () => {
    const viewer = { id: 30, role: 'coach' };
    const active = [{ clubId: 10, staffId: 30, status: 'active', staffRole: 'head_coach', contractUntil: '2027-01-01' }];
    assert.deepEqual(visibleAthleteMemberships({ viewer, athlete, memberships, verifiedClubs, staffAssignments: active }).map((row) => row.id), [1, 2]);
    const inactive = [{ ...active[0], status: 'inactive' }];
    assert.deepEqual(visibleAthleteMemberships({ viewer, athlete, memberships, verifiedClubs, staffAssignments: inactive }).map((row) => row.id), [1]);
    const nonCoachStaffRole = [{ ...active[0], staffRole: 'physiotherapist' }];
    assert.deepEqual(visibleAthleteMemberships({ viewer, athlete, memberships, verifiedClubs, staffAssignments: nonCoachStaffRole }).map((row) => row.id), [1]);
  });

  it('allows the athlete, linked verified guardian, and platform admin to see their own membership states', () => {
    assert.equal(visibleAthleteMemberships({ viewer: athlete, athlete, memberships }).length, 3);
    assert.equal(visibleAthleteMemberships({ viewer: { id: 8, role: 'athlete' }, athlete, memberships, verifiedGuardian: true }).length, 3);
    assert.equal(visibleAthleteMemberships({ viewer: { id: 9, role: 'admin' }, athlete, memberships }).length, 3);
  });
});
