import React from 'react';

const pages = {
  'community-guidelines': {
    title: 'Udhëzuesit e komunitetit — XTalenti',
    body: [
      'Respekto të tjerët. Nuk lejohet ngacmimi, gjuha e urrejtjes, kërcënimet ose dhuna.',
      'Mos publiko spam, mashtrime, përmbajtje seksuale të padëshiruar, ose materiale ilegale.',
      'Respekto privatësinë — mos ndaj të dhëna personale të të tjerëve pa leje.',
      'Raporto përmbajtjen që shkel rregullat. Ekipi i moderimit shqyrton raportet.',
      'Shkeljet e përsëritura mund të çojnë në pezullim ose mbyllje të llogarisë.',
    ],
  },
  privacy: {
    title: 'Politika e privatësisë — XTalenti',
    body: [
      'Mbledhim të dhëna llogarie (email, emër, profil) për të ofruar shërbimin.',
      'Mund të përdorim media (foto/video) që ngarkon ti, për feed, profil dhe live.',
      'Njoftimet push kërkojnë token pajisjeje; mund t’i çaktivizosh në Settings.',
      'Pagesat digjitale/fizike trajtohen nga ofrues të jashtëm (p.sh. Stripe) sipas politikave të tyre.',
      'Mund të kërkosh fshirjen e llogarisë nga aplikacioni (Settings → Fshi llogarinë).',
      'Kontakto support@xtalenti.com për kërkesa privatësie.',
    ],
  },
  terms: {
    title: 'Kushtet e përdorimit — XTalenti',
    body: [
      'Duke përdorur XTalenti, pranon këto kushte dhe udhëzuesit e komunitetit.',
      'Je përgjegjës për përmbajtjen që publikon.',
      'Ne mund të heqim përmbajtje ose pezullojmë llogari që shkelin rregullat.',
      'Shërbimi ofrohet “siç është”; ndërprerjet e rrjetit/live mund të ndodhin.',
      'Pagesat Premium/JonCoin/marketplace rregullohen sipas politikave të pagesës dhe App Store / Play ku aplikohet.',
    ],
  },
};

export default function LegalPage({ kind = 'community-guidelines' }) {
  const page = pages[kind] || pages['community-guidelines'];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{page.title}</h1>
        <ul className="space-y-4 text-base leading-relaxed">
          {page.body.map((line) => (
            <li key={line} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-slate-500">
          <a className="text-teal-700 font-semibold" href="/">
            ← Kthehu te XTalenti
          </a>
        </p>
      </div>
    </div>
  );
}
