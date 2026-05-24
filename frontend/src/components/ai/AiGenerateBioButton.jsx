import { useState } from 'react';
import { aiAPI } from '../../services/api';

export default function AiGenerateBioButton({ hints = {}, onBio, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiAPI.generateBio({ hints });
      onBio?.(res.data.bio);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'AI_NOT_CONFIGURED') {
        setError('AI nuk është aktiv në server (OPENAI_API_KEY).');
      } else if (code === 'AI_RATE_LIMIT') {
        setError(err?.response?.data?.error || 'Limiti ditor u arrit.');
      } else {
        setError(err?.response?.data?.error || 'Gjenerimi dështoi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm px-3 py-1.5 rounded-md border border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
      >
        {loading ? 'Duke gjeneruar…' : '✨ Gjenero bio me AI'}
      </button>
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
    </div>
  );
}
