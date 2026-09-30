/** Shared legal / info copy for SPA LegalPage + static GitHub Pages HTML (Apple/TestFlight crawlers). */

export const LEGAL_LAST_UPDATED = '2026-09-30';

export const LEGAL_CONTACT = {
  email: 'support@xtalenti.com',
  web: 'https://xtalenti.com',
  brand: 'X TALENTI',
};

/** Nav order shown across LegalPage, footer, Settings. */
export const legalNav = [
  { kind: 'about', label: 'Rreth nesh', short: 'Info', path: '/about' },
  { kind: 'help', label: 'Ndihmë & FAQ', short: 'Ndihmë', path: '/help' },
  { kind: 'privacy', label: 'Privatësia', short: 'Privatësia', path: '/privacy' },
  { kind: 'terms', label: 'Kushtet', short: 'Kushtet', path: '/terms' },
  { kind: 'cookies', label: 'Cookies', short: 'Cookies', path: '/cookies' },
  { kind: 'data', label: 'Të dhënat e tua', short: 'Të dhënat', path: '/data' },
  {
    kind: 'community-guidelines',
    label: 'Komuniteti',
    short: 'Komuniteti',
    path: '/community-guidelines',
  },
];

export const legalPages = {
  about: {
    slug: 'about',
    title: 'Rreth X TALENTI',
    description:
      'Çfarë është X TALENTI: platforma që lidh talentet e futbollit, klubet, skautët dhe mundësitë.',
    sections: [
      {
        heading: 'Misioni',
        paragraphs: [
          'X TALENTI është platformë digjitale për futbollin: profil publik, CV, media, mesazha, live, turne dhe zbulim talenti.',
          'Qëllimi ynë: t’i japim çdo lojtari, trajneri, klubi dhe skauti një hapësirë profesionale ku talenti bëhet i dukshëm.',
        ],
      },
      {
        heading: 'Për kë është',
        paragraphs: [
          'Lojtarë dhe atletë që ndërtojnë profil dhe histori performancë.',
          'Klube, skautë, trajnerë, menaxherë, federata dhe organizata që kërkojnë ose zhvillojnë talent.',
          'Biznese dhe sponsorë që lidhen me komunitetin e futbollit brenda platformës.',
        ],
      },
      {
        heading: 'Platforma',
        paragraphs: [
          'Web: https://xtalenti.com — dhe aplikacioni celular X TALENTI (iOS / Android).',
          'Planet: Free (trial 30 ditë me tipare Basic), Basic dhe Pro. Detajet e çmimeve janë në faqen Premium / landing.',
        ],
      },
      {
        heading: 'Kontakt',
        paragraphs: [
          `Kontakt (mbështetje & privatësi): ${LEGAL_CONTACT.email}`,
          `Web: ${LEGAL_CONTACT.web}`,
        ],
      },
    ],
  },

  help: {
    slug: 'help',
    title: 'Ndihmë & pyetje të shpeshta',
    description: 'Si të përdorësh X TALENTI: llogaria, profili, privatësia, pagesat dhe raportimi.',
    sections: [
      {
        heading: 'Llogaria dhe hyrja',
        paragraphs: [
          'Regjistrohu me email dhe fjalëkalim, ose me Google/Facebook kur janë të disponueshme në web.',
          'Nëse ke harruar fjalëkalimin, përdor “Ke harruar fjalëkalimin?” në faqen e hyrjes.',
          'Llogaritë e pezulluara ose të fshira nuk mund të hyjnë — kontakto support@xtalenti.com nëse mendon se është gabim.',
        ],
      },
      {
        heading: 'Profili dhe CV',
        paragraphs: [
          'Plotëso foto, bio, pozicion, klub, arritje dhe media (përfshirë video YouTube) që skautët/klubet të të gjejnë.',
          'CV dixhitale publike është e disponueshme në /cv/{id} — mund ta ndash nga profili.',
          'Lojtarët e mitur mund të kenë hapa shtesë verifikimi (prind / klub) sipas rregullave të platformës.',
        ],
      },
      {
        heading: 'Planet Free / Basic / Pro',
        paragraphs: [
          'Free pas trial: tipare sociale (feed, mesazhe, turne bazë).',
          'Basic (dhe trial 30-ditor): analitika e avancuar, badge i verifikuar për role jo-atlet, highlights deri në 10.',
          'Pro: rekomandime scouting, live pa limit, tema profili dhe tipare premium shtesë.',
          'Blerjet në celular kalojnë në App Store / Google Play; në web mund të përdoret Stripe kur është aktiv.',
        ],
      },
      {
        heading: 'Privatësia dhe të dhënat',
        paragraphs: [
          'Lexo Politikën e privatësisë dhe faqen “Të dhënat e tua” për të drejtat e aksesit, eksportit dhe fshirjes.',
          'Fshirja e llogarisë: Settings → Fshi llogarinë (web ose app). Disa të dhëna teknike/financiare mund të ruhen për detyrime ligjore.',
        ],
      },
      {
        heading: 'Siguria dhe raportimi',
        paragraphs: [
          'Raporto përmbajtje ose sjellje që shkel Udhëzuesit e komunitetit (nga postimi/profili kur është e disponueshme, ose me email).',
          'Mos ndaj fjalëkalimin. Aktivizo njoftime push vetëm nëse i dëshiron; mund t’i çaktivizosh në Settings.',
        ],
      },
      {
        heading: 'Kontakt mbështetje',
        paragraphs: [
          `Email: ${LEGAL_CONTACT.email}`,
          'Përshkruaj problemin, rolin e llogarisë dhe pajisjen (web / iOS / Android) që të përgjigjemi më shpejt.',
        ],
      },
    ],
  },

  privacy: {
    slug: 'privacy',
    title: 'Politika e privatësisë — X TALENTI',
    description:
      'Si X TALENTI mbledh, përdor, ruan dhe mbron të dhënat personale në web dhe në aplikacionin celular.',
    sections: [
      {
        heading: '1. Kush jemi (kontroluesi i të dhënave)',
        paragraphs: [
          'X TALENTI (“ne”, “platforma”) ofron shërbime web dhe celular për komunitetin e futbollit. Kjo politikë zbatohet për xtalenti.com dhe aplikacionin X TALENTI (iOS/Android).',
          `Për privatësi dhe mbështetje: ${LEGAL_CONTACT.email}.`,
        ],
      },
      {
        heading: '2. Çfarë të dhënash mbledhim',
        paragraphs: [
          'Llogaria: email, fjalëkalim (i hash-uar), emër, mbiemër, roli (athlete, club, scout, etj.), data e lindjes kur jepet.',
          'Profil sportiv: klub, pozicion, qytet/shtet, bio, arritje, foto/video, media YouTube, CV dixhitale.',
          'Përmbajtje e krijuar nga ti: postime, komente, like, mesazhe, galeri, live/stream, turne, marketplace.',
          'Komunikime: mesazhe private, njoftime në app, token push (Expo/APNs/FCM) nëse i aktivizon.',
          'Kamera/mikrofon: vetëm kur nis video thirrje ose Go Live; audio/video i sesionit përpunohet përmes LiveKit për të ofruar shërbimin.',
          'Pagesa: Premium/XCoin në celular via Apple/Google IAP; në web Stripe kur është aktiv. Ne nuk ruajmë numra të plotë kartelash.',
          'Teknike: IP, lloj pajisjeje/OS, loge serveri për siguri, stabilitet, abuzim dhe diagnostikim.',
        ],
      },
      {
        heading: '3. Baza ligjore dhe qëllimet',
        paragraphs: [
          'Ekzekutimi i kontratës: llogaria, profili, feed, messaging, live, turne, Premium.',
          'Interesi legjitim: siguri, parandalim mashtrimi, përmirësim produkti, statistika të agreguara.',
          'Pëlqimi: njoftime push, cookies jo-thelbësore (kur aplikohen), marketing opsional.',
          'Detyrim ligjor: kontabilitet, kërkesa nga autoritetet, mbrojtja e të miturve.',
        ],
      },
      {
        heading: '4. Fëmijë dhe të mitur',
        paragraphs: [
          'Platforma mund të përdoret nga lojtarë të rinj. Kur kërkohet, aktivizohen hapa verifikimi (p.sh. konfirmim prindi) për profile të miturish.',
          'Mos ndaj të dhëna personale të panevojshme të të miturve. Prindërit/kujdestarët mund të kërkojnë fshirje ose kufizim te support@xtalenti.com.',
        ],
      },
      {
        heading: '5. Me kë i ndajmë',
        paragraphs: [
          'Hosting / infrastrukturë (p.sh. Render) për API dhe bazën e të dhënave.',
          'Media (p.sh. Cloudinary) për foto/video që ngarkon.',
          'Expo / Apple / Google për njoftime push.',
          'LiveKit për video thirrje dhe live.',
          'Apple / Google për IAP; Stripe për pagesa web kur janë aktive.',
          'YouTube (Google) kur lidh ose shfaq video nga URL YouTube që ti vendos.',
          'Nuk shesim të dhëna personale për marketing të palëve të treta.',
        ],
      },
      {
        heading: '6. Transferime ndërkombëtare',
        paragraphs: [
          'Disa ofrues mund të përpunojnë të dhëna jashtë Shqipërisë / BE-së. Përdorim masa të arsyeshme kontraktuale dhe teknike sipas praktikave të ofruesve (p.sh. klauzola standarde ku aplikohen).',
        ],
      },
      {
        heading: '7. Ruajtja dhe siguria',
        paragraphs: [
          'Të dhënat ruhen sa kohë llogaria është aktive dhe sa nevojitet për shërbimin, sigurinë ose ligjin.',
          'Pas fshirjes së llogarisë, të dhënat personale anonimizohen sipas procesit tonë; loge/financiare mund të ruhen përkohësisht.',
          'Masa: HTTPS, kontroll aksesesh, fjalëkalime të hash-uara. Asnjë sistem nuk është 100% i sigurt.',
        ],
      },
      {
        heading: '8. Të drejtat e tua',
        paragraphs: [
          'Akses, korrigjim, kufizim, kundërshtim, portueshmëri (kur zbatohet), tërheqje e pëlqimit.',
          'Fshirje llogarie: Settings → Fshi llogarinë (web/app).',
          'Detaje praktike: faqja “Të dhënat e tua” (/data) dhe email support@xtalenti.com.',
        ],
      },
      {
        heading: '9. Cookies dhe tracking',
        paragraphs: [
          'Shiko Politikën e cookies (/cookies). Web përdor ruajtje lokale/sesioni për autentikim dhe preferenca.',
          'Aplikacioni nuk përdor reklamues tracking të palëve të treta si default. Nuk bëjmë “tracking” ndër-app për ATT përveçse nëse ndryshon — atëherë kërkojmë leje.',
        ],
      },
      {
        heading: '10. Ndryshime dhe kontakt',
        paragraphs: [
          'Mund ta përditësojmë këtë politikë. Data e përditësimit shfaqet në krye. Përdorimi i vazhdueshëm pas ndryshimeve nënkupton pranimin, përveçse kur ligji kërkon pëlqim të ri.',
          `Kontakt: ${LEGAL_CONTACT.email} · ${LEGAL_CONTACT.web}`,
        ],
      },
    ],
  },

  terms: {
    slug: 'terms',
    title: 'Kushtet e përdorimit — X TALENTI',
    description: 'Kushtet që rregullojnë përdorimin e platformës X TALENTI (web dhe celular).',
    sections: [
      {
        heading: '1. Pranimi i kushteve',
        paragraphs: [
          'Duke krijuar llogari ose duke përdorur X TALENTI, pranon këto Kushte, Politikën e privatësisë dhe Udhëzuesit e komunitetit.',
          'Nëse nuk pajtohesh, mos përdor shërbimin.',
        ],
      },
      {
        heading: '2. Përshkrimi i shërbimit',
        paragraphs: [
          'X TALENTI ofron profil, feed, mesazha, media, live, turne, scouting, marketplace, wallet/XCoin dhe tipare Premium sipas planit.',
          'Mund të ndryshojmë, pezullojmë ose ndërpresim funksione për mirëmbajtje, siguri ose arsye biznesi.',
        ],
      },
      {
        heading: '3. Llogaria dhe eligjibiliteti',
        paragraphs: [
          'Je përgjegjës për saktesinë e të dhënave dhe për ruajtjen e kredencialeve.',
          'Mos krijo llogari mashtruese ose në emër të të tjerëve pa autorizim.',
          'Për të mitur, prindi/kujdestari duhet të mbikëqyrë përdorimin dhe të plotësojë verifikimet e kërkuara.',
        ],
      },
      {
        heading: '4. Përmbajtja jote dhe licenca',
        paragraphs: [
          'Mban të drejtat mbi përmbajtjen që publikon. Na jep licencë botërore, jo-ekskluzive, për ta shfaqur, ruajtur dhe shpërndarë brenda platformës (feed, profil, CV, live, etj.).',
          'Garanton se ke të drejtë ta publikosh përmbajtjen dhe se ajo nuk shkel ligjin ose të drejtat e të tjerëve.',
        ],
      },
      {
        heading: '5. Sjellja e ndaluar',
        paragraphs: [
          'Ndalohen spam, mashtrime, ngacmim, gjuhë urrejtjeje, përmbajtje seksuale e padëshiruar, shkelje IP, scraping i paautorizuar, bypass i pagesave/planëve.',
          'Shkeljet mund të çojnë në heqje përmbajtjeje, pezullim ose mbyllje llogarie.',
        ],
      },
      {
        heading: '6. Pagesat dhe abonimet',
        paragraphs: [
          'Blerjet digjitale në iOS/Android rregullohen nga Apple App Store / Google Play (përfshirë rinovimet dhe rifundimet sipas politikave të tyre).',
          'Pagesat web (kur aktivizohen) mund të kalojnë në Stripe. XCoin dhe marketplace kanë rregulla shtesë në produkt.',
          'Çmimet dhe tiparet e planeve Free/Basic/Pro mund të ndryshojnë; ndryshimet komunikohen në app/web.',
        ],
      },
      {
        heading: '7. Pronësia intelektuale e platformës',
        paragraphs: [
          'Marka X TALENTI, dizajni, kodi dhe përmbajtja jonë janë të mbrojtura. Mos i kopjo ose ripërdor pa leje me shkrim.',
        ],
      },
      {
        heading: '8. Mosmarrëveshje / “siç është”',
        paragraphs: [
          'Shërbimi ofrohet “siç është” dhe “sipas disponueshmërisë”. Mund të ndodhin ndërprerje rrjeti, live ose mirëmbajtje.',
          'Në masën e lejuar nga ligji, nuk jemi përgjegjës për dëme indirekte ose humbje të të dhënave përtej kontrollit tonë të arsyeshëm.',
        ],
      },
      {
        heading: '9. Ndryshime dhe kontakt',
        paragraphs: [
          'Mund t’i përditësojmë Kushtet. Data shfaqet në krye. Përdorimi i vazhdueshëm pas ndryshimeve nënkupton pranimin.',
          `Kontakt: ${LEGAL_CONTACT.email}`,
        ],
      },
    ],
  },

  cookies: {
    slug: 'cookies',
    title: 'Politika e cookies — X TALENTI',
    description: 'Si përdor X TALENTI cookies dhe teknologji të ngjashme në web.',
    sections: [
      {
        heading: '1. Çfarë janë cookies',
        paragraphs: [
          'Cookies dhe ruajtja lokale/sesioni janë skedarë ose të dhëna të vogla në shfletues që ndihmojnë autentikimin, preferencat dhe funksionimin e faqes.',
        ],
      },
      {
        heading: '2. Çfarë përdorim',
        paragraphs: [
          'Thelbësore: token autentikimi (localStorage), preferenca teme (dark/light), gjendje sesioni e nevojshme për login.',
          'Funksionale: kujtese e lehtë e UI (p.sh. onboarding i përfunduar) që të mos të shfaqet përsëri.',
          'Analitikë/marketing i palëve të treta: aktualisht nuk përdorim reklama tracking si default. Nëse shtohen, do t’i listojmë këtu dhe do të kërkojmë pëlqim kur kërkohet.',
        ],
      },
      {
        heading: '3. Aplikacioni celular',
        paragraphs: [
          'Aplikacioni nuk mbështetet te cookies e shfletuesit. Përdor ruajtje të sigurt lokale për token dhe preferenca, plus token push nëse i aktivizon.',
        ],
      },
      {
        heading: '4. Menaxhimi',
        paragraphs: [
          'Mund të pastrosh të dhënat e faqes nga cilësimet e shfletuesit (kjo të del nga llogaria).',
          'Bllokimi i cookies thelbësore mund të prishë login-in dhe funksione kritike.',
        ],
      },
      {
        heading: '5. Kontakt',
        paragraphs: [`${LEGAL_CONTACT.email}`],
      },
    ],
  },

  data: {
    slug: 'data',
    title: 'Të dhënat e tua — kërkesa & të drejta',
    description:
      'Si të kërkosh akses, eksport, korrigjim ose fshirje të të dhënave personale në X TALENTI.',
    sections: [
      {
        heading: '1. Çfarë mund të bësh vetë në app/web',
        paragraphs: [
          'Shiko dhe përditëso profilin në Settings / Edit Profile.',
          'Çaktivizo njoftimet push në Settings.',
          'Fshi llogarinë: Settings → Fshi llogarinë (kërkon konfirmim / fjalëkalim kur është i nevojshëm).',
          'Pas fshirjes, të dhënat personale anonimizohen; disa të dhëna teknike ose financiare mund të ruhen për detyrime ligjore.',
        ],
      },
      {
        heading: '2. Kërkesa me email',
        paragraphs: [
          `Dërgo te ${LEGAL_CONTACT.email} me subjektin “Kërkesë të dhënash”.`,
          'Përfshi: emailin e llogarisë, llojin e kërkesës (akses / eksport / korrigjim / fshirje / kufizim), dhe verifikim identiteti (përgjigjemi vetëm pas identifikimit).',
          'Synojmë t’i trajtojmë kërkesat brenda një afati të arsyeshëm (zakonisht deri në 30 ditë, ose sipas ligjit të zbatueshëm).',
        ],
      },
      {
        heading: '3. Çfarë mund të përfshijë një eksport',
        paragraphs: [
          'Të dhëna llogarie dhe profili (emër, email, rol, fusha profili).',
          'Përmbledhje e përmbajtjes së lidhur me llogarinë ku është praktikisht e mundur (postime, media metadata).',
          'Mesazhet private mund të kufizohen për të mbrojtur privatësinë e palëve të tjera.',
        ],
      },
      {
        heading: '4. Të miturit',
        paragraphs: [
          'Prindi/kujdestari ligjor mund të kërkojë fshirje ose kufizim për llogarinë e të miturit, me dokumentacion të arsyeshëm verifikimi.',
        ],
      },
      {
        heading: '5. Dokumente të lidhura',
        paragraphs: [
          'Politika e privatësisë (/privacy), Cookies (/cookies), Kushtet (/terms).',
        ],
      },
    ],
  },

  'community-guidelines': {
    slug: 'community-guidelines',
    title: 'Udhëzuesit e komunitetit — X TALENTI',
    description: 'Rregullat e sjelljes dhe sigurisë në komunitetin X TALENTI.',
    sections: [
      {
        heading: '1. Respekti',
        paragraphs: [
          'Trajto të tjerët me respekt. Nuk lejohet ngacmimi, gjuha e urrejtjes, kërcënimet, dhuna ose diskriminimi.',
        ],
      },
      {
        heading: '2. Përmbajtja',
        paragraphs: [
          'Mos publiko spam, mashtrime, përmbajtje seksuale të padëshiruar, material ilegal, ose shkelje të së drejtës së autorit.',
          'Respekto privatësinë — mos ndaj të dhëna personale të të tjerëve (telefon, adresë, dokumente) pa leje.',
        ],
      },
      {
        heading: '3. Siguria e të rinjve',
        paragraphs: [
          'Komuniko me kujdes me lojtarë të mitur. Ndalohen kontaktet e papërshtatshme dhe kërkesat për takime private të dyshimta.',
          'Raporto menjëherë sjellje të dyshimtë te support@xtalenti.com.',
        ],
      },
      {
        heading: '4. Autenticiteti',
        paragraphs: [
          'Mos pretendo të jesh klub, skaut ose person tjetër. Profilet mashtruese pezullohen.',
          'Statistikat dhe arritjet duhet të jenë të ndershme sa është e mundur.',
        ],
      },
      {
        heading: '5. Raportimi dhe pasojat',
        paragraphs: [
          'Raporto përmbajtjen që shkel rregullat. Ekipi i moderimit shqyrton raportet.',
          'Shkeljet mund të çojnë në heqje përmbajtjeje, pezullim ose mbyllje të llogarisë, pa rifundim të abonimeve kur shkelja është e rëndë (sipas kushteve të dyqaneve të app-eve).',
        ],
      },
    ],
  },
};

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLegalStaticHtml(kind) {
  const page = legalPages[kind];
  if (!page) return null;
  const navHtml = legalNav
    .map((item) => {
      const active = item.kind === kind ? ' class="active"' : '';
      return `<a href="${escapeHtml(item.path)}"${active}>${escapeHtml(item.short)}</a>`;
    })
    .join(' · ');

  const sectionsHtml = page.sections
    .map((sec) => {
      const ps = sec.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
      return `<section>\n<h2>${escapeHtml(sec.heading)}</h2>\n${ps}\n</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="https://xtalenti.com/${escapeHtml(page.slug)}" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #05070b; color: #e8edf4; line-height: 1.55; }
    main { max-width: 44rem; margin: 0 auto; padding: 2rem 1rem 3rem; }
    .nav { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-bottom: 1.5rem; font-size: 0.8rem; }
    .nav a { color: #a7afba; text-decoration: none; }
    .nav a.active, .nav a:hover { color: #f2c866; }
    h1 { font-size: 1.75rem; margin: 0 0 0.5rem; color: #fff; }
    .meta { color: #8b94a3; font-size: 0.875rem; margin-bottom: 1.5rem; }
    section { background: #0c1219; border: 1px solid rgb(255 255 255 / 10%); border-radius: 0.75rem; padding: 1rem 1.1rem; margin-bottom: 0.75rem; }
    h2 { font-size: 1.05rem; margin: 0 0 0.5rem; color: #f2c866; }
    p { margin: 0 0 0.6rem; font-size: 0.95rem; color: #c5cdd8; }
    p:last-child { margin-bottom: 0; }
    a { color: #f2c866; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <nav class="nav" aria-label="Dokumentet ligjore">${navHtml}</nav>
    <h1>${escapeHtml(page.title)}</h1>
    <p class="meta">Përditësuar: ${escapeHtml(LEGAL_LAST_UPDATED)} · ${escapeHtml(LEGAL_CONTACT.brand)}</p>
    ${sectionsHtml}
    <p class="meta"><a href="/">← Kthehu te X TALENTI</a> · <a href="mailto:${escapeHtml(LEGAL_CONTACT.email)}">${escapeHtml(LEGAL_CONTACT.email)}</a></p>
  </main>
</body>
</html>`;
}
