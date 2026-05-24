#!/usr/bin/env node
/**
 * Smoke test: register + profile API për çdo rol.
 * Usage: API_URL=https://footballpro.onrender.com node scripts/smoke-profiles-by-role.js
 */

const axios = require('axios');
const crypto = require('crypto');

const base = (process.env.API_URL || 'http://localhost:10000').replace(/\/$/, '');

const ROLES = [
  'athlete',
  'coach',
  'scout',
  'manager',
  'referee',
  'club',
  'federation',
  'media',
  'business',
];

const ROLE_EXPECTATIONS = {
  athlete: {
    ui: 'Matches, Achievements, Tournaments tabs; transfer history',
    extraGets: [
      (id) => `/api/profiles/${id}/tournament-summary`,
      (id) => `/api/transfer-history/user/${id}`,
    ],
  },
  coach: {
    ui: 'Overview + transfer history; coach affiliation fields',
    extraGets: [
      (id) => `/api/transfer-history/user/${id}`,
      (id) => `/api/club-staff/staff/${id}`,
    ],
  },
  scout: {
    ui: 'Scout overview; scouting recommendations (self)',
    extraGets: [() => '/api/scouting/recommendations'],
  },
  manager: {
    ui: 'Manager overview profile',
    extraGets: [],
  },
  referee: {
    ui: 'Referee overview profile',
    extraGets: [],
  },
  club: {
    ui: 'Club squad, members, staff sections',
    extraGets: [
      (id) => `/api/club-members/club/${id}`,
      (id) => `/api/club-roster/club/${id}`,
      (id) => `/api/club-staff/club/${id}`,
    ],
  },
  federation: {
    ui: 'Federation entity profile',
    extraGets: [],
  },
  media: {
    ui: 'Media entity profile (BusinessProfile UI)',
    extraGets: [],
  },
  business: {
    ui: 'Business entity profile',
    extraGets: [],
  },
};

async function req(method, path, body, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return axios({
    method,
    url: `${base}${path}`,
    data: body,
    headers,
    validateStatus: () => true,
    timeout: 30000,
  });
}

function statusOk(status) {
  return status >= 200 && status < 300;
}

