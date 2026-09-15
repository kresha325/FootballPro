import { useState } from 'react';
import { verificationAPI } from '../services/api';

/**
 * Shared parent-verification form (page, modal, settings).
 * onDone(success) — optional callback after successful request.
 */
export default function ParentVerificationForm({ onDone, compact = false }) {
  const [parentEmail, setParentEmail] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [confirmUrl, setConfirmUrl] = useState('');
  const [emailSent, setEmailSent] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setWarning('');
    setConfirmUrl('');
    setEmailSent(null);

    if (!parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      setError('Vendos një email valid të prindit.');
      return;
    }

    setLoading(true);
    try {
      const res = await verificationAPI.parentRequest({ parentEmail: parentEmail.trim().toLowerCase() });
      const data = res.data || {};

      if (data.success) {
        setEmailSent(!!data.emailSent);
        if (data.warning) setWarning(data.warning);
        if (data.confirmUrl) setConfirmUrl(data.confirmUrl);
        onDone?.(true, data);
      } else {
        setError(data.error || 'Dështoi dërgesa');
        onDone?.(false, data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.msg || 'Gabim serveri');
      onDone?.(false);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!confirmUrl) return;
    try {
      await navigator.clipboard.writeText(confirmUrl);
      alert('Linku u kopjua. Dërgoje prindit (WhatsApp, SMS, etj.).');
    } catch (_e) {
      prompt('Kopjo linkun:', confirmUrl);
    }
  };

  return (
    <div className={compact ? '' : ''}>
      {!compact ? (
        <p className="mb-4 text-gray-600 dark:text-gray-300 text-sm">
          Për llogari nën 18 vjeç, prindi duhet të konfirmojë me email ose me linkun e konfirmimit.
        </p>
      ) : (
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Vendos emailin e prindit. Ai merr një link konfirmimi — pastaj badge <strong>Prindi</strong> bëhet blu.
        </p>
      )}

      {error ? <div className="text-red-600 mb-3 text-sm font-medium">{error}</div> : null}

      {emailSent === true ? (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          Email-i u dërgua te <strong>{parentEmail}</strong>. Kontrollo inbox dhe <strong>Spam</strong>.
        </div>
      ) : null}

      {confirmUrl ? (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm space-y-3">
          <p>
            {warning ||
              (emailSent
                ? 'Mund ta dërgosh edhe në WhatsApp (rekomanduar nëse prindi hap nga telefoni):'
                : 'Email nuk u dërgua nga serveri. Dërgoje linkun në WhatsApp:')}
          </p>
          <a
            href={confirmUrl}
            className="block break-all text-teal-700 underline text-xs"
            target="_blank"
            rel="noreferrer"
          >
            {confirmUrl}
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="w-full py-2 bg-teal-700 text-white rounded-lg font-semibold text-sm"
          >
            Kopjo linkun për WhatsApp
          </button>
        </div>
      ) : null}

      {emailSent === false && warning && !confirmUrl ? (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
          <p>{warning}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email i prindit
        </label>
        <input
          type="email"
          placeholder="prindi@example.com"
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
          autoComplete="email"
          className="w-full px-3 py-2 border rounded-md mb-3 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        <button
          type="submit"
          className="w-full bg-teal-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Duke dërguar…' : 'Dërgo email verifikimi'}
        </button>
      </form>
    </div>
  );
}
