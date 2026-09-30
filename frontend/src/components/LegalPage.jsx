import React from 'react';
import { Link } from 'react-router-dom';
import {
  LEGAL_CONTACT,
  LEGAL_LAST_UPDATED,
  legalNav,
  legalPages,
} from '../content/legalPages';
import { APP_BRAND_WORDMARK, APP_LOGO_SRC } from '../config/branding';
import './LegalPage.css';

export default function LegalPage({ kind = 'help' }) {
  const page = legalPages[kind] || legalPages.help;

  return (
    <div className="xt-legal">
      <header className="xt-legal-top">
        <div className="xt-legal-top-inner">
          <Link to="/" className="xt-legal-brand" aria-label={LEGAL_CONTACT.brand}>
            <img src={APP_LOGO_SRC} alt="" width="36" height="36" />
            <span>{APP_BRAND_WORDMARK}</span>
          </Link>
          <div className="xt-legal-top-actions">
            <a href={`mailto:${LEGAL_CONTACT.email}`}>Mbështetje</a>
            <Link to="/register" className="xt-legal-cta">
              Regjistrohu
            </Link>
          </div>
        </div>
      </header>

      <div className="xt-legal-shell">
        <aside className="xt-legal-aside" aria-label="Dokumentet">
          <p className="xt-legal-aside-label">Info & ligjore</p>
          <nav className="xt-legal-nav">
            {legalNav.map((item) => (
              <Link
                key={item.kind}
                to={item.path}
                className={item.kind === kind ? 'is-active' : undefined}
                aria-current={item.kind === kind ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="xt-legal-aside-card">
            <p>Ke nevojë për ndihmë me të dhënat?</p>
            <a href={`mailto:${LEGAL_CONTACT.email}`}>{LEGAL_CONTACT.email}</a>
          </div>
        </aside>

        <main className="xt-legal-main">
          <p className="xt-legal-kicker">X TALENTI · DOKUMENTE</p>
          <h1>{page.title}</h1>
          <p className="xt-legal-desc">{page.description}</p>
          <p className="xt-legal-meta">Përditësuar: {LEGAL_LAST_UPDATED}</p>

          <div className="xt-legal-sections">
            {page.sections.map((sec) => (
              <section key={sec.heading}>
                <h2>{sec.heading}</h2>
                {sec.paragraphs.map((p) => (
                  <p key={p.slice(0, 64)}>{p}</p>
                ))}
              </section>
            ))}
          </div>

          <footer className="xt-legal-foot">
            <Link to="/">← Kthehu te platforma</Link>
            <span aria-hidden="true">·</span>
            <Link to="/help">Ndihmë</Link>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${LEGAL_CONTACT.email}`}>{LEGAL_CONTACT.email}</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
