import React, { useState } from 'react';
import {
  facebookShareHref,
  whatsappShareHref,
} from '../utils/shareProfile';

function ChannelButton({ label, onClick, className, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-center hover:bg-black/5 dark:hover:bg-white/10 ${className || ''}`}
    >
      {children}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {label}
      </span>
    </button>
  );
}

/** Share actions: Facebook, WhatsApp, Copy link. */
export default function ShareChannelsPanel({ url, text, className = '' }) {
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState('');

  const copy = async (message) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setHint(message || 'Linku u kopjua');
      setTimeout(() => {
        setCopied(false);
        setHint('');
      }, 2500);
    } catch {
      window.prompt('Kopjo linkun:', url);
    }
  };

  const openExternal = (href) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start justify-start gap-1">
        <ChannelButton
          label="Facebook"
          onClick={() => openExternal(facebookShareHref(url))}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-sm font-bold text-white">
            f
          </span>
        </ChannelButton>

        <ChannelButton
          label="WhatsApp"
          onClick={() => openExternal(whatsappShareHref(url, text))}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-sm font-bold text-white">
            W
          </span>
        </ChannelButton>

        <ChannelButton label={copied ? 'OK' : 'Kopjo'} onClick={() => copy('Linku u kopjua')}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-700 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100">
            {copied ? '✓' : '🔗'}
          </span>
        </ChannelButton>
      </div>
      {hint ? <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">{hint}</p> : null}
      <p className="mt-2 break-all text-[10px] text-slate-400">{url}</p>
    </div>
  );
}
