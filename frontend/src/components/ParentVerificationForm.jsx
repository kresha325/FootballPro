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
  const [info, setInfo] = useState('');
  const [emailSent, setEmailSent] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setWarning('');
    setInfo('');
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
        setEmailSent(data.alreadyAuthorized ? null : !!data.emailSent);
        if (data.alreadyAuthorized) setInfo(data.msg || 'Autorizimi është aktiv.');
        if (data.warning) setWarning(data.warning);
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

  return (
    <div className={compact ? '' : ''}>
      {!compact ? (
        <p className="mb-4 text-gray-600 dark:text-gray-300 text-sm">
          Për llogari nën 18 vjeç, prindi ose kujdestari ligjor duhet ta autorizojë llogarinë nga emaili i tij.
        </p>
      ) : (
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          Vendos emailin e prindit ose kujdestarit ligjor. Linku dërgohet vetëm atje dhe nuk ndahet me llogarinë e atletit.
        </p>
      )}

      {error ? <div className="text-red-600 mb-3 text-sm font-medium">{error}</div> : null}
      {info ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{info}</div> : null}

      {emailSent === true ? (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          Kërkesa u dërgua te <strong>{parentEmail}</strong>. Kujdestari duhet të plotësojë deklarimin nga emaili; kontrolloni inbox dhe <strong>Spam</strong>.
        </div>
      ) : null}

      {emailSent === false && warning ? (
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
