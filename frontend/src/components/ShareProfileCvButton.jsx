import React, { useState } from 'react';
import {
  FacebookIcon,
  FacebookShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from 'react-share';
import { getProfileCvShareText, getProfileCvShareUrl } from '../utils/shareProfile';

/**
 * Share digital CV link to social platforms / clipboard.
 */
export default function ShareProfileCvButton({ profile, className = '' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!profile?.id) return null;

  const url = getProfileCvShareUrl(profile.id);
  const text = getProfileCvShareText(profile);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Kopjo linkun e CV:', url);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Ndaj CV
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Ndaj profilin (overview + stats)</p>
          <div className="flex items-center gap-2">
            <FacebookShareButton url={url} quote={text}>
              <FacebookIcon size={36} round />
            </FacebookShareButton>
            <TwitterShareButton url={url} title={text}>
              <TwitterIcon size={36} round />
            </TwitterShareButton>
            <WhatsappShareButton url={url} title={text} separator=" ">
              <WhatsappIcon size={36} round />
            </WhatsappShareButton>
            <button
              type="button"
              onClick={copy}
              className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-500 dark:hover:bg-gray-700"
            >
              {copied ? 'OK' : 'Kopjo'}
            </button>
          </div>
          <p className="mt-2 break-all text-[10px] text-gray-400">{url}</p>
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
