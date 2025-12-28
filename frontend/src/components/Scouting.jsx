import { useState, useEffect } from 'react';
import { scoutingAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Scouting = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ position: '', minScore: 0 });
  const { user } = useAuth();

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
      setRecommendations(response.data);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = recommendations;
    if (filters.position) {
      filtered = filtered.filter(rec => rec.position === filters.position);
    }
    if (filters.minScore > 0) {
      filtered = filtered.filter(rec => rec.score >= filters.minScore);
    }
    setFilteredRecommendations(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
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
        {filteredRecommendations.map(rec => (
          <div key={rec.playerId} className="border p-4 rounded shadow">
            <h3 className="text-lg font-semibold">{rec.playerName}</h3>
            <p>Position: {rec.position}</p>
            <p>Score: {rec.score.toFixed(2)}</p>
            <p>Reasons: {rec.reasons.join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Scouting;