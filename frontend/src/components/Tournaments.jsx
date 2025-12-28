import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';
import { TrophyIcon, CalendarIcon, UsersIcon, ChartBarIcon } from '@heroicons/react/24/outline';

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [view, setView] = useState('list'); // list, details, bracket, leaderboard, matches
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [bracket, setBracket] = useState({});
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'league',
    startDate: '',
    endDate: '',
    maxParticipants: 16,
  });
  const { user } = useAuth();
  const socket = useSocket();

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (socket && selectedTournament) {
      socket.on('matchUpdate', handleMatchUpdate);
      return () => socket.off('matchUpdate', handleMatchUpdate);
    }
  }, [socket, selectedTournament]);

  const handleMatchUpdate = (data) => {
    if (data.tournamentId === selectedTournament?.id) {
      fetchMatches(selectedTournament.id);
      if (view === 'leaderboard') fetchLeaderboard(selectedTournament.id);
    }
  };

  const fetchTournaments = async () => {
    try {
      const response = await api.get('/tournaments');
      setTournaments(response.data);
    } catch (err) {
      console.error('Fetch tournaments error:', err);
    }
  };

  const fetchTournamentDetails = async (id) => {
    try {
      const response = await api.get(`/tournaments/${id}`);
      setSelectedTournament(response.data);
      setView('details');
    } catch (err) {
      console.error('Fetch tournament error:', err);
    }
  };

  const fetchLeaderboard = async (id) => {
    try {
      const response = await api.get(`/tournaments/${id}/leaderboard`);
      setLeaderboard(response.data);
    } catch (err) {
      console.error('Fetch leaderboard error:', err);
    }
  };

  const fetchBracket = async (id) => {
    try {
      const response = await api.get(`/tournaments/${id}/bracket`);
      setBracket(response.data);
    } catch (err) {
      console.error('Fetch bracket error:', err);
    }
  };

  const fetchMatches = async (id) => {
    try {
      const response = await api.get(`/tournaments/${id}/matches`);
      setMatches(response.data);
    } catch (err) {
      console.error('Fetch matches error:', err);
    }
  };

  const fetchStats = async (id) => {
    try {
      const response = await api.get(`/tournaments/${id}/stats`);
      setStats(response.data);
    } catch (err) {
      console.error('Fetch stats error:', err);
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
    } catch (err) {
      console.error('Create tournament error:', err);
    }
  };

  const handleJoinTournament = async (tournamentId) => {
    try {
      await api.post(`/tournaments/${tournamentId}/join`);
      fetchTournaments();
      if (selectedTournament?.id === tournamentId) {
        fetchTournamentDetails(tournamentId);
      }
    } catch (err) {
      console.error('Join tournament error:', err);
      alert(err.response?.data?.msg || 'Failed to join');
    }
  };

  const handleLeaveTournament = async (tournamentId) => {
    if (!window.confirm('Are you sure you want to leave this tournament?')) return;
    try {
      await api.delete(`/tournaments/${tournamentId}/leave`);
      fetchTournaments();
      if (selectedTournament?.id === tournamentId) {
        fetchTournamentDetails(tournamentId);
      }
    } catch (err) {
      console.error('Leave tournament error:', err);
      alert(err.response?.data?.msg || 'Failed to leave');
    }
  };

  const handleGenerateBracket = async () => {
    if (!window.confirm('Generate bracket? This will start the tournament.')) return;
    try {
      await api.post(`/tournaments/${selectedTournament.id}/bracket/generate`);
      fetchBracket(selectedTournament.id);
      fetchTournamentDetails(selectedTournament.id);
    } catch (err) {
      console.error('Generate bracket error:', err);
      alert(err.response?.data?.msg || 'Failed to generate bracket');
    }
  };

  const handleUpdateScore = async (matchId, scoreHome, scoreAway, status) => {
    try {
      await api.put(`/tournaments/matches/${matchId}/score`, {
        scoreHome: parseInt(scoreHome),
        scoreAway: parseInt(scoreAway),
        status,
      });
      fetchMatches(selectedTournament.id);
      if (view === 'bracket') fetchBracket(selectedTournament.id);
      if (view === 'leaderboard') fetchLeaderboard(selectedTournament.id);
    } catch (err) {
      console.error('Update score error:', err);
      alert(err.response?.data?.msg || 'Failed to update score');
    }
  };

  const isParticipant = (tournament) => {
    return tournament.participants?.some(p => p.id === user?.id);
  };

  const isCreator = (tournament) => {
    return tournament.creatorId === user?.id;
  };

  const renderBracket = () => {
    const rounds = Object.keys(bracket).map(Number).sort((a, b) => a - b);
    
    return (
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-8 min-w-max">
          {rounds.map(round => (
            <div key={round} className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-center mb-2">
                {round === rounds.length ? 'Final' : round === rounds.length - 1 ? 'Semi-Final' : `Round ${round}`}
              </h3>
              {bracket[round].map(item => (
                <div key={item.id} className="bg-white rounded-lg border-2 border-gray-200 p-3 w-64">
                  {item.Match ? (
                    <>
                      {/* Home Team */}
                      <div className={`flex items-center justify-between p-2 rounded ${
                        item.Match.status === 'finished' && item.Match.scoreHome > item.Match.scoreAway
                          ? 'bg-green-50 font-bold'
                          : ''
                      }`}>
                        <div className="flex items-center gap-2">
                          {item.Match.homeUser?.Profile?.profilePhoto ? (
                            <img
                              src={`${import.meta.env.VITE_API_URL}${item.Match.homeUser.Profile.profilePhoto}`}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                              {item.Match.homeUser?.firstName?.charAt(0) || 'TBD'}
                            </div>
                          )}
                          <span className="text-sm">
                            {item.Match.homeUser
                              ? `${item.Match.homeUser.firstName} ${item.Match.homeUser.lastName}`
                              : 'TBD'}
                          </span>
                        </div>
                        <span className="font-bold text-lg">{item.Match.scoreHome ?? '-'}</span>
                      </div>

                      {/* Away Team */}
                      <div className={`flex items-center justify-between p-2 rounded mt-1 ${
                        item.Match.status === 'finished' && item.Match.scoreAway > item.Match.scoreHome
                          ? 'bg-green-50 font-bold'
                          : ''
                      }`}>
                        <div className="flex items-center gap-2">
                          {item.Match.awayUser?.Profile?.profilePhoto ? (
                            <img
                              src={`${import.meta.env.VITE_API_URL}${item.Match.awayUser.Profile.profilePhoto}`}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold">
                              {item.Match.awayUser?.firstName?.charAt(0) || 'TBD'}
                            </div>
                          )}
                          <span className="text-sm">
                            {item.Match.awayUser
                              ? `${item.Match.awayUser.firstName} ${item.Match.awayUser.lastName}`
                              : 'TBD'}
                          </span>
                        </div>
                        <span className="font-bold text-lg">{item.Match.scoreAway ?? '-'}</span>
                      </div>

                      <div className="mt-2 text-xs text-center text-gray-500">
                        {item.Match.status === 'finished' && '✓ Finished'}
                        {item.Match.status === 'ongoing' && '🔴 Live'}
                        {item.Match.status === 'scheduled' && 'Scheduled'}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-gray-400 py-4">Waiting...</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (view === 'list') {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrophyIcon className="w-8 h-8 text-yellow-500" />
            Tournaments
          </h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
          >
            {showCreateForm ? 'Cancel' : 'Create Tournament'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateTournament} className="mb-6 bg-white rounded-lg shadow p-6">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Tournament Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="league">League</option>
                <option value="cup">Cup</option>
                <option value="knockout">Knockout</option>
              </select>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Max Participants"
                value={formData.maxParticipants}
                onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="2"
              />
            </div>
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg mt-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
            <button
              type="submit"
              className="mt-4 bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600"
            >
              Create Tournament
            </button>
          </form>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
                <h2 className="text-xl font-bold mb-2">{tournament.name}</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <UsersIcon className="w-4 h-4" />
                    {tournament.participants?.length || 0}/{tournament.maxParticipants}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    tournament.status === 'open'
                      ? 'bg-green-500'
                      : tournament.status === 'ongoing'
                      ? 'bg-yellow-500'
                      : 'bg-gray-500'
                  }`}>
                    {tournament.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{tournament.description || 'No description'}</p>
                
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <CalendarIcon className="w-4 h-4" />
                  <span>
                    {tournament.startDate
                      ? new Date(tournament.startDate).toLocaleDateString()
                      : 'TBD'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      fetchTournamentDetails(tournament.id);
                      fetchStats(tournament.id);
                    }}
                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                  >
                    View Details
                  </button>
                  {tournament.status === 'open' && !isParticipant(tournament) && (
                    <button
                      onClick={() => handleJoinTournament(tournament.id)}
                      className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                    >
                      Join
                    </button>
                  )}
                  {tournament.status === 'open' && isParticipant(tournament) && (
                    <button
                      onClick={() => handleLeaveTournament(tournament.id)}
                      className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                    >
                      Leave
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {tournaments.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <TrophyIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>No tournaments yet. Create one!</p>
          </div>
        )}
      </div>
    );
  }

  // Tournament Details View
  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <button
        onClick={() => setView('list')}
        className="mb-4 text-blue-500 hover:underline"
      >
        ← Back to Tournaments
      </button>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{selectedTournament.name}</h1>
            <p className="text-gray-600">{selectedTournament.description}</p>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span>Type: {selectedTournament.type}</span>
              <span>Status: {selectedTournament.status}</span>
              <span>Participants: {selectedTournament.participants?.length}/{selectedTournament.maxParticipants}</span>
            </div>
          </div>
          {isCreator(selectedTournament) && selectedTournament.status === 'open' && (
            <button
              onClick={handleGenerateBracket}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600"
            >
              Start Tournament
            </button>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Total Matches</p>
              <p className="text-2xl font-bold">{stats.totalMatches}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Finished</p>
              <p className="text-2xl font-bold">{stats.finishedMatches}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Goals</p>
              <p className="text-2xl font-bold">{stats.totalGoals}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Goals/Match</p>
              <p className="text-2xl font-bold">{stats.avgGoalsPerMatch}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-6">
          <button
            onClick={() => {
              setView('leaderboard');
              fetchLeaderboard(selectedTournament.id);
            }}
            className={`pb-3 px-2 font-medium ${
              view === 'leaderboard'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Leaderboard
          </button>
          {(selectedTournament.type === 'knockout' || selectedTournament.type === 'cup') && (
            <button
              onClick={() => {
                setView('bracket');
                fetchBracket(selectedTournament.id);
              }}
              className={`pb-3 px-2 font-medium ${
                view === 'bracket'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bracket
            </button>
          )}
          <button
            onClick={() => {
              setView('matches');
              fetchMatches(selectedTournament.id);
            }}
            className={`pb-3 px-2 font-medium ${
              view === 'matches'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Matches
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'leaderboard' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">P</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">W</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">D</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">L</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GF</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GA</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GD</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaderboard.map((participant, index) => (
                <tr key={participant.id} className={index < 3 ? 'bg-green-50' : ''}>
                  <td className="px-6 py-4 text-sm font-bold">{index + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {participant.User?.Profile?.profilePhoto ? (
                        <img
                          src={`${import.meta.env.VITE_API_URL}${participant.User.Profile.profilePhoto}`}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                          {participant.User?.firstName?.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium">
                        {participant.User?.firstName} {participant.User?.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm">{participant.wins + participant.draws + participant.losses}</td>
                  <td className="px-6 py-4 text-center text-sm">{participant.wins}</td>
                  <td className="px-6 py-4 text-center text-sm">{participant.draws}</td>
                  <td className="px-6 py-4 text-center text-sm">{participant.losses}</td>
                  <td className="px-6 py-4 text-center text-sm">{participant.goalsFor}</td>
                  <td className="px-6 py-4 text-center text-sm">{participant.goalsAgainst}</td>
                  <td className="px-6 py-4 text-center text-sm">{participant.goalsFor - participant.goalsAgainst}</td>
                  <td className="px-6 py-4 text-center text-sm font-bold">{participant.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'bracket' && renderBracket()}

      {view === 'matches' && (
        <div className="space-y-4">
          {matches.map(match => (
            <div key={match.id} className="bg-white rounded-lg shadow p-4">
              <div className="grid grid-cols-3 gap-4 items-center">
                {/* Home */}
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {match.homeUser?.Profile?.profilePhoto ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL}${match.homeUser.Profile.profilePhoto}`}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                        {match.homeUser?.firstName?.charAt(0) || 'TBD'}
                      </div>
                    )}
                    <span className="font-semibold">
                      {match.homeUser ? `${match.homeUser.firstName} ${match.homeUser.lastName}` : 'TBD'}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {match.scoreHome ?? '-'} : {match.scoreAway ?? '-'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {match.status === 'finished' && 'Finished'}
                    {match.status === 'ongoing' && '🔴 Live'}
                    {match.status === 'scheduled' && 'Scheduled'}
                  </div>
                </div>

                {/* Away */}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {match.awayUser ? `${match.awayUser.firstName} ${match.awayUser.lastName}` : 'TBD'}
                    </span>
                    {match.awayUser?.Profile?.profilePhoto ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL}${match.awayUser.Profile.profilePhoto}`}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold">
                        {match.awayUser?.firstName?.charAt(0) || 'TBD'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(isCreator(selectedTournament) || match.homeUserId === user?.id || match.awayUserId === user?.id) &&
                match.status !== 'finished' && (
                  <div className="mt-4 flex gap-2 items-center justify-center">
                    <input
                      type="number"
                      placeholder="Home"
                      defaultValue={match.scoreHome ?? 0}
                      id={`home-${match.id}`}
                      className="w-20 px-2 py-1 border rounded text-center"
                      min="0"
                    />
                    <span>:</span>
                    <input
                      type="number"
                      placeholder="Away"
                      defaultValue={match.scoreAway ?? 0}
                      id={`away-${match.id}`}
                      className="w-20 px-2 py-1 border rounded text-center"
                      min="0"
                    />
                    <button
                      onClick={() => {
                        const homeScore = document.getElementById(`home-${match.id}`).value;
                        const awayScore = document.getElementById(`away-${match.id}`).value;
                        handleUpdateScore(match.id, homeScore, awayScore, 'finished');
                      }}
                      className="bg-green-500 text-white px-4 py-1 rounded hover:bg-green-600"
                    >
                      Update Score
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
