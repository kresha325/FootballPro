const { execSync } = require('child_process');

const checks = [
  {
    name: 'Syntax check: navigation/api key files',
    cmd: 'node --check src/navigation/AppNavigator.js && node --check src/api/client.js && node --check src/screens/FeedScreen.js',
  },
  {
    name: 'Smoke checklist output',
    cmd: 'node scripts/smoke-checklist.js',
  },
];

console.log('\nFootballPro Mobile Release Preflight\n');

for (const check of checks) {
  process.stdout.write(`- ${check.name} ... `);
  try {
    execSync(check.cmd, { stdio: 'ignore' });
    console.log('PASS');
  } catch (err) {
    console.log('FAIL');
    console.error(`\nCommand failed: ${check.cmd}`);
    process.exit(1);
  }
}

console.log('\nPreflight completed successfully.\n');
