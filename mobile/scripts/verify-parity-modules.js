/**
 * Static verification of parity feature modules (no device required).
 * Run: node scripts/verify-parity-modules.js
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const checks = [
  { file: 'src/api/client.js', must: ['startTournamentRequest', 'premiumCheckoutRequest', 'uploadStreamRecordingRequest', 'updateTournamentMatchScoreRequest'] },
  { file: 'src/screens/TournamentDetailScreen.js', must: ['onStartTournament', 'onSaveMatchScore', 'Nis turneun'] },
  { file: 'src/components/IncomingCallListener.js', must: ['call:incoming', 'navigateRoot', 'IncomingCall'] },
  { file: 'src/screens/IncomingCallScreen.js', must: ['embed-incoming-call', 'fp_embed_incoming_call'] },
  { file: 'src/components/SharePostPanel.js', must: ['sharePostFacebook', 'sharePostWhatsApp'] },
  { file: 'src/components/XPNotificationManager.js', must: ['subscribeXpNotifications', 'Level Up'] },
  { file: 'src/screens/PremiumScreen.js', must: ['premiumCheckoutRequest', 'onVerifyPayment'] },
  { file: 'src/screens/PublicProfileScreen.js', must: ['goLiveBtn', 'onGoLive'] },
  { file: 'src/screens/GoLiveScreen.js', must: ['uploadStreamRecordingRequest', 'Ngarko regjistrim'] },
  { file: 'src/navigation/AppNavigator.js', must: ['IncomingCall', 'GoLive', 'IncomingCallListener'] },
  { file: 'App.js', must: ['XPNotificationManager'] },
];

let failed = 0;

console.log('\nFootballPro Mobile — Parity module verification\n');

for (const { file, must } of checks) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.log(`FAIL  ${file} — missing file`);
    failed += 1;
    continue;
  }
  const src = fs.readFileSync(full, 'utf8');
  const missing = must.filter((s) => !src.includes(s));
  if (missing.length) {
    console.log(`FAIL  ${file} — missing: ${missing.join(', ')}`);
    failed += 1;
  } else {
    console.log(`PASS  ${file}`);
  }
}

// Frontend embed route (sibling repo)
const embedPath = path.join(root, '..', 'frontend', 'src', 'components', 'EmbedIncomingCall.jsx');
if (fs.existsSync(embedPath)) {
  const embed = fs.readFileSync(embedPath, 'utf8');
  if (embed.includes('fp_embed_incoming_call')) {
    console.log('PASS  frontend EmbedIncomingCall.jsx');
  } else {
    console.log('FAIL  frontend EmbedIncomingCall.jsx');
    failed += 1;
  }
} else {
  console.log('SKIP  frontend EmbedIncomingCall.jsx (not in workspace)');
}

const premiumRoute = path.join(root, '..', 'backend', 'routes', 'premium.js');
if (fs.existsSync(premiumRoute)) {
  const pr = fs.readFileSync(premiumRoute, 'utf8');
  if (pr.includes('/checkout') && pr.includes('/verify-session')) {
    console.log('PASS  backend routes/premium.js');
  } else {
    console.log('FAIL  backend routes/premium.js');
    failed += 1;
  }
} else {
  console.log('SKIP  backend premium routes');
}

console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll static checks passed.\n');
process.exit(failed ? 1 : 0);
