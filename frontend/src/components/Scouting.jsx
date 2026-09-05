import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { aiAPI, scoutingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Scouting = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ position: '', minScore: 0 });
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [aiError, setAiError] = useState('');
  const { user } = useAuth();

  const scoutRoles = ['scout', 'coach', 'club', 'manager', 'trajner'];
  const canUseAi = scoutRoles.includes(String(user?.role || '').toLowerCase());

  useEffect(() => {
    if (user && user.role === 'scout' && user.premium) {
      fetchRecommendations();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [recommendations, filters]);

  const fetchRecommendations = async () => {
    try {
      const response = await scoutingAPI.getRecommendations();
      const list = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.recommendations)
          ? response.data.recommendations
          : [];
      setRecommendations(list);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = recommendations;
    if (filters.position) {
      filtered = filtered.filter(rec => rec.position === filters.position);
    }
    const minScore = Number(filters.minScore) || 0;
    if (minScore > 0) {
      filtered = filtered.filter((rec) => Number(rec.score || 0) >= minScore);
    }
    setFilteredRecommendations(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchAiSummary = async (playerId) => {
    setAiLoadingId(playerId);
    setAiError('');
    try {
      const res = await aiAPI.scoutSummary(playerId);
      setAiSummary({ playerId, text: res.data.summary, name: res.data.playerName });
    } catch (err) {
      setAiError(err?.response?.data?.msg || err?.response?.data?.error || 'Përmbledhja AI dështoi');
    } finally {
      setAiLoadingId(null);
    }
  };

  if (!user || user.role !== 'scout' || !user.premium) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Qasja u refuzua</p>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Scouting është veçori premium për llogaritë scout.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500">
        Duke ngarkuar rekomandimet…
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Rekomandime Scouting
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Lojtarë të filtruar sipas pozitës dhe pikëve — hap profilin ose kërko përmbledhje AI.
        </p>
      </header>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <select
          name="position"
          value={filters.position}
          onChange={handleFilterChange}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="">Të gjitha pozicionet</option>
          <option value="Forward">Forward</option>
          <option value="Midfielder">Midfielder</option>
          <option value="Defender">Defender</option>
          <option value="Goalkeeper">Goalkeeper</option>
        </select>
        <input
          type="number"
          name="minScore"
          value={filters.minScore}
          onChange={handleFilterChange}
          placeholder="Pikë minimale"
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white sm:w-40"
        />
      </div>

      {aiError ? <p className="text-red-600 text-sm mb-4">{aiError}</p> : null}
      {aiSummary ? (
        <div className="mb-6 p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800">
          <p className="font-semibold text-teal-900 dark:text-teal-100 mb-1">
            Përmbledhje AI — {aiSummary.name}
          </p>
          <p className="text-sm whitespace-pre-wrap text-teal-900/90 dark:text-teal-50/90">{aiSummary.text}</p>
          <button
            type="button"
            className="text-xs mt-3 text-teal-700 dark:text-teal-300 underline"
            onClick={() => setAiSummary(null)}
          >
            Mbyll
          </button>
        </div>
      ) : null}

      {filteredRecommendations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-6 py-12 text-center text-slate-500">
          Nuk ka rekomandime për këto filtra.
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredRecommendations.map((rec) => (
            <li
              key={rec.playerId}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    <Link to={`/profile/${rec.playerId}`} className="text-teal-700 dark:text-teal-300 hover:underline">
                      {rec.playerName}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {rec.position || 'Pozitë e panjohur'} · {Number(rec.score || 0).toFixed(2)} pikë
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {Array.isArray(rec.reasons) && rec.reasons.length
                      ? rec.reasons.join(' · ')
                      : 'Nuk ka arsye të listuara'}
                  </p>
                </div>
                {canUseAi ? (
                  <button
                    type="button"
                    disabled={aiLoadingId === rec.playerId}
                    onClick={() => fetchAiSummary(rec.playerId)}
                    className="shrink-0 text-sm px-3 py-1.5 rounded-lg border border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 disabled:opacity-50"
                  >
                    {aiLoadingId === rec.playerId ? 'Duke gjeneruar…' : 'Përmbledhje AI'}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Scouting;
