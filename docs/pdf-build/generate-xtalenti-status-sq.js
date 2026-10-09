/**
 * Gjeneron PDF statusi projekti në shqip për X TALENTI / FootballPro.
 * Run: node generate-xtalenti-status-sq.js
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OUT_DOCS = path.join(
  __dirname,
  '..',
  'X-TALENTI_Statusi_Projektit_Soll-Ist_Prodhim_SQ.pdf'
);
const OUT_ROOT = path.join(__dirname, '..', '..', 'X-TALENTI_Statusi_Projektit_SQ.pdf');

const FONT = '/System/Library/Fonts/Supplemental/Arial.ttf';
const FONT_BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const FONT_UNI = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';

const MARGIN = 48;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const DOC_DATE = '3 tetor 2026';
const DOC_VERSION = '2.0';

const COLORS = {
  ink: '#0f172a',
  muted: '#475569',
  gold: '#9A6B12',
  line: '#cbd5e1',
  soft: '#f8fafc',
  ok: '#166534',
  partial: '#a16207',
  missing: '#b91c1c',
  white: '#ffffff',
};

function ensureFonts(doc) {
  const regular = fs.existsSync(FONT) ? FONT : FONT_UNI;
  const bold = fs.existsSync(FONT_BOLD) ? FONT_BOLD : regular;
  doc.registerFont('Body', regular);
  doc.registerFont('Bold', bold);
}

function drawFooter(doc, pageNum) {
  const y = PAGE_H - 32;
  doc.save();
  doc.font('Body').fontSize(8).fillColor(COLORS.muted);
  doc.text(`X TALENTI / FootballPro — Konfidencial — ${DOC_DATE}`, MARGIN, y, {
    width: CONTENT_W * 0.72,
    align: 'left',
  });
  doc.text(`Faqe ${pageNum}`, MARGIN, y, { width: CONTENT_W, align: 'right' });
  doc.restore();
}

function h1(doc, text) {
  doc.moveDown(0.4);
  doc.font('Bold').fontSize(17).fillColor(COLORS.ink).text(text, { width: CONTENT_W });
  doc.moveDown(0.25);
  doc
    .strokeColor(COLORS.gold)
    .lineWidth(2)
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + 80, doc.y)
    .stroke();
  doc.moveDown(0.5);
}

function h2(doc, text) {
  ensureSpace(doc, 48);
  doc.moveDown(0.35);
  doc.font('Bold').fontSize(12.5).fillColor(COLORS.ink).text(text, { width: CONTENT_W });
  doc.moveDown(0.25);
}

function para(doc, text) {
  ensureSpace(doc, 40);
  doc.font('Body').fontSize(9.5).fillColor(COLORS.ink).text(text, {
    width: CONTENT_W,
    align: 'justify',
    lineGap: 1.5,
  });
  doc.moveDown(0.35);
}

function bullet(doc, text, indent = 12) {
  ensureSpace(doc, 28);
  doc.font('Body').fontSize(9.5).fillColor(COLORS.ink);
  doc.text(`•  ${text}`, MARGIN + indent, doc.y, { width: CONTENT_W - indent, lineGap: 1.2 });
  doc.moveDown(0.15);
}

function ensureSpace(doc, need) {
  if (doc.y + need > PAGE_H - 50) doc.addPage();
}

function statusColor(s) {
  const t = String(s || '').toLowerCase();
  if (t.includes('mungon') || t.includes('blocker') || t.includes('jo ') || t.includes('kritike'))
    return COLORS.missing;
  if (t.includes('pjesë') || t.includes('pjese') || t.includes('demo') || t.includes('ops') || t.includes('përgatit') || t.includes('pergatit'))
    return COLORS.partial;
  if (t.includes('po') || t.includes('ok') || t.includes('gati') || t.includes('plotë') || t.includes('plot'))
    return COLORS.ok;
  return COLORS.ink;
}

function drawTable(doc, headers, rows, colWidths) {
  const startX = MARGIN;
  const pad = 4;
  const fontSize = 7.5;
  const headerH = 22;

  function rowHeight(cells) {
    let maxH = 16;
    cells.forEach((c, i) => {
      const h = doc.heightOfString(String(c ?? ''), {
        width: colWidths[i] - pad * 2,
        fontSize,
      });
      maxH = Math.max(maxH, h + pad * 2);
    });
    return Math.min(maxH, 78);
  }

  ensureSpace(doc, headerH + 30);
  let x = startX;
  let y = doc.y;
  doc.save();
  doc.rect(startX, y, CONTENT_W, headerH).fill(COLORS.ink);
  doc.fillColor(COLORS.white).font('Bold').fontSize(7.5);
  headers.forEach((h, i) => {
    doc.text(h, x + pad, y + 6, { width: colWidths[i] - pad * 2 });
    x += colWidths[i];
  });
  doc.restore();
  y += headerH;

  rows.forEach((row, ri) => {
    const rh = rowHeight(row);
    if (y + rh > PAGE_H - 50) {
      doc.y = y;
      doc.addPage();
      y = MARGIN;
      x = startX;
      doc.save();
      doc.rect(startX, y, CONTENT_W, headerH).fill(COLORS.ink);
      doc.fillColor(COLORS.white).font('Bold').fontSize(7.5);
      headers.forEach((h, i) => {
        doc.text(h, x + pad, y + 6, { width: colWidths[i] - pad * 2 });
        x += colWidths[i];
      });
      doc.restore();
      y += headerH;
    }
    if (ri % 2 === 0) {
      doc.save();
      doc.rect(startX, y, CONTENT_W, rh).fill(COLORS.soft);
      doc.restore();
    }
    doc.strokeColor(COLORS.line).lineWidth(0.4).rect(startX, y, CONTENT_W, rh).stroke();
    x = startX;
    row.forEach((cell, i) => {
      doc
        .font(i === 0 ? 'Bold' : 'Body')
        .fontSize(fontSize)
        .fillColor(i > 0 ? statusColor(cell) : COLORS.ink)
        .text(String(cell ?? ''), x + pad, y + pad, {
          width: colWidths[i] - pad * 2,
          height: rh - pad,
        });
      x += colWidths[i];
    });
    y += rh;
  });
  doc.y = y + 8;
}

function slide(doc, title, subtitle, lines) {
  ensureSpace(doc, 110);
  doc.moveDown(0.15);
  doc.roundedRect(MARGIN, doc.y, CONTENT_W, 6, 2).fill(COLORS.gold);
  doc.moveDown(0.65);
  doc.font('Bold').fontSize(13).fillColor(COLORS.ink).text(title, { width: CONTENT_W });
  if (subtitle) {
    doc.moveDown(0.12);
    doc.font('Body').fontSize(9.5).fillColor(COLORS.muted).text(subtitle, { width: CONTENT_W });
  }
  doc.moveDown(0.28);
  lines.forEach((l) => bullet(doc, l, 8));
  doc.moveDown(0.25);
}

async function main() {
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: 'X TALENTI — Statusi i projektit, Soll/Ist dhe gatishmëria për prodhim',
      Author: 'X TALENTI / FootballPro',
      Subject: 'Dokument i plotë në shqip: pitch, matrice features, OAuth, blockerët para Go-Live',
      Keywords: 'X TALENTI, FootballPro, Soll-Ist, Prodhim, OAuth',
    },
  });

  ensureFonts(doc);
  const stream = fs.createWriteStream(OUT_DOCS);
  doc.pipe(stream);

  // COVER
  doc.rect(0, 0, PAGE_W, 230).fill(COLORS.ink);
  doc.fillColor(COLORS.gold).font('Bold').fontSize(12).text('X TALENTI', MARGIN, 48);
  doc
    .fillColor(COLORS.white)
    .font('Bold')
    .fontSize(22)
    .text('Statusi i projektit,\nSoll / Ist &\nGatishmëria për prodhim', MARGIN, 72, { width: CONTENT_W });
  doc
    .font('Body')
    .fontSize(10.5)
    .fillColor('#cbd5e1')
    .text(
      'Mini Pitch · Vizoni · Matrica e features Web/Mobile · OAuth & Ops · Çfarë mungon para Go-Live',
      MARGIN,
      165,
      { width: CONTENT_W }
    );
  doc
    .font('Body')
    .fontSize(9)
    .fillColor('#94a3b8')
    .text(`Versioni ${DOC_VERSION}  ·  ${DOC_DATE}  ·  I brendshëm / Konfidencial  ·  Gjuha: Shqip`, MARGIN, 195);

  doc.y = 250;
  para(
    doc,
    'Ky dokument përshkruan produktin X TALENTI (teknikisht dhe historikisht edhe FootballPro / JonSport): gjendjen e synuar (Soll), gjendjen aktuale (Ist), një matricë të detajuar të features, si dhe boshllëqet, rreziqet dhe detyrat kryesore para lansimit në prodhim (Web, Backend dhe App Stores).'
  );
  para(
    doc,
    'Burimet: repository footballpro, README / PROJECT_STATUS, auditët mobile/store, ~66 module backend, Web (React/Vite në xtalenti.com), Mobile (Expo SDK 53), dhe statusi aktual i OAuth (Google / Facebook / Apple), LiveKit dhe Payments (tetor 2026).'
  );

  // 1 PITCH
  h1(doc, '1. Mini Pitch Deck — Përmbledhje');

  slide(doc, 'Slajdi 1 — Problemi', 'Pse ekziston X TALENTI?', [
    'Talenti në futboll është i fragmentuar: lojtarë, trajnerë, skautë, klube, agjentë, media dhe federata punojnë në kanale të izoluara (WhatsApp, Instagram, Transfermarkt, Excel).',
    'Talentet e rinj — sidomos nga tregje emergjente dhe amator/i ri — rrallë kanë një dosje digjitale të verifikueshme karriere.',
    'Skautët dhe klubet humbasin kohë në kërkim, verifikim dhe kontakt; lojtarët humbasin dukshmëri dhe dëshmi (ndeshje, gola, transfere).',
    'Mungon një platformë e besueshme që lidh Social Discovery, të dhëna performance, turne, transfere dhe komunikim profesional.',
  ]);

  slide(doc, 'Slajdi 2 — Zgjidhja', 'Çfarë është X TALENTI?', [
    'X TALENTI është platformë globale talenti dhe ekosistemi futbolli: „LinkedIn + Instagram + Transfermarkt + Hudl“ për futbollin.',
    'Modele llogarie me profile sipas rolit (atlet, trajner, skaut, klub, menaxher, arbitër, federatë, ligë, media, business, admin).',
    'Feed social, messaging, live-streaming, video-calls, turne, rekomandime skouting, gamification dhe histori digjitale karriere/transfere.',
    'Web + app native (Expo / React Native) mbi një backend të përbashkët Node.js/PostgreSQL.',
  ]);

  slide(doc, 'Slajdi 3 — Vizoni (Soll)', 'Çfarë duhet të jetë platforma?', [
    'Identiteti standard i çdo aktori futbolli: profil i verifikuar, CV, media, stats dhe rrjet.',
    'Treg për dukshmëri dhe rrugë karriere: nga i riu deri te semi-pro, nga skauti te recruiting i klubit.',
    'Mjet operacional për klube/liga: roster, staf, turne, raporte ndeshjesh, scorers, standings.',
    'Monetizim me Premium, monedhë virtuale (XCoin/JonCoin), marketplace dhe donacione live — në përputhje me Store (IAP) dhe Stripe në web.',
    'Marka jashtë: X TALENTI (xtalenti.com); brenda/tech: FootballPro.',
  ]);

  slide(doc, 'Slajdi 4 — Gjendja aktuale (Ist)', 'Çfarë është ndërtuar sot?', [
    'Bërthamë e pasur 1.0: Auth (email + social), profile/CV, feed, chat, turne, scouting, gamification, admin, sponsors/ads, JonCoin marketplace (pa Stripe live), LiveKit live & calls.',
    'App mobile „X TALENTI“ v1.0.0 (Expo 53), push client, report/block, fshirje llogarie, IAP në kod, soft-parity me web (CV, Legal, Streams, Group Call, Insights, Admin Media, OAuth UI).',
    'Backend në Render (footballpro.onrender.com), frontend GitHub Pages → xtalenti.com, media Cloudinary, realtime Socket.IO + LiveKit.',
    'Facebook Login funksionon teknikisht (SPA OAuth relay); Meta shpesh ende Unreleased → vetëm testerë. Email scope opsional. Pagesat shpesh ende demo/guard.',
  ]);

  slide(doc, 'Slajdi 5 — Audienca', null, [
    'Atletë (i ri & amator deri semi-pro): dukshmëri, CV, highlights, stats turnesh, histori transferesh.',
    'Skautë & menaxherë: kërkim, rekomandime, kontakt, insights.',
    'Klube & trajnerë: roster, staf, turne, squad, konfirmim transferesh.',
    'Federata/liga/media/business: profile organizative, content, sponsoring.',
    'Prindër (U18): flow parent-verification.',
  ]);

  slide(doc, 'Slajdi 6 — Modeli i biznesit', null, [
    'Free: profil bazë & social.',
    'Premium (web demo / mobile IAP planifikuar): analytics, prioritet, themes.',
    'XCoin/JonCoin: monedhë për marketplace dhe pack-e digjitale (IAP).',
    'Marketplace: produkte/porosi — kujdes me Store compliance.',
    'Perspektivë: live donations, sponsors/ads, seat për federata/klube.',
  ]);

  slide(doc, 'Slajdi 7 — Konkurrenca', null, [
    'Transfermarkt: të dhëna/treg — pak social/live/messaging për talente.',
    'Instagram/TikTok: reach — pa dosje karriere futbolli, pa governance klubi.',
    'Hudl/Veo: video analizë — pa rrjet talenti dhe pa proces transferi.',
    'X TALENTI kombinon identitet + social + ops (klube/turne) + live + scouting në një llogari.',
  ]);

  slide(doc, 'Slajdi 8 — Teknologjia', null, [
    'API: Express + Sequelize + PostgreSQL në Render.',
    'Web: React 19 / Vite / Tailwind → GitHub Pages (CNAME xtalenti.com).',
    'Mobile: Expo 53, LiveKit Native, expo-notifications, expo-iap.',
    'OAuth: Passport Google/Facebook/Apple; redirect përmes SPA domain.',
    'A/V: LiveKit; uploads: Cloudinary.',
  ]);

  slide(doc, 'Slajdi 9 — Delivery', null, [
    'Zhvillim shumëvjeçar; PROJECT_STATUS: feature-complete core (~9/10 për bërthamën).',
    '~66 module backend, 50+ modele Sequelize, ~46 ekrane mobile, web routes të gjera.',
    'Dokumentacion TestFlight/Play ekziston; matrica pajisjesh dhe asset-et e store ende hapur.',
    'Tetor 2026: Facebook OAuth relay + auto-create profili për social login.',
  ]);

  slide(doc, 'Slajdi 10 — Hapat e ardhshëm', 'Para Go-Live', [
    'EAS Production Builds + TestFlight / Play Internal + QA pa crash.',
    'Produkte IAP në App Store Connect & Google Play + sandbox.',
    'Meta App Review → Live; Google/Apple Console të finalizuara.',
    'FACEBOOK_REQUEST_EMAIL=1 pas lejes email; pastrim llogarish duplicate.',
    'Migrime prod, Push (APNs/FCM), review legal, vendim për PAYMENTS_ENABLED.',
  ]);

  // 2 IDENTITY
  h1(doc, '2. Identiteti i produktit & arkitektura');

  h2(doc, '2.1 Markat');
  para(
    doc,
    'Ka disa shtresa emrash. Për komunikim me stakeholderë: jashtë X TALENTI; repo dhe shumë hoste serveri mbeten FootballPro.'
  );
  drawTable(
    doc,
    ['Marka', 'Përdorimi'],
    [
      ['X TALENTI / xtalenti', 'Emri i app, domain xtalenti.com, UI, IAP bundle, support'],
      ['FootballPro', 'Repo, Render host footballpro.onrender.com, deep-link legacy'],
      ['JonSport', 'Emër historik backend (jonsport-backend)'],
      ['XCoin / JonCoin', 'UI shpesh XCoin; API/DB joncoin'],
    ],
    [150, CONTENT_W - 150]
  );

  h2(doc, '2.2 Hosting & domain (Ist)');
  drawTable(
    doc,
    ['Shtresa', 'URL / Host', 'Shënim'],
    [
      ['Web SPA', 'https://xtalenti.com', 'GitHub Pages + CNAME'],
      ['API', 'https://footballpro.onrender.com', 'Render'],
      ['OAuth Relay FB/Google', 'xtalenti.com/auth/{provider}/callback', 'SPA → API'],
      ['Apple Callback', 'API /api/auth/apple/callback', 'HTTPS POST'],
      ['Media', 'Cloudinary', 'Uploads / galeri'],
      ['Realtime A/V', 'LiveKit', 'Token via /api/livekit'],
    ],
    [130, 180, CONTENT_W - 310]
  );

  h2(doc, '2.3 Stack (Ist)');
  bullet(doc, 'Backend: Node.js, Express, PostgreSQL, Sequelize, JWT/Passport, Socket.IO, Cloudinary, Stripe (guarded), Nodemailer, LiveKit.');
  bullet(doc, 'Web: React 19, Vite, Tailwind, React Router, Axios.');
  bullet(doc, 'Mobile: React Native / Expo 53, LiveKit Native, expo-notifications, expo-iap.');
  bullet(doc, 'CI: GitHub Actions për frontend; Backend auto-deploy nga main në Render.');

  h2(doc, '2.4 Rolet');
  para(
    doc,
    'Users.role: athlete, coach, scout, manager, referee, club, federation, liga, media, business, admin. Regjistrimi publik lejon të gjitha përveç liga dhe admin.'
  );

  // 3 SOLL IST
  h1(doc, '3. Soll kundrejt Ist — krahasim strategjik');

  h2(doc, '3.1 Soll (çfarë duhet të jetë)');
  bullet(doc, 'Shtëpia digjitale qendrore për talentet e futbollit dhe të gjithë stakeholderët.');
  bullet(doc, 'Paritet i plotë Web ↔ Mobile për flow-et kryesore.');
  bullet(doc, 'Shtresa besimi: verifikim, moderim, fshirje llogarie, pagesa të ligjshme.');
  bullet(doc, 'Dëshmi performance: turne, scorers, standings, CV, karrierë klubi, dual-confirm transferesh.');
  bullet(doc, 'Live & calls stabile në pajisje reale; social login për të gjithë (jo vetëm testerë).');
  bullet(doc, 'Monetizim live pa rejection Store; ops i shkallëzueshëm (migrime, monitoring, backup).');

  h2(doc, '3.2 Ist (çfarë është sot)');
  bullet(doc, 'Platformë full-stack gati feature-complete (Web + Mobile + API).');
  bullet(doc, 'Social, profile/CV, chat, turne, scouting, gamification, admin, sponsors/ads, soft-parity A–C kryesisht të dorëzuara.');
  bullet(doc, 'OAuth Google/Facebook/Apple në kod; Facebook teknikisht OK, Meta shpesh Development/Unreleased.');
  bullet(doc, 'OAuth tani krijon automatikisht Profile; pa email scope mund të krijohen llogari placeholder.');
  bullet(doc, 'Pagesat shpesh off/demo; IAP i përgatitur në kod, jo plotësisht në Store.');
  bullet(doc, 'Lansimi në Store organizativisht ende jo READY (builds, assets, IAP, privacy forms, QA pajisjesh).');

  h2(doc, '3.3 Përfundim i shkurtër');
  para(
    doc,
    'Soll: ekosistem global karriere futbolli me monetizim të përshtatshëm për Store. Ist: platformë 1.0 e fortë — blockerët e Go-Live janë kryesisht Store compliance, Meta Live Login, pagesat, QA pajisjesh dhe ops, jo mungesa e produktit bazë.'
  );

  // 4 MATRIX
  h1(doc, '4. Matrica e features: Soll | Ist Web | Ist Mobile | Shënim');

  para(
    doc,
    'Legjenda: „Po“ = Soll i përmbushur; „Pjesërisht“ = ekziston me kufizime/Ops; „Mungon“ = jo gati për prodhim. Ngjyrat: jeshile ≈ OK, portokalli ≈ pjesërisht, e kuqe ≈ mungon/kritike.'
  );

  const featureRows = [
    ['Auth email/fjalëkalim + JWT', 'Po', 'Po', 'Po', 'Regjistro, hyr, harrova'],
    ['Google OAuth', 'Po', 'Po (Ops)', 'Po (Ops)', 'SPA-relay; Console redirects'],
    ['Facebook OAuth', 'Po', 'Po (Ops)', 'Po (Ops)', 'Relay xtalenti.com; Meta Review'],
    ['Apple Sign In', 'Po', 'Po (Ops)', 'Po (Ops)', 'Services ID + keys + callback'],
    ['OAuth → profil shell', 'Po', 'Po', 'Po', 'ensureOAuthProfile + self-heal'],
    ['Onboarding pas regjistrimit/OAuth', 'Po', 'Po', 'Po', 'Qytet/shtet/bio'],
    ['Profile sipas rolit + edit', 'Po', 'Po', 'Po', 'Athlete/Coach/Scout/Club/…'],
    ['Profil publik + Follow', 'Po', 'Po', 'Po', ''],
    ['Public CV / Share / OG', 'Po', 'Po', 'Po', 'Web + Mobile'],
    ['Media profili / Gallery', 'Po', 'Po', 'Po', 'Cloudinary'],
    ['Timeline karriere', 'Po', 'Po', 'Po', 'Nga transferet e konfirmuara'],
    ['Transfer + Dual-Confirm', 'Po', 'Po', 'Po', 'Të dy klubet konfirmojnë'],
    ['Parent Verification U18', 'Po', 'Po', 'Po', ''],
    ['Faqe legale', 'Po', 'Po', 'Po', 'Privacy/Terms; review legal hapur'],
    ['Social Feed', 'Po', 'Po', 'Po', 'Postime/likes/komente'],
    ['Feed Pager (Web)', 'Pjesërisht', 'Po', 'n/a', 'Parity C3'],
    ['Kërkim / Trending', 'Po', 'Po', 'Po', ''],
    ['Messaging 1:1', 'Po', 'Po', 'Po', 'Socket'],
    ['Njoftime in-app', 'Po', 'Po', 'Po', ''],
    ['Push Notifications', 'Po', 'n/a', 'Pjesërisht', 'Klient OK; APNs/FCM + EAS'],
    ['Report / Block / Ban', 'Po', 'Po', 'Po', 'Moderim'],
    ['Fshirje llogarie', 'Po', 'Po', 'Po', 'Soft anonymize'],
    ['Video Calls 1:1 (LiveKit)', 'Po', 'Po', 'Pjesërisht', 'Matrica pajisjesh hapur'],
    ['Group LiveKit Call', 'Po', 'Po', 'Po', 'Parity B1'],
    ['Go Live / Viewer', 'Po', 'Po', 'Po', 'YouTube paralel; flip kamerë native mungon'],
    ['Live Chat / Reactions', 'Po', 'Po', 'Po', ''],
    ['Live Donations', 'Pjesërisht', 'Pjesërisht', 'Pjesërisht', 'Varet nga payments'],
    ['RTMP/OBS Ingest', 'Opsional', 'Mungon', 'Mungon', 'Jo në Render'],
    ['Turne / Bracket / Standings', 'Po', 'Po', 'Po', ''],
    ['Match Scorer', 'Po', 'Po', 'Po', ''],
    ['Club Roster / Staff', 'Po', 'Po', 'Po', ''],
    ['National Teams', 'Po', 'Pjesërisht', 'Pjesërisht', 'API më i fortë se UI'],
    ['Scouting + AI', 'Po', 'Po', 'Po', ''],
    ['Gamification XP/Badges', 'Po', 'Po', 'Po', ''],
    ['Analytics / Insights', 'Po', 'Po', 'Po', 'Parity B2'],
    ['Sponsors Hub', 'Po', 'Po', 'Po', 'Parity A4'],
    ['Ads', 'Po', 'Po', 'Po', ''],
    ['Admin Dashboard', 'Po', 'Po', 'Pjesërisht', 'Mobile: Media etj.'],
    ['Support Chat', 'Po', 'Po', 'Po', ''],
    ['Marketplace / Orders (JonCoin)', 'Po', 'Po', 'Po', ''],
    ['Stripe Live Payments', 'Po', 'Jo/Demo', 'Jo', 'PAYMENTS_ENABLED default false'],
    ['Premium', 'Po', 'Demo', 'IAP përgatitur', 'SKU Store mungojnë'],
    ['Coin Packs IAP', 'Po', 'n/a', 'IAP përgatitur', 'Sandbox mungon'],
    ['i18n DE/EN/AL', 'Pjesërisht', 'Pjesërisht', 'Pjesërisht', 'UI shpesh AL/EN'],
    ['E2E automatizuar', 'Po', 'Mungon', 'Mungon', 'Smoke scripts'],
    ['Observability', 'Po', 'Pjesërisht', 'Pjesërisht', 'Thellim para prod'],
  ];

  drawTable(
    doc,
    ['Feature', 'Soll', 'Ist Web', 'Ist Mobile', 'Shënim'],
    featureRows,
    [128, 52, 68, 72, CONTENT_W - 128 - 52 - 68 - 72]
  );

  // 5 OAUTH
  h1(doc, '5. Autentifikimi & OAuth — status Ops (tetor 2026)');

  h2(doc, '5.1 Arkitektura e social login');
  para(
    doc,
    'Google dhe Facebook përdorin SPA-relay: redirect në https://xtalenti.com/auth/{provider}/callback. SPA (OAuthCodeRelay) dërgon code/state te API në Render. Kështu redirect_uri mbetet në domain-in e verifikuar xtalenti.com. Apple përdor form_post direkt te callback i backend.'
  );

  h2(doc, '5.2 Checklist Meta / Facebook');
  drawTable(
    doc,
    ['Cilësimi', 'Vlera Soll', 'Ist / Shënim'],
    [
      ['Valid OAuth Redirect URIs', 'https://xtalenti.com/auth/facebook/callback', 'Duhet match i saktë'],
      ['Client OAuth Login', 'Yes', 'I detyrueshëm'],
      ['Web OAuth Login', 'Yes', 'I detyrueshëm'],
      ['Native/Desktop App', 'No', 'Yes prish Web OAuth'],
      ['App Domains', 'xtalenti.com', 'Vetëm domain i vet'],
      ['email Permission', 'Add + Ready for testing', 'Preparing for test = OK për Dev'],
      ['FACEBOOK_REQUEST_EMAIL', '1 në Render pas Add', 'Përndryshe vetëm public_profile'],
      ['Statusi i app', 'Live / Released', 'Shpesh Unreleased → vetëm testerë'],
      ['FRONTEND_URL', 'https://xtalenti.com', 'Mos e fshi'],
    ],
    [150, 170, CONTENT_W - 320]
  );

  h2(doc, '5.3 Rreziqe të njohura OAuth');
  bullet(doc, 'Pa email scope krijohen llogari fb_<id>@users.xtalenti.local — paralel me llogari ekzistuese email.');
  bullet(doc, 'Merge: kur vjen email real dhe gjen user ekzistues, facebookId zhvendoset; placeholder mund të mbetet orphan.');
  bullet(doc, 'Profili mungonte te OAuth → 404; u rregullua me ensureOAuthProfile + self-heal.');
  bullet(doc, 'Google/Apple: redirect URI dhe secrets duhet të përputhen me FRONTEND_URL / BACKEND_PUBLIC_URL.');

  // 6 DOMAIN
  h1(doc, '6. Detaje sipas domenit (Soll/Ist)');

  h2(doc, '6.1 Identitet, trust & compliance');
  para(
    doc,
    'Soll: role të qarta, parent-verification U18, report/block, fshirje, ban. Ist: i implementuar. Hapësirë: finalizim legal dhe formularë privacy Store; Meta App Review për Facebook publik.'
  );

  h2(doc, '6.2 Karriera, transferet & CV');
  para(
    doc,
    'Soll: CV me ndeshje reale; karriera e të gjitha klubeve; ndryshim klubi vetëm pas dual-confirm. Ist: recent matches, status pending/confirmed/rejected, stints mbyllen (nuk fshihen). Rrezik: histori e vjetër e fshirë nuk rikuperohet. Migrimi dual-confirm në prod duhet verifikuar.'
  );

  h2(doc, '6.3 Turne & klube');
  para(
    doc,
    'Soll: bashkim, squad, ndeshje, scorers, standings. Ist: i gjerë. Hapësirë: trajnim adminësh klubi, cilësia e të dhënave në realitet.'
  );

  h2(doc, '6.4 Live & komunikim');
  para(
    doc,
    'Soll: calls dhe Go-Live stabile. Ist: LiveKit web/mobile, group call, messaging. Hapësirë: matrica pajisjesh, flip kamerë native, push për call/live, konsolidim API stream të dyfishta.'
  );

  h2(doc, '6.5 Monetizim & sponsoring');
  para(
    doc,
    'Soll: Free/Premium, coins, marketplace, sponsors/ads pa rejection. Ist: JonCoin orders; Stripe guarded; Premium demo; IAP në kod; SponsorsAdsHub. Blocker: produkte ASC/Play + sandbox; politika PAYMENTS_ENABLED.'
  );

  h2(doc, '6.6 Soft parity Web↔Mobile (A–C)');
  para(
    doc,
    'Dorëzuar: A1 Public CV Mobile, A2 Legal, A3 Streams, A4 Sponsors Hub; B1 Group Call Web, B2 Insights; C1 OAuth UI, C2 Admin Media Mobile, C3 Feed Pager. Mbetet kryesisht Ops/QA, jo mungesa e features.'
  );

  // 7 BLOCKERS
  h1(doc, '7. Çfarë mungon & issues para prodhimit');

  h2(doc, '7.1 Blockerë (para Store / Prod publik)');
  drawTable(
    doc,
    ['ID', 'Tema', 'Pse kritike', 'Veprim'],
    [
      ['B1', 'EAS Production Builds', 'Pa build të firmosur → jo TestFlight/Play', 'eas build iOS+Android production'],
      ['B2', 'QA pajisjesh pa crash', 'Store Review & trust', 'Matrix Auth/Feed/Live/Call/Report/Delete/IAP'],
      ['B3', 'IAP + Sandbox', 'Rejection për mallra digjitale', 'SKU + blerje verifikim'],
      ['B4', 'Push Credentials', 'Njoftime të vdekura në device', 'APNs + FCM në EAS'],
      ['B5', 'Migrime Prod', 'Schema drift → gabime runtime', 'UGC/IAP/Transfer-Confirm apply'],
      ['B6', 'Formulare Store Console', 'Submission incomplete', 'Privacy, Data Safety, Age, Screenshots'],
      ['B7', 'Politika e pagesave', 'Demo vs Live', 'PAYMENTS_ENABLED pas Legal/Finance'],
      ['B8', 'Meta App Live + Review', 'FB Login vetëm për testerë', 'App Review / Release; email'],
      ['B9', 'OAuth Env & Consoles', 'Login prishet në prod', 'FRONTEND_URL, redirects, secrets'],
      ['B10', 'Userë OAuth duplicate', 'Dy llogari / profil bosh', 'Email scope + merge/cleanup'],
    ],
    [32, 105, 145, CONTENT_W - 32 - 105 - 145]
  );

  h2(doc, '7.2 Paralajmërime (jo gjithmonë stop për launch)');
  bullet(doc, 'LiveKit në pajisje fizike jo final sign-off.');
  bullet(doc, 'Google Play IAP verify (service account) TODO.');
  bullet(doc, 'Tekste legale starter — review legal.');
  bullet(doc, 'API live të dyfishta për t’u konsoliduar.');
  bullet(doc, 'RTMP/OBS vetëm nëse strategjia është OBS-first.');
  bullet(doc, 'i18n i përzier (AL/EN dominant).');
  bullet(doc, 'Email deliverability: ESP transaksional në vend të Gmail të pastër.');
  bullet(doc, 'Monitoring/alerting + drill backup-restore.');
  bullet(doc, 'Rate limits Auth/Upload/Messaging.');
  bullet(doc, 'Komunikim i jashtëm vetëm „X TALENTI“.');

  h2(doc, '7.3 Checklist Env Backend (pjesë)');
  drawTable(
    doc,
    ['Variabla', 'Qëllimi', 'Prod'],
    [
      ['DATABASE_URL', 'PostgreSQL', 'E detyrueshme'],
      ['JWT_SECRET', 'Nënshkrim token', 'E detyrueshme'],
      ['FRONTEND_URL', 'CORS + bazë OAuth', 'https://xtalenti.com'],
      ['BACKEND_PUBLIC_URL', 'Host Apple callback', 'E detyrueshme'],
      ['CLOUDINARY_*', 'Media', 'E detyrueshme'],
      ['LIVEKIT_*', 'A/V', 'Për Live/Calls'],
      ['EMAIL_*', 'Email transaksional', 'E detyrueshme'],
      ['GOOGLE_CLIENT_*', 'Google OAuth', 'nëse Social on'],
      ['FACEBOOK_APP_*', 'Facebook OAuth', 'nëse Social on'],
      ['FACEBOOK_REQUEST_EMAIL', 'Scope email', '1 pas Meta Add'],
      ['APPLE_*', 'Sign in with Apple', 'nëse Social on'],
      ['PAYMENTS_ENABLED', 'Stripe Live', 'false deri Go'],
      ['STRIPE_* / IAP Secrets', 'Pagesa', 'kur on'],
    ],
    [175, 175, CONTENT_W - 350]
  );

  h2(doc, '7.4 Checklist deploy Web/API');
  bullet(doc, 'main → Render Live; migrime; smoke API.');
  bullet(doc, 'Frontend GH Pages me VITE_API_URL; spa-github-pages përfshin auth/*/callback.');
  bullet(doc, 'CORS lejon xtalenti.com.');
  bullet(doc, 'GET /api/auth/providers sipas Env.');
  bullet(doc, 'Test manual: email login, FB/Google (tester), profil (jo 404), feed, chat.');

  h2(doc, '7.5 Checklist Mobile Store');
  bullet(doc, 'Icon, screenshots, descriptions, feature graphic.');
  bullet(doc, 'Privacy/Terms/Guidelines URL të arritshme.');
  bullet(doc, 'Fshirje llogarie + Report/Block të dëshmueshme.');
  bullet(doc, 'Permission strings kamera/mic/foto.');
  bullet(doc, 'IAP + billing compliance; Internal Testing → Production.');

  h2(doc, '7.6 Rendi i rekomanduar deri Go-Live');
  para(
    doc,
    '1) Migrime DB & smoke backend. 2) Meta Live + FACEBOOK_REQUEST_EMAIL + Google/Apple Console. 3) Formulare legal/privacy. 4) Katalog IAP + secrets. 5) EAS Production Builds. 6) TestFlight/Play Internal + QA. 7) Push E2E. 8) Soft-launch. 9) Flag pagesash pas aprovimit. 10) Launch publik + monitoring.'
  );

  // 8 MAP
  h1(doc, '8. Harta e aftësive Backend & Clients');

  h2(doc, '8.1 Module Backend (Ist)');
  para(
    doc,
    'Auth, Profiles, Posts/Likes/Comments, Messaging, Notifications, Search, Tournaments/Matches/Scorers, TransferHistory, ClubMembers/Roster/Staff, Scouting/AI, Gamification, Analytics, Products/Orders/Payments/Premium/IAP/JonCoin, Streams/LiveKit/LiveChat/Donations, VideoCalls, Videos/Gallery/Media, Moderation, Verification, Admin, Support, Sponsors, Ads, Stadium, NationalTeams, Config, YouTube, Football, Subscriptions.'
  );

  h2(doc, '8.2 Web routes (pjesë)');
  para(
    doc,
    'login/register/forgot/reset, OAuth callbacks, onboarding, parent-verification, cv/share, feed, profile(s), gallery, search, messaging, embed-call/go-live, marketplace, notifications, settings, scouting, streams, tournaments, analytics/insights, premium, sponsors/ads, matches, admin, club-roster, videos, live/:id, wallet, legal, welcome.'
  );

  h2(doc, '8.3 Ekrane Mobile (pjesë)');
  para(
    doc,
    'Landing, Login, RegisterOnboarding, WelcomeOnboarding, AuthCallback, Feed(+pager), CreatePost, PublicProfile, PublicCv, EditProfile, Gallery, Search, BrowseProfiles, Messaging, Conversation, Notifications, Tournaments, Matches, ClubRoster, Scouting, Streams, GoLive, LiveViewer, Videos, Marketplace, Cart, Products, Wallet, Premium, Insights, Ads, Sponsors, AdminDashboard, Settings, Legal, ParentVerification, Call screens, More, ResetPassword.'
  );

  // 9 RISKS
  h1(doc, '9. Rreziqe & mitigim');
  drawTable(
    doc,
    ['Rreziku', 'Impakti', 'Mitigimi'],
    [
      ['Rejection Store për pagesa', 'I lartë', 'Vetëm IAP digjital në mobile; Stripe kryesisht web'],
      ['Live/Calls të paqëndrueshme', 'I lartë', 'Matrica pajisjesh, LiveKit ACL, fallback UX'],
      ['Meta App jo Live', 'I lartë', 'App Review; role tester deri atëherë'],
      ['Llogari OAuth duplicate', 'Mesatar–i lartë', 'Email scope; merge; cleanup admin'],
      ['Migrim i paarritur', 'I lartë', 'Deploy-hook + schema smoke'],
      ['Të dhëna karriere të vjetra', 'Mesatar', 'Mbyllje stints; backfill'],
      ['Keqpërdorim UGC/Live', 'Mesatar', 'Report/Block, Ban, rate limits'],
      ['Email deliverability', 'Mesatar', 'ESP + SPF/DKIM/DMARC'],
      ['Ngatërrim markash', 'I ulët–mesatar', 'Jashtë vetëm X TALENTI'],
    ],
    [150, 70, CONTENT_W - 220]
  );

  // 10 APPENDIX
  h1(doc, '10. Shtojca');

  h2(doc, '10.1 Nivelet e monetizimit');
  bullet(doc, 'Free: profil bazë, social.');
  bullet(doc, 'Premium: çmimet finalizohen përmes IAP Store.');
  bullet(doc, 'Coins: pack 100 / 500 / 1000 (shih PAYMENTS_AUDIT).');

  h2(doc, '10.2 Dokumente të rëndësishme në repo');
  bullet(doc, 'README.md, PROJECT_STATUS.md, IMPLEMENTATION_COMPLETE.md');
  bullet(doc, 'mobile/FINAL_RELEASE_AUDIT.md, STORE_RELEASE_CHECKLIST.md, PAYMENTS_AUDIT.md');
  bullet(doc, 'docs/* — Live, Stripe, Email, Video Calls');
  bullet(doc, 'docs/pdf-build/generate-xtalenti-status-sq.js — gjeneratori i këtij PDF');

  h2(doc, '10.3 Ndryshimet e fundit (tetor 2026)');
  bullet(doc, 'Dual-Club Transfer-Confirm; karriera nga transferet e konfirmuara; CV recent matches.');
  bullet(doc, 'Soft Parity A–C: CV/Legal/Streams Mobile, Sponsors Hub, Group Call, Insights, OAuth UI, Admin Media, Feed Pager.');
  bullet(doc, 'Facebook OAuth relay në xtalenti.com; Graph API v26; FACEBOOK_REQUEST_EMAIL opsional.');
  bullet(doc, 'Arsyet e dështimit OAuth në UI login; static routes për auth callbacks.');
  bullet(doc, 'Auto-create Profile për OAuth + self-heal (fix 404 profili).');

  h2(doc, '10.4 Gjykimi i përgjithshëm');
  para(
    doc,
    'X TALENTI ka vizion të qartë dhe platformë teknike shumë të avancuar: Soll funksional është arritur në shumicën e domenëve. Rruga drejt prodhimit të vërtetë — Store, Meta Live Login, pagesa live dhe verifikim pajisjesh — është kryesisht punë ekzekutimi, compliance dhe ops, jo „mungon feature bazë“. Me listën e blockerëve në kapitullin 7, një Go-Live i kontrolluar është realist.'
  );

  para(doc, 'Fundi i dokumentit. Sipas kërkesës: Executive Summary (2 faqe) ose version anglisht/gjermanisht.');

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i + 1);
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  fs.copyFileSync(OUT_DOCS, OUT_ROOT);
  console.log('Wrote', OUT_DOCS);
  console.log('Wrote', OUT_ROOT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
