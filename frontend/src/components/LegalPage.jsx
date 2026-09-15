import React from 'react';
import { LEGAL_LAST_UPDATED, legalPages } from '../content/legalPages';

export default function LegalPage({ kind = 'community-guidelines' }) {
  const page = legalPages[kind] || legalPages['community-guidelines'];
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">{page.title}</h1>
        <p className="mb-6 text-sm text-slate-500">Përditësuar: {LEGAL_LAST_UPDATED}</p>
        <div className="space-y-4">
          {page.sections.map((sec) => (
            <section
              key={sec.heading}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="mb-2 text-lg font-semibold text-slate-900">{sec.heading}</h2>
              {sec.paragraphs.map((p) => (
                <p key={p.slice(0, 48)} className="mb-2 text-base leading-relaxed text-slate-700 last:mb-0">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-slate-500">
          <a className="font-semibold text-teal-700" href="/">
            ← Kthehu te X TALENTI
          </a>
        </p>
      </div>
    </div>
  );
}
