import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ShareChannelsPanel from './ShareChannelsPanel';
import {
  getProfileCvPublicUrl,
  getProfileCvShareText,
  getProfileCvShareUrl,
} from '../utils/shareProfile';

/**
 * Owner-only: preview digital CV, then share to social / clipboard.
 */
export default function ShareProfileCvButton({ profile, className = '' }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!profile?.id) return null;

  const shareUrl = getProfileCvShareUrl(profile.id);
  const publicPath = `/cv/${profile.id}`;
  const publicUrl = getProfileCvPublicUrl(profile.id);
  const text = getProfileCvShareText(profile);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        CV dixhitale
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Mbyll"
            className="fixed inset-0 z-40 bg-black/40 md:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Ndaj CV dixhitale"
            className="fixed left-1/2 top-1/2 z-50 w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-600 dark:bg-gray-800 md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:translate-x-0 md:translate-y-0 md:shadow-lg"
          >
            <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-200">
              Shiko CV-në para se ta ndash
            </p>
            <Link
              to={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200"
              onClick={() => setOpen(false)}
            >
              Shiko CV
            </Link>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Ndaje në Facebook, WhatsApp, Instagram, TikTok…
            </p>
            <ShareChannelsPanel url={shareUrl} text={text} />
            <p className="mt-2 truncate text-[10px] text-gray-400" title={publicUrl}>
              Pamja publike: {publicUrl}
            </p>
            <button
              type="button"
              className="mt-2 text-xs text-gray-500 hover:underline"
              onClick={() => setOpen(false)}
            >
              Mbyll
            </button>
          </div>
        </>
      )}
    </div>
  );
}
