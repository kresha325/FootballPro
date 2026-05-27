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
      setAiError(err?.response?.data?.error || 'Përmbledhja AI dështoi');
    } finally {
      setAiLoadingId(null);
    }
  };

  if (!user || user.role !== 'scout' || !user.premium) {
    return <div className="p-4">Access denied. This is a premium feature for scouts.</div>;
  }

  if (loading) return <div className="p-4">Loading recommendations...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">AI Scouting Recommendations</h2>

      <div className="mb-4 flex gap-4">
        <select name="position" value={filters.position} onChange={handleFilterChange} className="p-2 border rounded">
          <option value="">All Positions</option>
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
          placeholder="Min Score"
          className="p-2 border rounded"
        />
      </div>

      <div className="space-y-4">
        {aiError ? <p className="text-red-600 text-sm mb-2">{aiError}</p> : null}
        {aiSummary ? (
          <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded">
            <p className="font-semibold text-teal-900 mb-1">Përmbledhje AI — {aiSummary.name}</p>
            <p className="text-sm whitespace-pre-wrap">{aiSummary.text}</p>
            <button type="button" className="text-xs mt-2 text-teal-700 underline" onClick={() => setAiSummary(null)}>
              Mbyll
            </button>
          </div>
        ) : null}
        {filteredRecommendations.map(rec => (
          <div key={rec.playerId} className="border p-4 rounded shadow">
            <h3 className="text-lg font-semibold">
              <Link to={`/profile/${rec.playerId}`} className="text-teal-700 hover:underline">
                {rec.playerName}
              </Link>
            </h3>
            <p>Position: {rec.position}</p>
            <p>Score: {Number(rec.score || 0).toFixed(2)}</p>
            <p>Reasons: {Array.isArray(rec.reasons) ? rec.reasons.join(', ') : '-'}</p>
            {canUseAi ? (
              <button
                type="button"
                disabled={aiLoadingId === rec.playerId}
                onClick={() => fetchAiSummary(rec.playerId)}
                className="mt-2 text-sm px-3 py-1 border border-teal-600 text-teal-700 rounded hover:bg-teal-50 disabled:opacity-50"
              >
                {aiLoadingId === rec.playerId ? 'Duke gjeneruar…' : 'Përmbledhje AI'}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Scouting;