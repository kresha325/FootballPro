import React, { useEffect, useRef, useState } from 'react';
import { getFullUrl } from '../utils/mediaUrl';

function sponsorLogoUrl(sponsor) {
  const raw = sponsor?.imagePreview || sponsor?.image || sponsor?.logo || sponsor?.logoUrl;
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Never try to load OS temp paths that were wrongly saved historically
  if (
    trimmed.startsWith('/tmp/') ||
    trimmed.includes('/var/folders/') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('/uploads/') && !/^https?:\/\//i.test(trimmed))
  ) {
    return '';
  }
  return getFullUrl(trimmed);
}

const SponsorLogo = ({ sponsor, className }) => {
  const [failed, setFailed] = useState(false);
  const src = sponsorLogoUrl(sponsor);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <span className={className?.includes('w-16') ? 'text-2xl' : 'text-lg'}>🎯</span>;
  }

  return (
    <img
      src={src}
      alt={sponsor?.name || 'Sponsor'}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

const SponsorBanner = ({ sponsors, compact }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (sponsors.length > 1) {
      intervalRef.current = setInterval(() => {
        setActiveIdx((idx) => (idx + 1) % sponsors.length);
      }, 3000);
      return () => clearInterval(intervalRef.current);
    }
    setActiveIdx(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [sponsors]);

  if (!sponsors.length) return null;
  const sponsor = sponsors[activeIdx];

  if (compact) {
    return (
      <a
        href={sponsor.link || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-gradient-to-br from-yellow-100 to-yellow-300 rounded shadow px-3 py-1 min-w-[120px] max-w-xs hover:scale-105 transition"
        title={sponsor.name}
        style={{ minHeight: 32 }}
      >
        <SponsorLogo
          sponsor={sponsor}
          className="w-8 h-6 rounded object-cover border border-yellow-400 shadow"
        />
        <span className="font-bold text-xs text-gray-800 text-center break-words" style={{ maxWidth: 80 }}>
          {sponsor.name}
        </span>
      </a>
    );
  }

  return (
    <div className="flex justify-center mt-2 w-full">
      <a
        href={sponsor.link || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 bg-gradient-to-br from-yellow-100 to-yellow-300 rounded-lg shadow px-6 py-3 min-w-[280px] max-w-xl w-full justify-center hover:scale-105 transition"
        title={sponsor.name}
        style={{ minHeight: 56 }}
      >
        <SponsorLogo
          sponsor={sponsor}
          className="w-16 h-10 rounded object-cover border border-yellow-400 shadow"
        />
        <span className="font-bold text-base text-gray-800 text-center break-words" style={{ maxWidth: 180 }}>
          {sponsor.name}
        </span>
      </a>
    </div>
  );
};

export default SponsorBanner;
