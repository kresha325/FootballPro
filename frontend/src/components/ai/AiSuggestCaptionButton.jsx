import { useState } from 'react';
import { aiAPI } from '../../services/api';

export default function AiSuggestCaptionButton({ hints = {}, onCaption, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiAPI.suggestPost({ hints });
      onCaption?.(res.data.caption);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'AI_NOT_CONFIGURED') {
        setError('AI nuk është aktiv në server.');
      } else if (code === 'AI_RATE_LIMIT') {
        setError(err?.response?.data?.error || 'Limiti ditor u arrit.');
      } else {
        setError(err?.response?.data?.error || 'Sugjerimi dështoi.');
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
        className="text-sm px-3 py-2 rounded-md border border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
      >
        {loading ? '…' : '✨ Caption AI'}
      </button>
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
    </div>
  );
}
