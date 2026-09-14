import React, { useState } from 'react';
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
  if (!profile?.id) return null;

  const shareUrl = getProfileCvShareUrl(profile.id);
  const publicPath = `/cv/${profile.id}`;
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
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
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
          <p className="mt-2 text-[10px] text-gray-400">
            Pamja publike: {getProfileCvPublicUrl(profile.id)}
          </p>
          <button
            type="button"
            className="mt-2 text-xs text-gray-500 hover:underline"
            onClick={() => setOpen(false)}
          >
            Mbyll
          </button>
        </div>
      )}
    </div>
  );
}
