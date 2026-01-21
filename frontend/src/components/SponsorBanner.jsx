import React, { useEffect, useRef, useState } from 'react';

const SponsorBanner = ({ sponsors, compact }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (sponsors.length > 1) {
      intervalRef.current = setInterval(() => {
        setActiveIdx(idx => (idx + 1) % sponsors.length);
      }, 3000);
      return () => clearInterval(intervalRef.current);
    } else {
      setActiveIdx(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
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
        {(sponsor.imagePreview || sponsor.image) ? (
          <img
            src={
              (sponsor.imagePreview || sponsor.image)
                ? ((sponsor.imagePreview || sponsor.image).startsWith('http')
                    ? (sponsor.imagePreview || sponsor.image)
                    : `${import.meta.env.VITE_API_URL.replace('/api','')}${(sponsor.imagePreview || sponsor.image).startsWith('/') ? (sponsor.imagePreview || sponsor.image) : '/' + (sponsor.imagePreview || sponsor.image)}`)
                : undefined
            }
            alt="Sponsor"
            className="w-8 h-6 rounded object-cover border border-yellow-400 shadow"
          />
        ) : (
          <span className="text-lg">🎯</span>
        )}
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
        {(sponsor.imagePreview || sponsor.image) ? (
          <img
            src={
              (sponsor.imagePreview || sponsor.image)
                ? ((sponsor.imagePreview || sponsor.image).startsWith('http')
                    ? (sponsor.imagePreview || sponsor.image)
                    : `${import.meta.env.VITE_API_URL.replace('/api','')}${(sponsor.imagePreview || sponsor.image).startsWith('/') ? (sponsor.imagePreview || sponsor.image) : '/' + (sponsor.imagePreview || sponsor.image)}`)
                : undefined
            }
            alt="Sponsor"
            className="w-16 h-10 rounded object-cover border border-yellow-400 shadow"
          />
        ) : (
          <span className="text-2xl">🎯</span>
        )}
        <span className="font-bold text-base text-gray-800 text-center break-words" style={{ maxWidth: 180 }}>
          {sponsor.name}
        </span>
      </a>
    </div>
  );
};

export default SponsorBanner;