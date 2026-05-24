import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificationAPI } from '../services/api';

export default function ParentVerification() {
  const [parentEmail, setParentEmail] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [confirmUrl, setConfirmUrl] = useState('');
  const [emailSent, setEmailSent] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        if (data.emailSent) {
          setTimeout(() => navigate('/profile'), 4000);
        }
      } else {
        setError(data.error || 'Dështoi dërgesa');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.msg || 'Gabim serveri');
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
    <div className="max-w-lg mx-auto mt-12 px-4">
      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Verifikimi i prindit</h2>
      <p className="mb-4 text-gray-600 dark:text-gray-300 text-sm">
        Për llogari nën 18 vjeç, prindi duhet të konfirmojë me email ose me linkun e konfirmimit.
      </p>

      {error ? <div className="text-red-600 mb-3 text-sm font-medium">{error}</div> : null}

      {emailSent === true ? (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          Email-i u dërgua te <strong>{parentEmail}</strong>. Kontrollo inbox dhe <strong>Spam</strong>. Ridrejtim
          automatik…
        </div>
      ) : null}

      {emailSent === false && (warning || confirmUrl) ? (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm space-y-3">
          <p>{warning || 'Email nuk u dërgua nga serveri.'}</p>
          {confirmUrl ? (
            <>
              <p className="font-semibold">Link për prindin (kliko ose kopjo):</p>
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
                className="w-full py-2 bg-teal-700 text-white rounded-lg font-semibold"
              >
                Kopjo linkun për prindin
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email i prindit</label>
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

      <p className="mt-4 text-xs text-gray-500">
        Nëse email nuk vjen: në Render duhet vendosur <code>EMAIL_USER</code> dhe{' '}
        <code>EMAIL_PASSWORD</code> (Gmail App Password).
      </p>
    </div>
  );
}
