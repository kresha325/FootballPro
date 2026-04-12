const checks = [
  'Login/Register: open app, login, logout, register flow completes.',
  'Feed: load posts, like/unlike, comments open/add, create post, gallery open.',
  'Messaging: conversations load, open conversation, send message.',
  'Notifications: list loads and mark-read paths work from More > Notifications.',
  'Marketplace: products load and create order action returns success.',
  'Wallet: balance loads, buy/withdraw/transfer requests return success/pending.',
  'Videos: videos list loads, upload video works, like action increments UI.',
  'Profile: my profile load, edit profile save, browse/public profile navigation.',
  'Insights: dashboard + gamification + leaderboard load without errors.',
  'Tournaments: list loads, join action works and refreshes state.',
  'Scouting: scout/club can access; non-scout roles see access restriction.',
  'Badges: Messages and More tab badges refresh on tab switch/focus.',
];

console.log('\nFootballPro Mobile Smoke Checklist\n');
checks.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item}`);
});
console.log('\nResult: Mark each item PASS/FAIL during QA run.\n');