async function registerRole(role) {
  const suffix = `${role}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const email = `smoke-profile-${suffix}@footballpro-smoke.invalid`;
  const password = `Smoke${crypto.randomBytes(4).toString('hex')}!9`;
  const res = await req('post', '/api/auth/register', {
    email,
    password,
    firstName: 'Smoke',
    lastName: role.charAt(0).toUpperCase() + role.slice(1),
    role,
    dateOfBirth: '1995-06-15',
    city: 'Prishtinë',
    country: 'Kosovë',
  });
  if (!statusOk(res.status) || !res.data?.token) {
    return { ok: false, error: `register ${res.status}: ${JSON.stringify(res.data).slice(0, 120)}` };
  }
  return {
    ok: true,
    token: res.data.token,
    userId: res.data.user?.id,
    email,
  };
}

async function testRole(role) {
  const row = {
    role,
    register: 'FAIL',
    getProfile: 'FAIL',
    updateProfile: 'SKIP',
    listByRole: 'SKIP',
    extras: [],
    notes: [],
  };

  const reg = await registerRole(role);
  if (!reg.ok) {
    row.notes.push(reg.error);
    return row;
  }
  row.register = 'PASS';
  const { token, userId } = reg;

  const profileRes = await req('get', `/api/profiles/${userId}`, null, token);
  if (statusOk(profileRes.status) && profileRes.data?.role === role) {
    row.getProfile = 'PASS';
    if (!profileRes.data?.firstName) row.notes.push('profile missing firstName');
    if (profileRes.data?.id == null && profileRes.data?.userId == null) {
      row.notes.push('profile missing id');
    }
  } else {
    row.notes.push(
      `GET profile ${profileRes.status} role=${profileRes.data?.role || '?'}`
    );
  }

  const updateRes = await req(
    'put',
    '/api/profiles/me',
    { bio: `Smoke test ${role}`, position: role === 'athlete' ? 'FW' : undefined },
    token
  );
  row.updateProfile = statusOk(updateRes.status) ? 'PASS' : `FAIL (${updateRes.status})`;

  const listRes = await req('get', `/api/profiles?role=${encodeURIComponent(role)}&limit=50`, null, token);
  if (statusOk(listRes.status) && Array.isArray(listRes.data)) {
    const found = listRes.data.some(
      (p) => String(p.id) === String(userId) || String(p.userId) === String(userId)
    );
    row.listByRole = found ? 'PASS' : 'WARN (not in first page)';
  } else {
    row.listByRole = `FAIL (${listRes.status})`;
  }

  const spec = ROLE_EXPECTATIONS[role] || { extraGets: [] };
  for (const buildPath of spec.extraGets) {
    const path = buildPath(userId);
    const label = path.split('?')[0];
    const r = await req('get', path, null, token);
    const ok = statusOk(r.status);
    row.extras.push({ path: label, status: ok ? 'PASS' : `FAIL ${r.status}` });
    if (!ok) {
      row.notes.push(`${label} → ${r.status}`);
    }
  }

  if (role === 'athlete') {
    const posts = await req('get', `/api/posts/user/${userId}`, null, token);
    row.extras.push({
      path: '/api/posts/user/:id',
      status: statusOk(posts.status) ? 'PASS' : `FAIL ${posts.status}`,
    });
  }

  return row;
}

async function main() {
  console.log(`\nFootballPro profile-by-role smoke — ${base}\n`);

  const results = [];
  for (const role of ROLES) {
    process.stdout.write(`Testing ${role}... `);
    const row = await testRole(role);
    results.push(row);
    const coreOk = row.register === 'PASS' && row.getProfile === 'PASS';
    console.log(coreOk ? 'OK' : 'ISSUES');
  }

  console.log('\n=== PËRMBLEDHJE SIPAS ROLIT ===\n');
  console.log(
    'Role'.padEnd(12),
    'Reg'.padEnd(6),
    'Profil'.padEnd(8),
    'Update'.padEnd(8),
    'Lista'.padEnd(10),
    'Extra API'
  );
  console.log('-'.repeat(72));

  for (const r of results) {
    const extras = r.extras.map((e) => `${e.path.split('/').pop()}:${e.status}`).join(', ') || '—';
    console.log(
      r.role.padEnd(12),
      r.register.padEnd(6),
      r.getProfile.padEnd(8),
      r.updateProfile.padEnd(8),
      r.listByRole.padEnd(10),
      extras.slice(0, 40)
    );
  }

  console.log('\n=== UI / FEATURES (mobile + web) ===\n');
  for (const role of ROLES) {
    const exp = ROLE_EXPECTATIONS[role];
    const r = results.find((x) => x.role === role);
    const state =
      r?.register === 'PASS' && r?.getProfile === 'PASS'
        ? '✅ API bazë OK'
        : '❌ API bazë dështoi';
    console.log(`${role.padEnd(12)} ${state}`);
    console.log(`             UI: ${exp?.ui || '—'}`);
    if (r?.notes?.length) {
      console.log(`             Shënime: ${r.notes.join('; ')}`);
    }
  }

  console.log('\n=== ROLET JO-REGJISTRUESHËM ===\n');
  console.log('liga    — nuk regjistrohet publikisht (vetëm admin/manual)');
  console.log('admin   — nuk regjistrohet publikisht\n');

  const failed = results.filter(
    (r) => r.register !== 'PASS' || r.getProfile !== 'PASS' || r.updateProfile === 'FAIL'
  ).length;

  console.log(failed ? `\n${failed} rol(e) me probleme kritike.\n` : '\nTë gjithë rolet regjistrueshëm: profili bazë OK.\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
