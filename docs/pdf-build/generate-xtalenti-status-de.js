/**
 * Generates a detailed German project status PDF for X TALENTI / FootballPro.
 * Run: node generate-xtalenti-status-de.js
 *
 * Outputs:
 *   docs/X-TALENTI_Projektstatus_Soll-Ist_Produktionsbereitschaft_DE.pdf
 *   X-TALENTI_Projektstatus_DE.pdf (repo root copy)
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OUT_DOCS = path.join(
  __dirname,
  '..',
  'X-TALENTI_Projektstatus_Soll-Ist_Produktionsbereitschaft_DE.pdf'
);
const OUT_ROOT = path.join(__dirname, '..', '..', 'X-TALENTI_Projektstatus_DE.pdf');

const FONT = '/System/Library/Fonts/Supplemental/Arial.ttf';
const FONT_BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const FONT_UNI = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';

const MARGIN = 48;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const DOC_DATE = '3. Oktober 2026';
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
  doc.text(`X TALENTI / FootballPro — Vertraulich — Stand: ${DOC_DATE}`, MARGIN, y, {
    width: CONTENT_W * 0.72,
    align: 'left',
  });
  doc.text(`Seite ${pageNum}`, MARGIN, y, { width: CONTENT_W, align: 'right' });
  doc.restore();
}

function h1(doc, text) {
  doc.moveDown(0.4);
  doc.font('Bold').fontSize(18).fillColor(COLORS.ink).text(text, { width: CONTENT_W });
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
  doc.font('Bold').fontSize(13).fillColor(COLORS.ink).text(text, { width: CONTENT_W });
  doc.moveDown(0.25);
}

function h3(doc, text) {
  ensureSpace(doc, 36);
  doc.moveDown(0.2);
  doc.font('Bold').fontSize(11).fillColor(COLORS.gold).text(text, { width: CONTENT_W });
  doc.moveDown(0.15);
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
  const x = MARGIN + indent;
  doc.font('Body').fontSize(9.5).fillColor(COLORS.ink);
  doc.text(`•  ${text}`, x, doc.y, { width: CONTENT_W - indent, lineGap: 1.2 });
  doc.moveDown(0.15);
}

function ensureSpace(doc, need) {
  if (doc.y + need > PAGE_H - 50) {
    doc.addPage();
  }
}

function statusColor(s) {
  const t = String(s || '').toLowerCase();
  if (t.includes('fehlt') || t.includes('blocker') || t.includes('nicht') || t.includes('offen kritisch'))
    return COLORS.missing;
  if (t.includes('teil') || t.includes('demo') || t.includes('warn') || t.includes('ops') || t.includes('vorbereit'))
    return COLORS.partial;
  if (t.includes('ist') || t.includes('fertig') || t.includes('ja') || t.includes('✅') || t.includes('erfüllt'))
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

function coverSlide(doc, title, subtitle, lines) {
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
      Title: 'X TALENTI — Projektstatus, Soll/Ist und Produktionsbereitschaft',
      Author: 'X TALENTI / FootballPro',
      Subject: 'Umfassende deutschsprachige Projektübersicht inkl. Pitch, Feature-Matrix und Go-Live-Blocker',
      Keywords: 'X TALENTI, FootballPro, Soll-Ist, Production Readiness, OAuth, LiveKit',
    },
  });

  ensureFonts(doc);
  const stream = fs.createWriteStream(OUT_DOCS);
  doc.pipe(stream);

  // ========== COVER ==========
  doc.rect(0, 0, PAGE_W, 230).fill(COLORS.ink);
  doc.fillColor(COLORS.gold).font('Bold').fontSize(12).text('X TALENTI', MARGIN, 48);
  doc
    .fillColor(COLORS.white)
    .font('Bold')
    .fontSize(24)
    .text('Projektstatus, Soll/Ist &\nProduktionsbereitschaft', MARGIN, 72, { width: CONTENT_W });
  doc
    .font('Body')
    .fontSize(10.5)
    .fillColor('#cbd5e1')
    .text(
      'Mini Pitch Deck · Vision · Feature-Matrix Web/Mobile · OAuth & Ops · Offene Punkte vor Go-Live',
      MARGIN,
      155,
      { width: CONTENT_W }
    );
  doc
    .font('Body')
    .fontSize(9)
    .fillColor('#94a3b8')
    .text(
      `Dokumentversion ${DOC_VERSION}  ·  Stand: ${DOC_DATE}  ·  Intern / Vertraulich  ·  Sprache: Deutsch`,
      MARGIN,
      190
    );

  doc.y = 250;
  para(
    doc,
    'Dieses Dokument beschreibt das Produkt X TALENTI (technisch und historisch auch FootballPro / JonSport): den angestrebten Zielzustand (Soll), den aktuellen Implementierungsstand (Ist), eine ausführliche Feature-Matrix sowie alle wesentlichen Lücken, Risiken und Aufgaben vor einem produktiven Launch (Web, Backend und Mobile App Stores). Es dient Investoren-, Partner- und internen Entscheidungsmeetings als belastbare Ist-Aufnahme.'
  );
  para(
    doc,
    'Quellen: Repository footballpro, README / PROJECT_STATUS / IMPLEMENTATION_COMPLETE, Mobile Release- und Store-Audits, Backend-Routen (~66 Module), Web-App (React/Vite auf xtalenti.com via GitHub Pages), Mobile (Expo SDK 53), sowie der aktuelle Ops-Stand zu OAuth (Google / Facebook / Apple), LiveKit und Payments (Stand Oktober 2026).'
  );

  // ========== 1. MINI PITCH DECK ==========
  h1(doc, '1. Mini Pitch Deck — Überblick');

  coverSlide(doc, 'Folie 1 — Problem', 'Warum existiert X TALENTI?', [
    'Talent im Fußball ist fragmentiert: Spieler, Trainer, Scouts, Clubs, Agenten, Medien und Verbände arbeiten in isolierten Kanälen (WhatsApp, Instagram, Transfermarkt, lokale Excel-Listen).',
    'Junge Talente — besonders aus Schwellenmärkten und Amateur-/Jugendbereichen — haben kaum eine verifizierbare, digitale Karriereakte.',
    'Scouts und Clubs verlieren Zeit bei Suche, Verifizierung und Kontaktaufnahme; Spieler verlieren Sichtbarkeit und Nachweise (Spiele, Tore, Transfers).',
    'Es fehlt eine vertrauenswürdige Plattform, die Social Discovery, Leistungsdaten, Turniere, Transfers und professionelle Kommunikation verbindet.',
  ]);

  coverSlide(doc, 'Folie 2 — Lösung', 'Was ist X TALENTI?', [
    'X TALENTI ist eine globale Fußball-Talent- und Ökosystem-Plattform: „LinkedIn + Instagram + Transfermarkt + Hudl“ für den Fußball.',
    'Ein Account-Modell mit rollenspezifischen Profilen (Athlet, Trainer, Scout, Club, Manager, Schiedsrichter, Verband, Liga, Media, Business, Admin).',
    'Social Feed, Messaging, Live-Streaming, Video-Calls, Turniere, Scouting-Empfehlungen, Gamification und eine digitale Karriere-/Transferhistorie.',
    'Web-App + native Mobile App (Expo / React Native) auf einem gemeinsamen Node.js/PostgreSQL-Backend.',
  ]);

  coverSlide(doc, 'Folie 3 — Produktvision (Soll)', 'Was soll die Plattform langfristig sein?', [
    'Die Standard-Identität jedes Fußballakteurs: verifiziertes Profil, CV, Medien, Leistungsdaten und Netzwerk.',
    'Marktplatz für Sichtbarkeit und Karrierewege: von Jugendspieler bis Profi, von Scout bis Club-Recruiting.',
    'Operatives Werkzeug für Clubs/Ligen: Kader, Staff, Turniere, Spielberichte, Scorer, Standings.',
    'Monetarisierung über Premium, virtuelle Währung (XCoin/JonCoin), Marketplace und ggf. Live-Donation — rechtssicher (IAP in Stores, Stripe im Web).',
    'Produktmarke nach außen: X TALENTI (xtalenti.com); intern/technisch weiterhin FootballPro-Codebasis.',
  ]);

  coverSlide(doc, 'Folie 4 — Aktueller Stand (Ist)', 'Was ist heute gebaut?', [
    'Feature-reicher 1.0-Kern: Auth (E-Mail + Social), Profile/CV, Feed, Chat, Turniere, Scouting, Gamification, Admin, Sponsors/Ads, JonCoin-Marketplace (ohne Live-Stripe), LiveKit Live & Calls.',
    'Mobile App „X TALENTI“ v1.0.0 mit Expo SDK 53, Push-Client, Report/Block, Account-Löschung, IAP-Codepfad, Soft-Parity zu Web (CV, Legal, Streams, Group Call, Insights, Admin Media, OAuth UI).',
    'Backend auf Render (footballpro.onrender.com), Frontend auf GitHub Pages → xtalenti.com, Medien Cloudinary, Realtime Socket.IO + LiveKit.',
    'Facebook-Login funktioniert technisch (SPA-OAuth-Relay); Meta-App oft noch „Unreleased/Development“ → nur Tester. E-Mail-Scope optional per Env. Zahlungen bewusst oft noch Demo/Guard.',
  ]);

  coverSlide(doc, 'Folie 5 — Zielgruppen', null, [
    'Athleten (Jugend & Amateur bis Semi-Pro): Sichtbarkeit, CV, Highlights, Turnierstats, Transferhistorie.',
    'Scouts & Manager: Suche, Empfehlungen, Kontakt, Insights.',
    'Clubs & Trainer: Roster, Staff, Turniere, Squads, Bestätigung von Transfers.',
    'Verbände/Ligen/Media/Business: Organisationsprofile, Content, Sponsoring.',
    'Eltern (U18): Parent-Verification-Flow.',
  ]);

  coverSlide(doc, 'Folie 6 — Geschäftsmodell', null, [
    'Free Tier: Basisprofil & Social.',
    'Premium (Web-Demo / Mobile-IAP geplant): erweiterte Analytics, Priorität, Themes/Labs.',
    'XCoin/JonCoin: In-App-Währung für Marketplace-Orders und digitale Packs (IAP-Consumables).',
    'Marketplace: Produkte/Orders (physisch/mixed — Store-Compliance beachten).',
    'Perspektivisch: Live-Donations, Sponsoring/Ads-Hub, Federation/Club-Seats.',
  ]);

  coverSlide(doc, 'Folie 7 — Wettbewerb & Differenzierung', null, [
    'Transfermarkt: Daten/Markt — wenig Social/Live/Messaging für Talente.',
    'Instagram/TikTok: Reichweite — keine Fußball-Karriereakte, keine Club-Governance.',
    'Hudl/Veo: Video-Analyse — kein Talent-Netzwerk und kein Transferprozess.',
    'X TALENTI kombiniert Identität + Social + Ops (Clubs/Turniere) + Live + Scouting in einem Account.',
  ]);

  coverSlide(doc, 'Folie 8 — Technologie (Kurz)', null, [
    'API: Express + Sequelize + PostgreSQL auf Render.',
    'Web: React 19 / Vite / Tailwind → GitHub Pages (CNAME xtalenti.com).',
    'Mobile: Expo 53, LiveKit Native, expo-notifications, expo-iap.',
    'OAuth: Passport Google/Facebook/Apple; Redirect über SPA-Domain (Meta App Domains).',
    'A/V: LiveKit (mediasoup deprecated); Uploads: Cloudinary.',
  ]);

  coverSlide(doc, 'Folie 9 — Traction / Delivery', null, [
    'Mehrjährige Entwicklung; PROJECT_STATUS: feature-complete core (~9/10 für Plattformkern).',
    '~66 Backend-Route-Module, 50+ Sequelize-Modelle, ~46 Mobile Screens, umfangreiche Web-Routen.',
    'TestFlight-/Play-Dokumentation vorhanden; physische Geräte-Matrix und Store-Assets noch offen.',
    'Okt. 2026: Facebook OAuth Relay + Profil-Auto-Create für Social-Login behoben.',
  ]);

  coverSlide(doc, 'Folie 10 — Ask / nächste Meilensteine', 'Vor Production Go-Live', [
    'EAS Production Builds + TestFlight / Play Internal + Crash-free Geräte-QA.',
    'IAP-Produkte in App Store Connect & Google Play + Sandbox-Nachweis.',
    'Meta App Review → Live (Facebook Login für alle Nutzer); Google/Apple Console finalisieren.',
    'FACEBOOK_REQUEST_EMAIL=1 nach Meta-Permission; Duplicate-Account-Risiko bereinigen.',
    'Prod-Migrationen, Push (APNs/FCM), Legal Review, PAYMENTS_ENABLED bewusst entscheiden.',
  ]);

  // ========== 2. PRODUCT IDENTITY ==========
  h1(doc, '2. Produktidentität & Architektur');

  h2(doc, '2.1 Marken');
  para(
    doc,
    'Im Ökosystem existieren mehrere Namensschichten. Für Stakeholder-Kommunikation gilt: nach außen X TALENTI; technisches Repo und viele Server-Hosts heißen weiterhin FootballPro.'
  );
  drawTable(
    doc,
    ['Marke', 'Verwendung'],
    [
      ['X TALENTI / xtalenti', 'App-Name, Domain xtalenti.com, UI-Copy, IAP Bundle com.kresha325.xtalenti.*, Support'],
      ['FootballPro', 'Repo, Render-Host footballpro.onrender.com, Legacy Deep-Link-Scheme'],
      ['JonSport', 'Historischer Backend-Paketname (jonsport-backend)'],
      ['XCoin / JonCoin', 'UI oft XCoin; API/DB joncoin'],
    ],
    [150, CONTENT_W - 150]
  );

  h2(doc, '2.2 Hosting & Domains (Ist)');
  drawTable(
    doc,
    ['Schicht', 'URL / Host', 'Hinweis'],
    [
      ['Web SPA', 'https://xtalenti.com', 'GitHub Pages + CNAME'],
      ['API', 'https://footballpro.onrender.com', 'Render Web Service'],
      ['OAuth Relay FB/Google', 'xtalenti.com/auth/{provider}/callback', 'SPA → API (Meta App Domains)'],
      ['Apple Callback', 'API /api/auth/apple/callback', 'HTTPS POST form_post'],
      ['Medien', 'Cloudinary', 'Uploads / Galerie'],
      ['Realtime A/V', 'LiveKit Cloud/Server', 'Tokens via /api/livekit'],
    ],
    [130, 180, CONTENT_W - 310]
  );

  h2(doc, '2.3 Tech-Stack (Ist)');
  bullet(doc, 'Backend: Node.js, Express, PostgreSQL, Sequelize, JWT/Passport, Socket.IO, Cloudinary, Stripe (guarded), Nodemailer, LiveKit.');
  bullet(doc, 'Frontend Web: React 19, Vite, Tailwind, React Router, Axios.');
  bullet(doc, 'Mobile: React Native / Expo SDK 53, LiveKit Native, expo-notifications, expo-iap.');
  bullet(doc, 'CI: GitHub Actions deploy-frontend.yml; Backend Auto-Deploy von main auf Render.');

  h2(doc, '2.4 Rollenmodell');
  para(
    doc,
    'Users.role: athlete, coach, scout, manager, referee, club, federation, liga, media, business, admin. Self-Register erlaubt alle außer liga und admin. Legacy-Alias „trajner“ ≈ coach.'
  );

  // ========== 3. SOLL vs IST ==========
  h1(doc, '3. Soll versus Ist — strategischer Vergleich');

  h2(doc, '3.1 Soll (Zielbild)');
  bullet(doc, 'Zentrale digitale Heimat für Fußballtalente und alle Stakeholder (Entdeckung, Verifizierung, Karriere).');
  bullet(doc, 'Volle Parität Web ↔ Mobile für Kernflows.');
  bullet(doc, 'Vertrauensschicht: Verifizierung, Moderation, Account-Löschung, rechtssichere Payments.');
  bullet(doc, 'Leistungsnachweis: Turniere, Scorer, Standings, CV, Club-Karriere, Dual-Club-Transfers.');
  bullet(doc, 'Live & Calls produktionsstabil auf echten Geräten; Social Login für alle Nutzer (nicht nur Tester).');
  bullet(doc, 'Monetarisierung live ohne Store-Rejection; skalierbare Ops (Migrationen, Monitoring, Backups).');

  h2(doc, '3.2 Ist (heute)');
  bullet(doc, 'Weitgehend feature-vollständige Full-Stack-Plattform (Web + Mobile + API).');
  bullet(doc, 'Social, Profile/CV, Chat, Turniere, Scouting, Gamification, Admin, Sponsors/Ads, Soft-Parity-Phasen A–C weitgehend geliefert.');
  bullet(doc, 'OAuth-Codepfade Google/Facebook/Apple vorhanden; Facebook Login technisch ok, Meta oft noch Development/Unreleased.');
  bullet(doc, 'OAuth erzeugt nun automatisch Profile (Fix Okt. 2026); ohne E-Mail-Scope ggf. Placeholder-Accounts.');
  bullet(doc, 'Zahlungen oft deaktiviert/Demo; IAP code-seitig vorbereitet, Store-seitig unvollständig.');
  bullet(doc, 'Store-Launch organisatorisch noch nicht READY (Builds, Assets, IAP, Privacy Forms, Geräte-QA).');

  h2(doc, '3.3 Kurzfazit');
  para(
    doc,
    'Soll: globales, vertrauenswürdiges Fußball-Karriere-Ökosystem mit Store-tauglicher Monetarisierung. Ist: leistungsfähige 1.0-Plattform — Go-Live-Blocker liegen vor allem bei Store-Compliance, OAuth-App-Review (Meta Live), Payments-Einschaltung, Geräte-QA und Ops, nicht bei fehlendem Kernprodukt.'
  );

  // ========== 4. FEATURE MATRIX ==========
  h1(doc, '4. Feature-Matrix: Soll | Ist Web | Ist Mobile | Bemerkung');

  para(
    doc,
    'Legende: „Ja“ = Zielbild erfüllt und nutzbar; „Teilweise“ = vorhanden mit Einschränkungen/Ops; „Fehlt“ = nicht produktionsreif. Statusfarben: grün ≈ ok, orange ≈ teilweise, rot ≈ fehlt/kritisch.'
  );

  const featureRows = [
    ['E-Mail/Passwort Auth + JWT', 'Ja', 'Ja', 'Ja', 'Register, Login, Forgot/Reset'],
    ['Google OAuth', 'Ja', 'Ja (Ops)', 'Ja (Ops)', 'SPA-Relay; Console Redirects pflegen'],
    ['Facebook OAuth', 'Ja', 'Ja (Ops)', 'Ja (Ops)', 'Relay xtalenti.com; Meta App Review nötig'],
    ['Apple Sign In', 'Ja', 'Ja (Ops)', 'Ja (Ops)', 'Services ID + Keys + Render Callback'],
    ['OAuth → Profil-Shell', 'Ja', 'Ja', 'Ja', 'ensureOAuthProfile + Self-Heal getProfile'],
    ['Onboarding nach Register/OAuth', 'Ja', 'Ja', 'Ja', 'Stadt/Land/Bio'],
    ['Rollenbasierte Profile + Edit', 'Ja', 'Ja', 'Ja', 'Athlete/Coach/Scout/Club/…'],
    ['Öffentliches Profil + Follow', 'Ja', 'Ja', 'Ja', ''],
    ['Public CV / Share / OG', 'Ja', 'Ja', 'Ja', 'Web + Mobile PublicCv'],
    ['Profilmedien / Gallery', 'Ja', 'Ja', 'Ja', 'Cloudinary'],
    ['Karriere-Timeline', 'Ja', 'Ja', 'Ja', 'Aus bestätigten Transfers'],
    ['Transferhistorie + Dual-Confirm', 'Ja', 'Ja', 'Ja', 'Beide Clubs müssen bestätigen'],
    ['Parent Verification U18', 'Ja', 'Ja', 'Ja', ''],
    ['Legal Pages', 'Ja', 'Ja', 'Ja', 'Privacy/Terms/Guidelines; Legal Review offen'],
    ['Social Feed', 'Ja', 'Ja', 'Ja', 'Posts/Likes/Comments'],
    ['Feed Pager (Web)', 'Teilweise', 'Ja', 'n/a', 'Parity C3'],
    ['Suche / Trending / Browse', 'Ja', 'Ja', 'Ja', ''],
    ['Messaging 1:1', 'Ja', 'Ja', 'Ja', 'Socket, Reply/Forward/Read'],
    ['In-App Notifications', 'Ja', 'Ja', 'Ja', ''],
    ['Push Notifications', 'Ja', 'n/a', 'Teilweise', 'Client da; APNs/FCM + EAS nötig'],
    ['Report / Block / Ban', 'Ja', 'Ja', 'Ja', 'Moderation'],
    ['Account-Löschung', 'Ja', 'Ja', 'Ja', 'Soft anonymize'],
    ['1:1 Video Calls (LiveKit)', 'Ja', 'Ja', 'Teilweise', 'Geräte-Matrix offen'],
    ['Group LiveKit Call', 'Ja', 'Ja', 'Ja', 'Parity B1'],
    ['Go Live / Viewer', 'Ja', 'Ja', 'Ja', 'YouTube parallel; Kamera-Flip native fehlt'],
    ['Live Chat / Reactions', 'Ja', 'Ja', 'Ja', ''],
    ['Live Donations', 'Teilweise', 'Teilweise', 'Teilweise', 'Abhängig Payments'],
    ['RTMP/OBS Ingest', 'Optional', 'Fehlt', 'Fehlt', 'Nicht auf Render'],
    ['Turniere / Bracket / Standings', 'Ja', 'Ja', 'Ja', ''],
    ['Match Scorer', 'Ja', 'Ja', 'Ja', ''],
    ['Club Roster / Staff', 'Ja', 'Ja', 'Ja', ''],
    ['National Teams', 'Ja', 'Teilweise', 'Teilweise', 'API stärker als Clients'],
    ['Scouting + AI', 'Ja', 'Ja', 'Ja', ''],
    ['Gamification XP/Badges', 'Ja', 'Ja', 'Ja', ''],
    ['Analytics / Insights Hub', 'Ja', 'Ja', 'Ja', 'Parity B2; teils Premium'],
    ['Sponsors Hub', 'Ja', 'Ja', 'Ja', 'Parity A4'],
    ['Ads', 'Ja', 'Ja', 'Ja', ''],
    ['Admin Dashboard', 'Ja', 'Ja', 'Teilweise', 'Mobile: Media-Tab u. a.'],
    ['Support Chat', 'Ja', 'Ja', 'Ja', ''],
    ['Marketplace / Orders (JonCoin)', 'Ja', 'Ja', 'Ja', ''],
    ['Stripe Live Payments', 'Ja', 'Aus/Demo', 'Aus', 'PAYMENTS_ENABLED default false'],
    ['Premium', 'Ja', 'Demo', 'IAP vorbereitet', 'Store-SKUs fehlen'],
    ['Coin Packs IAP', 'Ja', 'n/a', 'IAP vorbereitet', 'Sandbox-Nachweis fehlt'],
    ['i18n DE/EN/AL', 'Teilweise', 'Teilweise', 'Teilweise', 'UI oft AL/EN'],
    ['E2E automatisiert', 'Ja', 'Fehlt', 'Fehlt', 'Smoke-Scripts'],
    ['Observability', 'Ja', 'Teilweise', 'Teilweise', 'vor Prod vertiefen'],
  ];

  drawTable(
    doc,
    ['Feature', 'Soll', 'Ist Web', 'Ist Mobile', 'Bemerkung'],
    featureRows,
    [128, 52, 68, 72, CONTENT_W - 128 - 52 - 68 - 72]
  );

  // ========== 5. OAUTH / AUTH OPS ==========
  h1(doc, '5. Authentifizierung & OAuth — aktueller Ops-Stand (Okt. 2026)');

  h2(doc, '5.1 Architektur Social Login');
  para(
    doc,
    'Google und Facebook nutzen einen SPA-Relay: Meta/Google leiten auf https://xtalenti.com/auth/{provider}/callback um. Die SPA (OAuthCodeRelay) leitet Code/State an die Render-API (/api/auth/.../callback) weiter. So bleibt die Redirect-URI auf der verifizierten Domain xtalenti.com (Meta App Domains akzeptieren keine onrender.com-Domains ohne Eigentumsnachweis). Apple nutzt form_post direkt auf die Backend-Callback-URL.'
  );

  h2(doc, '5.2 Meta / Facebook Checkliste');
  drawTable(
    doc,
    ['Einstellung', 'Soll-Wert', 'Ist / Hinweis'],
    [
      ['Valid OAuth Redirect URIs', 'https://xtalenti.com/auth/facebook/callback', 'Muss exakt matchen (Strict Mode)'],
      ['Client OAuth Login', 'Yes', 'Pflicht'],
      ['Web OAuth Login', 'Yes', 'Pflicht'],
      ['Native/Desktop App (Advanced)', 'No', 'Yes bricht Web-OAuth'],
      ['App Domains', 'xtalenti.com', 'Nur eigene Domain'],
      ['email Permission', 'Add + Ready for testing', 'Preparing for test = ok für Dev'],
      ['FACEBOOK_REQUEST_EMAIL', '1 auf Render nach Add', 'Sonst nur public_profile'],
      ['App Status', 'Live / Released', 'Oft Unreleased → nur Tester'],
      ['FRONTEND_URL', 'https://xtalenti.com', 'Nicht löschen'],
    ],
    [150, 170, CONTENT_W - 320]
  );

  h2(doc, '5.3 Bekannte OAuth-Datenrisiken');
  bullet(doc, 'Ohne E-Mail-Scope entstehen Accounts wie fb_<id>@users.xtalenti.local — parallel zu bestehenden E-Mail-Accounts.');
  bullet(doc, 'Merge-Logik: bei späterem Real-E-Mail und Treffer auf bestehenden User wird facebookId umgehängt; Placeholder-User bleibt ggf. orphan.');
  bullet(doc, 'Profil fehlte früher bei OAuth → 404 /api/profiles/:id; behoben durch ensureOAuthProfile + Self-Heal für Owner.');
  bullet(doc, 'Google/Apple: Redirect URIs und Secrets in den jeweiligen Consoles müssen mit FRONTEND_URL / BACKEND_PUBLIC_URL übereinstimmen.');

  // ========== 6. DOMAIN DETAIL ==========
  h1(doc, '6. Domänen-Detail (Soll/Ist)');

  h2(doc, '6.1 Identity, Trust & Compliance');
  para(
    doc,
    'Soll: klare Rollen, Parent-Verification für U18, Report/Block, Account-Löschung, Admin-Ban. Ist: implementiert inkl. bannedAt/deletedAt. Offen: Legal-Finalisierung und Store-Privacy-Fragebögen; Meta App Review für öffentliches Facebook Login.'
  );

  h2(doc, '6.2 Karriere, Transfers & CV');
  para(
    doc,
    'Soll: CV mit echten Matches; Karriere aller Clubs; Club-Wechsel erst nach Dual-Confirm. Ist: loadRecentMatches, Transferstatus pending/confirmed/rejected, Stints schließen statt löschen, Karriere-Rebuild. Risiko: frühere gelöschte Historie nicht rekonstruierbar. Migration dual-confirm auf Prod verifizieren.'
  );

  h2(doc, '6.3 Turniere & Clubs');
  para(
    doc,
    'Soll: Beitritt, Squads, Spiele, Scorer, Standings. Ist: umfangreich (Bracket, Accept/Reject, Scorer-by-side, Roster/Staff). Offen: Schulung Club-Admins, Datenqualität im Realbetrieb.'
  );

  h2(doc, '6.4 Live & Communication');
  para(
    doc,
    'Soll: stabile Calls und Go-Live. Ist: LiveKit Web/Mobile, Group Call, Messaging. Offen: Geräte-Matrix, native Kamera-Flip Go-Live, Push für Call/Live in Production Builds, Konsolidierung dualer Stream-APIs.'
  );

  h2(doc, '6.5 Monetarisierung & Sponsoring');
  para(
    doc,
    'Soll: Free/Premium, Coins, Marketplace, Sponsors/Ads ohne Store-Rejection. Ist: JonCoin-Orders nutzbar; Stripe hinter Guard; Premium-Demo; IAP-SKUs im Code; SponsorsAdsHub / mobile Screens. Blocker: ASC/Play Produkte + Sandbox; PAYMENTS_ENABLED Policy.'
  );

  h2(doc, '6.6 Soft Web↔Mobile Parity (A–C)');
  para(
    doc,
    'Ist geliefert (Okt. 2026 Kontext): A1 Public CV Mobile, A2 Legal in-app, A3 Streams Catalog, A4 Sponsors/Ads Web Hub; B1 Group LiveKit Web, B2 Insights/Analytics Parity; C1 OAuth UI Web+Mobile, C2 Admin Media Mobile, C3 Feed Pager Web. Verbleibend eher Ops/QA als Feature-Lücken.'
  );

  // ========== 7. MISSING / BLOCKERS ==========
  h1(doc, '7. Fehlende Teile & Issues vor Production');

  h2(doc, '7.1 Blocker (müssen vor Store / Public Prod)');
  drawTable(
    doc,
    ['ID', 'Thema', 'Warum kritisch', 'Aktion'],
    [
      ['B1', 'EAS Production Builds', 'Kein TestFlight/Play ohne Signatur', 'eas build iOS+Android production'],
      ['B2', 'Geräte-QA Crash-free', 'Store Review & Trust', 'Matrix Auth/Feed/Live/Call/Report/Delete/IAP'],
      ['B3', 'IAP Produkte + Sandbox', 'Rejection bei digitalen Gütern', 'SKUs anlegen, Käufe verifizieren'],
      ['B4', 'Push Credentials', 'Notifications tot auf Device', 'APNs + FCM in EAS'],
      ['B5', 'Prod-Migrationen', 'Schema-Drift → Runtime-Fehler', 'UGC/IAP/Transfer-Confirm apply'],
      ['B6', 'Store Console Forms', 'Submission incomplete', 'Privacy, Data Safety, Age, Screenshots'],
      ['B7', 'Payments Policy', 'Demo vs Live Klarheit', 'PAYMENTS_ENABLED erst nach Legal/Finance'],
      ['B8', 'Meta App Live + Review', 'FB Login nur für Tester', 'App Review / Release; email Permission'],
      ['B9', 'OAuth Env & Consoles', 'Login bricht in Prod', 'FRONTEND_URL, Redirect URIs, Secrets'],
      ['B10', 'Duplicate OAuth Users', 'Zwei Konten / leeres Profil', 'E-Mail-Scope + Merge/Cleanup'],
    ],
    [32, 105, 145, CONTENT_W - 32 - 105 - 145]
  );

  h2(doc, '7.2 Wichtige Warnungen (nicht immer Launch-Stopper)');
  bullet(doc, 'LiveKit physische Geräte nicht final sign-off.');
  bullet(doc, 'Google Play IAP Verify (Service Account) TODO.');
  bullet(doc, 'Legal Copy Starter — Legal Review.');
  bullet(doc, 'Dual Live-APIs (/api/streams vs /api/live-stream) konsolidieren.');
  bullet(doc, 'RTMP/OBS nur wenn OBS-First-Strategie.');
  bullet(doc, 'i18n uneinheitlich (AL/EN dominant).');
  bullet(doc, 'E-Mail Deliverability: Transactional ESP statt reinem Gmail empfehlen.');
  bullet(doc, 'Monitoring/Alerting + Backup-Restore-Drill.');
  bullet(doc, 'Rate Limits Auth/Upload/Messaging prüfen.');
  bullet(doc, 'Markenklarheit: externe Comm nur „X TALENTI“.');

  h2(doc, '7.3 Env-Checkliste Backend (Auszug)');
  drawTable(
    doc,
    ['Variable', 'Zweck', 'Prod'],
    [
      ['DATABASE_URL', 'PostgreSQL', 'Pflicht'],
      ['JWT_SECRET', 'Token-Signatur', 'Pflicht'],
      ['FRONTEND_URL', 'CORS + OAuth Redirect Basis', 'https://xtalenti.com'],
      ['BACKEND_PUBLIC_URL / RENDER_EXTERNAL_URL', 'Apple Callback Host', 'Pflicht'],
      ['CLOUDINARY_*', 'Medien', 'Pflicht'],
      ['LIVEKIT_*', 'A/V Tokens', 'Pflicht für Live/Calls'],
      ['EMAIL_*', 'Transactional Mail', 'Pflicht'],
      ['GOOGLE_CLIENT_ID/SECRET', 'Google OAuth', 'wenn Social on'],
      ['FACEBOOK_APP_ID/SECRET', 'Facebook OAuth', 'wenn Social on'],
      ['FACEBOOK_REQUEST_EMAIL', 'Scope email', '1 nach Meta Add'],
      ['APPLE_*', 'Sign in with Apple', 'wenn Social on'],
      ['PAYMENTS_ENABLED', 'Stripe Live', 'false bis Go'],
      ['STRIPE_* / IAP Secrets', 'Payments', 'wenn on'],
    ],
    [175, 175, CONTENT_W - 350]
  );

  h2(doc, '7.4 Checkliste Deployment Web/API');
  bullet(doc, 'main → Render Live; Migrationen ausführen; Smoke (npm run smoke:api o. ä.).');
  bullet(doc, 'Frontend GH Pages Deploy mit VITE_API_URL → Render API; spa-github-pages inkl. auth/*/callback.');
  bullet(doc, 'CORS erlaubt xtalenti.com (+ www).');
  bullet(doc, 'GET /api/auth/providers zeigt google/facebook/apple laut Env.');
  bullet(doc, 'Manueller Test: E-Mail-Login, FB/Google (Tester), Profil öffnen (kein 404), Feed, Chat.');

  h2(doc, '7.5 Checkliste Mobile Store');
  bullet(doc, 'Icon, Screenshots, Descriptions, Feature Graphic.');
  bullet(doc, 'Privacy/Terms/Guidelines URLs erreichbar.');
  bullet(doc, 'Account Deletion + Report/Block nachweisbar.');
  bullet(doc, 'Permission Strings Kamera/Mic/Photos.');
  bullet(doc, 'IAP + Billing Compliance; Internal Testing → Production.');

  h2(doc, '7.6 Empfohlene Reihenfolge bis Go-Live');
  para(
    doc,
    '1) Prod-DB Migrationen & Backend-Smoke. 2) Meta Live + FACEBOOK_REQUEST_EMAIL + Google/Apple Console. 3) Legal/Privacy Forms. 4) IAP Katalog + Secrets. 5) EAS Production Builds. 6) TestFlight/Play Internal + Geräte-QA. 7) Push E2E. 8) Soft-Launch. 9) Payments-Flag nach Freigabe. 10) Public Launch + Monitoring.'
  );

  // ========== 8. CAPABILITY MAP ==========
  h1(doc, '8. Fähigkeitskarte Backend & Clients');

  h2(doc, '8.1 Backend-Module (Ist)');
  para(
    doc,
    'Auth, Profiles, Posts/Likes/Comments, Messaging, Notifications, Search, Tournaments/Matches/Scorers, TransferHistory, ClubMembers/Roster/Staff, Scouting/AI, Gamification, Analytics, Products/Orders/Payments/Premium/IAP/JonCoin, Streams/LiveKit/LiveChat/Donations, VideoCalls, Videos/Gallery/Media, Moderation, Verification, Admin, Support, Sponsors, Ads, Stadium, NationalTeams, Config, YouTube, Football, Subscriptions.'
  );

  h2(doc, '8.2 Web-Routen (Auszug)');
  para(
    doc,
    'login/register/forgot/reset, OAuth callbacks, onboarding, parent-verification, cv/share, feed, profile(s), gallery, search, messaging, embed-call/incoming/go-live, marketplace, notifications, settings, scouting, streams, tournaments, analytics/gamification/insights, premium, sponsors/ads, matches, admin, club-roster, videos, live/:id, wallet, legal, welcome.'
  );

  h2(doc, '8.3 Mobile Screens (Auszug)');
  para(
    doc,
    'Landing, Login, RegisterOnboarding, WelcomeOnboarding, AuthCallback, Feed(+pager), CreatePost, PublicProfile, PublicCv, EditProfile, Gallery, Search, BrowseProfiles, Messaging, Conversation, Notifications, Tournaments(+detail), Matches, ClubRoster, Scouting, Streams, GoLive, LiveViewer, Videos, Marketplace, Cart, Products, Wallet, Premium, Insights, Ads, Sponsors, AdminDashboard, Settings, Legal, ParentVerification, Call Screens, More, ResetPassword.'
  );

  // ========== 9. RISKS ==========
  h1(doc, '9. Risiken & Mitigation');
  drawTable(
    doc,
    ['Risiko', 'Impact', 'Mitigation'],
    [
      ['Store Rejection Payments', 'Hoch', 'Nur IAP digital auf Mobile; Stripe primär Web'],
      ['Unstabile Live/Calls Device', 'Hoch', 'Geräte-Matrix, LiveKit ACL, Fallback UX'],
      ['Meta App nicht Live', 'Hoch', 'App Review; Tester-Rollen bis dahin'],
      ['OAuth Duplicate Accounts', 'Mittel–Hoch', 'E-Mail-Scope; Merge; Admin-Cleanup'],
      ['Migration nicht gelaufen', 'Hoch', 'Deploy-Hook + Schema-Smoke'],
      ['Karriere-Alt-Daten', 'Mittel', 'Stints schließen; Backfill-UI'],
      ['UGC/Live Missbrauch', 'Mittel', 'Report/Block, Ban, Rate Limits'],
      ['E-Mail Deliverability', 'Mittel', 'ESP + SPF/DKIM/DMARC'],
      ['Markenverwirrung', 'Niedrig–Mittel', 'Extern nur X TALENTI'],
    ],
    [150, 70, CONTENT_W - 220]
  );

  // ========== 10. APPENDIX ==========
  h1(doc, '10. Anhang');

  h2(doc, '10.1 Monetarisierungsstufen');
  bullet(doc, 'Free: Basisprofil, Social.');
  bullet(doc, 'Premium: Preise über Store-IAP finalisieren (Docs nannten früher Beispielpreise).');
  bullet(doc, 'Coins: Packs 100 / 500 / 1000 (siehe PAYMENTS_AUDIT).');

  h2(doc, '10.2 Wichtige Repo-Dokumente');
  bullet(doc, 'README.md, PROJECT_STATUS.md, IMPLEMENTATION_COMPLETE.md');
  bullet(doc, 'mobile/FINAL_RELEASE_AUDIT.md, STORE_RELEASE_CHECKLIST.md, PAYMENTS_AUDIT.md, LIVEKIT_AUDIT.md');
  bullet(doc, 'docs/* — Live, Stripe, Email, Video Calls, Mediasoup (legacy)');
  bullet(doc, 'docs/pdf-build/generate-xtalenti-status-de.js — Generator dieses PDFs');

  h2(doc, '10.3 Änderungen jüngster Iterationen (Kontext Okt. 2026)');
  bullet(doc, 'Dual-Club Transfer-Confirm; Karriere aus bestätigten Transfers; CV Recent Matches.');
  bullet(doc, 'Soft Parity A–C: CV/Legal/Streams Mobile, Sponsors Hub, Group Call, Insights, OAuth UI, Admin Media, Feed Pager.');
  bullet(doc, 'Facebook OAuth Relay über xtalenti.com; Graph API v26; optional FACEBOOK_REQUEST_EMAIL.');
  bullet(doc, 'OAuth Failure Reasons in Login-UI; SPA static routes für auth callbacks.');
  bullet(doc, 'Auto-Create Profile für OAuth-User + getProfile Self-Heal (Fix 404 Profil).');

  h2(doc, '10.4 Gesamturteil');
  para(
    doc,
    'X TALENTI ist als Produktvision klar und als technische Plattform sehr weit: der funktionale Soll-Zustand ist in den meisten Domänen erreicht. Der Weg in echte Production — Mobile Stores, Meta Live Login, Live-Payments und Geräte-Verifikation — ist vor allem Ausführungs-, Compliance- und Ops-Arbeit, kein reines „Kernfeature fehlt“-Problem. Mit Abarbeitung der Blockerliste in Kapitel 7 ist ein kontrollierter Go-Live realistisch.'
  );

  para(
    doc,
    'Ende des Dokuments. Auf Wunsch: Executive Summary (2 Seiten) oder englische / albanische Fassung.'
  );

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
