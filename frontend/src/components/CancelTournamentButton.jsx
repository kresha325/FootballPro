import React from 'react';
import axios from 'axios';

export default function CancelTournamentButton({ tournamentId, onCancel }) {
  const handleCancel = async () => {
    if (!window.confirm('A jeni i sigurt që doni të anuloni këtë turne?')) return;
    try {
      await axios.delete(`/api/tournaments/${tournamentId}`);
      alert('Turneu u anulua me sukses!');
      if (onCancel) onCancel();
    } catch (err) {
      alert('Nuk u fshi dot turneu!');
    }
  };
  return (
    <button
      className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      onClick={handleCancel}
    >
      Anulo Turneun
    </button>
  );
}
