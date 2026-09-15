const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const easJson = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const expo = appJson.expo || {};

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

console.log('\nXTalenti Mobile Release Preflight\n');

// Bundle ID
const iosBundle = expo.ios?.bundleIdentifier;
const androidPkg = expo.android?.package;
if (iosBundle !== 'com.kresha325.xtalenti') fail(`Unexpected iOS bundleId: ${iosBundle}`);
if (androidPkg !== 'com.kresha325.xtalenti') fail(`Unexpected Android package: ${androidPkg}`);
console.log('- Bundle ID com.kresha325.xtalenti ... PASS');

// Version
if (!expo.version) fail('Missing expo.version');
console.log(`- Version ${expo.version} ... PASS`);

// Schemes
const schemes = Array.isArray(expo.scheme) ? expo.scheme : [expo.scheme];
if (!schemes.includes('xtalenti')) fail('Primary scheme xtalenti missing');
if (!schemes.includes('footballpro')) fail('Legacy scheme footballpro missing (compat)');
console.log('- Schemes xtalenti + footballpro ... PASS');

// Production API
const backend = expo.extra?.BACKEND_URL || '';
if (!/^https:\/\/footballpro\.onrender\.com\/?$/.test(backend)) {
  fail(`Unexpected production BACKEND_URL in app.json extra: ${backend}`);
}
const prodEnv = easJson.build?.production?.env?.BACKEND_URL || '';
if (!/^https:\/\/footballpro\.onrender\.com\/?$/.test(prodEnv)) {
  fail(`Unexpected EAS production BACKEND_URL: ${prodEnv}`);
}
console.log('- Production BACKEND_URL ... PASS');

// EAS autoIncrement
if (!easJson.build?.production?.autoIncrement) fail('production.autoIncrement missing');
if (easJson.cli?.appVersionSource !== 'remote') {
  fail('cli.appVersionSource should be remote with autoIncrement');
}
console.log('- EAS autoIncrement + remote appVersionSource ... PASS');

// IAP flag
if (expo.extra?.ALLOW_MOBILE_DIGITAL_PURCHASES !== true) {
  fail('ALLOW_MOBILE_DIGITAL_PURCHASES must be true for iOS digital goods');
}
console.log('- ALLOW_MOBILE_DIGITAL_PURCHASES ... PASS');

// Legal URLs exist in Settings
const settingsPath = path.join(root, 'src/screens/SettingsScreen.js');
const settingsSrc = fs.readFileSync(settingsPath, 'utf8');
if (!settingsSrc.includes('/privacy') || !settingsSrc.includes('/terms')) {
  fail('Settings missing privacy/terms URLs');
}
if (!settingsSrc.includes('deleteMyAccountRequest') && !settingsSrc.includes('Fshi llogarinë')) {
  fail('Account deletion UI missing from Settings');
}
console.log('- Privacy / Terms / Delete account UI ... PASS');

// Syntax checks
const syntaxFiles = [
  'src/navigation/AppNavigator.js',
  'src/api/client.js',
  'src/iap/purchase.js',
  'src/screens/PremiumScreen.js',
  'src/screens/FeedScreen.js',
  'app.config.js',
];
process.stdout.write('- Syntax check key files ... ');
try {
  for (const f of syntaxFiles) {
    execSync(`node --check ${f}`, { cwd: root, stdio: 'ignore' });
  }
  console.log('PASS');
} catch {
  fail('Syntax check failed');
}

process.stdout.write('- Smoke checklist script ... ');
try {
  execSync('node scripts/smoke-checklist.js', { cwd: root, stdio: 'ignore' });
  console.log('PASS');
} catch {
  fail('smoke-checklist failed');
}

console.log('\nPreflight completed successfully.\n');
console.log('Next: eas build --platform ios --profile production\n');
