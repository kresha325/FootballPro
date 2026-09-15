/** Shared legal copy for SPA LegalPage + static GitHub Pages HTML (Apple/TestFlight crawlers). */

export const LEGAL_LAST_UPDATED = '2026-09-16';

export const legalPages = {
  privacy: {
    slug: 'privacy',
    title: 'Politika e privatësisë — X TALENTI',
    description:
      'Si X TALENTI mbledh, përdor dhe mbron të dhënat personale në web dhe në aplikacionin celular.',
    sections: [
      {
        heading: '1. Kush jemi',
        paragraphs: [
          'X TALENTI (“ne”, “platforma”) është një rrjet social dhe mjet për talentet e futbollit, klubet, skautët dhe profesionistët e sportit. Kjo politikë shpjegon si trajtojmë të dhënat personale kur përdor faqen xtalenti.com ose aplikacionin celular X TALENTI (iOS/Android).',
          'Për pyetje privatësie: support@xtalenti.com.',
        ],
      },
      {
        heading: '2. Çfarë të dhënash mbledhim',
        paragraphs: [
          'Të dhëna llogarie: email, fjalëkalim (i hash-uar), emër, mbiemër, roli në platformë (p.sh. athlete, club, scout).',
          'Profil sportiv: klub, pozicion, mosha/kategoria, bio, qyteti/shteti, arritje, media profili (foto/video) që ngarkon ti.',
          'Përmbajtje që publikon: postime, komente, mesazhe, galeri, live/stream, të dhëna turneesh dhe marketplace kur i përdor.',
          'Komunikime: mesazhe private, njoftime në app, dhe token i njoftimeve push (Expo/APNs/FCM) nëse i aktivizon.',
          'Thirrje dhe live: për video thirrje / Go Live mund të kërkojmë akses në kamerë dhe mikrofon; audio/video i sesionit përpunohet përmes ofruesit LiveKit për të ofruar shërbimin.',
          'Pagesa: Premium dhe XCoin në celular kalojnë nëpër App Store / Google Play (IAP). Në web mund të përdoret Stripe. Ne nuk ruajmë numra kartelash në serverët tanë.',
          'Të dhëna teknike: IP, lloj pajisjeje/OS, loge serveri për siguri, stabilitet dhe abuzim.',
        ],
      },
      {
        heading: '3. Pse i përdorim',
        paragraphs: [
          'Për të krijuar dhe mirëmbajtur llogarinë tënde, profilin dhe CV dixhitale.',
          'Për feed, messaging, njoftime, live, thirrje, turne, marketplace dhe funksione Premium/XCoin.',
          'Për verifikim (p.sh. prind/klub kur aplikohet), moderim, raportime, bllokime dhe siguri.',
          'Për të përmbushur detyrime ligjore dhe për të mbrojtur të drejtat e përdoruesve dhe të platformës.',
        ],
      },
      {
        heading: '4. Fëmijë dhe të mitur',
        paragraphs: [
          'X TALENTI mund të përdoret nga lojtarë të rinj futbolli. Kur kërkohet nga rregullat e platformës, mund të aktivizohen hapa verifikimi (p.sh. konfirmim prindi) për profile të miturish.',
          'Mos ndaj të dhëna personale të panevojshme të të miturve. Prindërit/kujdestarët mund të na kontaktojnë në support@xtalenti.com për kërkesa privatësie ose fshirje.',
        ],
      },
      {
        heading: '5. Me kë i ndajmë',
        paragraphs: [
          'Ofrues hosting/infrastructure (p.sh. Render) për API dhe bazën e të dhënave.',
          'Ofrues media (p.sh. Cloudinary) për ruajtjen e fotove/videove që ngarkon.',
          'Expo / Apple / Google për njoftime push kur i ke aktivizuar.',
          'LiveKit për video thirrje dhe live.',
          'Apple / Google për blerje In-App; Stripe për pagesa web kur janë të aktivizuara.',
          'Nuk shesim të dhënat e tua personale te palë të treta për marketing.',
        ],
      },
      {
        heading: '6. Ruajtja dhe siguria',
        paragraphs: [
          'I ruajmë të dhënat sa kohë llogaria jote është aktive dhe sa nevojitet për shërbimin, sigurinë ose detyrime ligjore.',
          'Përdorim masa teknike dhe organizative të arsyeshme (HTTPS, kontroll aksesesh, fjalëkalime të hash-uara). Asnjë sistem nuk është 100% i sigurt.',
        ],
      },
      {
        heading: '7. Të drejtat e tua',
        paragraphs: [
          'Mund të shikosh dhe përditësosh shumicën e të dhënave të profilit në app/web.',
          'Mund të çaktivizosh njoftimet push në Settings.',
          'Mund të kërkosh fshirjen e llogarisë nga aplikacioni: Settings → Fshi llogarinë (kërkon konfirmim). Pas fshirjes, të dhënat personale anonimizohen sipas procesit tonë; disa të dhëna teknike/log mund të ruhen përkohësisht për siguri ose detyrime ligjore.',
          'Për kërkesa shtesë privatësie: support@xtalenti.com.',
        ],
      },
      {
        heading: '8. Cookies dhe tracking',
        paragraphs: [
          'Faqja web mund të përdorë ruajtje lokale/sesioni për autentikim dhe preferenca. Aplikacioni celular nuk përdor reklamues tracking të palëve të treta si default.',
          'Nuk bëjmë “tracking” ndër-app për reklama sipas kuptimit të App Tracking Transparency, përveçse nëse kjo ndryshon në të ardhmen — në atë rast do të kërkojmë leje kur kërkohet nga Apple/Google.',
        ],
      },
      {
        heading: '9. Ndryshime',
        paragraphs: [
          'Mund ta përditësojmë këtë politikë. Data e përditësimit shfaqet në krye të faqes. Përdorimi i vazhdueshëm pas ndryshimeve nënkupton pranimin e versionit të ri, përveçse kur ligji kërkon pëlqim të veçantë.',
        ],
      },
      {
        heading: '10. Kontakt',
        paragraphs: [
          'Email: support@xtalenti.com',
          'Web: https://xtalenti.com',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Kushtet e përdorimit — X TALENTI',
    description: 'Kushtet e përdorimit të platformës X TALENTI (web dhe aplikacion celular).',
    sections: [
      {
        heading: '1. Pranimi',
        paragraphs: [
          'Duke krijuar llogari ose duke përdorur X TALENTI, pranon këto kushte dhe Udhëzuesit e komunitetit.',
        ],
      },
      {
        heading: '2. Llogaria',
        paragraphs: [
          'Je përgjegjës për saktesinë e të dhënave dhe për ruajtjen e kredencialeve.',
          'Mos krijo llogari mashtruese ose për persona të tjerë pa autorizim.',
        ],
      },
      {
        heading: '3. Përmbajtja jote',
        paragraphs: [
          'Mban të drejtat mbi përmbajtjen që publikon, por na jep licencë jo-ekskluzive për ta shfaqur në platformë (feed, profil, CV, live, etj.).',
          'Nuk lejohet përmbajtje e paligjshme, abuzive, ose që shkel të drejtat e të tjerëve.',
        ],
      },
      {
        heading: '4. Pagesat',
        paragraphs: [
          'Premium, XCoin dhe blerjet digjitale në iOS/Android rregullohen nga Apple App Store / Google Play dhe politikat e tyre.',
          'Pagesat web (kur aktivizohen) mund të kalojnë në Stripe.',
        ],
      },
      {
        heading: '5. Pezullimi',
        paragraphs: [
          'Mund të heqim përmbajtje ose të pezullojmë/mbyllim llogari që shkelin rregullat, abuzojnë sistemin, ose dëmtojnë të tjerët.',
        ],
      },
      {
        heading: '6. Mosmarrëveshje / “siç është”',
        paragraphs: [
          'Shërbimi ofrohet “siç është”. Mund të ndodhin ndërprerje rrjeti, live ose mirëmbajtje.',
        ],
      },
      {
        heading: '7. Kontakt',
        paragraphs: ['support@xtalenti.com'],
      },
    ],
  },
  'community-guidelines': {
    slug: 'community-guidelines',
    title: 'Udhëzuesit e komunitetit — X TALENTI',
    description: 'Rregullat e sjelljes në komunitetin X TALENTI.',
    sections: [
      {
        heading: 'Respekti',
        paragraphs: [
          'Respekto të tjerët. Nuk lejohet ngacmimi, gjuha e urrejtjes, kërcënimet ose dhuna.',
        ],
      },
      {
        heading: 'Përmbajtja',
        paragraphs: [
          'Mos publiko spam, mashtrime, përmbajtje seksuale të padëshiruar, ose materiale ilegale.',
          'Respekto privatësinë — mos ndaj të dhëna personale të të tjerëve pa leje.',
        ],
      },
      {
        heading: 'Siguria e të rinjve',
        paragraphs: [
          'Jihu i kujdesshëm me komunikimin ndaj lojtarëve të mitur. Raporto sjellje të dyshimtë.',
        ],
      },
      {
        heading: 'Raportimi',
        paragraphs: [
          'Raporto përmbajtjen që shkel rregullat. Ekipi i moderimit shqyrton raportet.',
          'Shkeljet e përsëritura mund të çojnë në pezullim ose mbyllje të llogarisë.',
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
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; line-height: 1.55; }
    main { max-width: 42rem; margin: 0 auto; padding: 2rem 1rem 3rem; }
    h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
    .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 1.5rem; }
    section { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem 1.1rem; margin-bottom: 0.75rem; }
    h2 { font-size: 1.05rem; margin: 0 0 0.5rem; }
    p { margin: 0 0 0.6rem; font-size: 0.95rem; }
    p:last-child { margin-bottom: 0; }
    a { color: #0f766e; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(page.title)}</h1>
    <p class="meta">Përditësuar: ${escapeHtml(LEGAL_LAST_UPDATED)} · X TALENTI</p>
    ${sectionsHtml}
    <p class="meta"><a href="/">← Kthehu te X TALENTI</a> · <a href="/terms">Kushtet</a> · <a href="/privacy">Privatësia</a></p>
  </main>
</body>
</html>`;
}
