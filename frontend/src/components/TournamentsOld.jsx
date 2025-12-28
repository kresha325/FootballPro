import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Tournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'league',
    startDate: '',
    endDate: '',
    maxParticipants: 16,
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await api.get('/tournaments');
      setTournaments(response.data);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    }
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tournaments', formData);
      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        type: 'league',
        startDate: '',
        endDate: '',
        maxParticipants: 16,
      });
      fetchTournaments();
    } catch (error) {
      console.error('Error creating tournament:', error);
    }
  };

  const handleJoinTournament = async (tournamentId) => {
    try {
      await api.post(`/tournaments/${tournamentId}/join`);
      fetchTournaments();
    } catch (error) {
      console.error('Error joining tournament:', error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Tournaments</h1>
      <button
        onClick={() => setShowCreateForm(!showCreateForm)}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        {showCreateForm ? 'Cancel' : 'Create Tournament'}
      </button>

      {showCreateForm && (
        <form onSubmit={handleCreateTournament} className="mb-4 p-4 border rounded">
          <input
            type="text"
            placeholder="Tournament Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          >
            <option value="league">League</option>
            <option value="cup">Cup</option>
            <option value="knockout">Knockout</option>
          </select>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className="w-full p-2 mb-2 border rounded"
          />
          <input
            type="number"
            placeholder="Max Participants"
            value={formData.maxParticipants}
            onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
            className="w-full p-2 mb-2 border rounded"
            min="2"
          />
          <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">
            Create
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="border rounded p-4">
            <h2 className="text-xl font-semibold">{tournament.name}</h2>
            <p>{tournament.description}</p>
            <p>Type: {tournament.type}</p>
            <p>Status: {tournament.status}</p>
            <p>Participants: {tournament.participants?.length || 0}/{tournament.maxParticipants}</p>
            <button
              onClick={() => handleJoinTournament(tournament.id)}
              className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
              disabled={tournament.status !== 'open' || tournament.participants?.some(p => p.id === user?.id)}
            >
              {tournament.participants?.some(p => p.id === user?.id) ? 'Joined' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tournaments;