import { useState, useEffect } from 'react';
import { transferHistoryAPI } from '../services/api';

const TransferHistory = ({ userId, isOwner }) => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    transferType: 'player_transfer',
    fromClub: '',
    toClub: '',
    position: '',
    season: '',
    transferDate: '',
    transferFee: '',
    contractUntil: '',
    notes: '',
  });

  useEffect(() => {
    fetchTransfers();
  }, [userId]);

  const fetchTransfers = async () => {
    try {
      const response = await transferHistoryAPI.getUserTransfers(userId);
      setTransfers(response.data);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransfer = async (e) => {
    e.preventDefault();
    try {
      await transferHistoryAPI.addTransfer(form);
      setShowAddModal(false);
      setForm({
        transferType: 'player_transfer',
        fromClub: '',
        toClub: '',
        position: '',
        season: '',
        transferDate: '',
        transferFee: '',
        contractUntil: '',
        notes: '',
      });
      fetchTransfers();
    } catch (error) {
      console.error('Error adding transfer:', error);
      alert('Failed to add transfer');
    }
  };

  const handleDeleteTransfer = async (transferId) => {
    if (!confirm('Are you sure you want to delete this transfer record?')) return;
    try {
      await transferHistoryAPI.deleteTransfer(transferId);
      fetchTransfers();
    } catch (error) {
      console.error('Error deleting transfer:', error);
      alert('Failed to delete transfer');
    }
  };

  const getTransferIcon = (type) => {
    const icons = {
      'player_transfer': '⚽',
      'coach_appointment': '📋',
      'staff_appointment': '👔',
      'loan': '🔄',
    };
    return icons[type] || '📍';
  };

  if (loading) return <div className="animate-pulse">Loading transfers...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>🔄</span> Transfer History
        </h3>
        {isOwner && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            + Add Transfer
          </button>
        )}
      </div>

      {transfers.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No transfer history</p>
      ) : (
        <div className="space-y-4">
          {transfers.map((transfer) => (
            <div
              key={transfer.id}
              className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-3xl">{getTransferIcon(transfer.transferType)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {transfer.fromClub || 'Free Agent'}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {transfer.toClub}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <span>📅 {transfer.season}</span>
                      {transfer.position && <span>⚽ {transfer.position}</span>}
                      {transfer.transferFee && <span>💰 {transfer.transferFee}</span>}
                      {transfer.contractUntil && <span>📝 Until {transfer.contractUntil}</span>}
                    </div>
                    {transfer.notes && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">{transfer.notes}</p>
                    )}
                  </div>
                </div>
                {isOwner && (
                  <button
                    onClick={() => handleDeleteTransfer(transfer.id)}
                    className="text-red-600 hover:text-red-700 p-2"
                    title="Delete"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Transfer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Add Transfer Record</h3>
            <form onSubmit={handleAddTransfer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Transfer Type</label>
                  <select
                    value={form.transferType}
                    onChange={(e) => setForm({ ...form, transferType: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="player_transfer">Player Transfer</option>
                    <option value="coach_appointment">Coach Appointment</option>
                    <option value="staff_appointment">Staff Appointment</option>
                    <option value="loan">Loan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Season *</label>
                  <input
                    type="text"
                    value={form.season}
                    onChange={(e) => setForm({ ...form, season: e.target.value })}
                    placeholder="e.g., 2024/2025"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">From Club</label>
                  <input
                    type="text"
                    value={form.fromClub}
                    onChange={(e) => setForm({ ...form, fromClub: e.target.value })}
                    placeholder="Previous club"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">To Club *</label>
                  <input
                    type="text"
                    value={form.toClub}
                    onChange={(e) => setForm({ ...form, toClub: e.target.value })}
                    placeholder="New club"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Position/Role</label>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="e.g., Striker, Head Coach"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Transfer Date</label>
                  <input
                    type="date"
                    value={form.transferDate}
                    onChange={(e) => setForm({ ...form, transferDate: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Transfer Fee</label>
                  <input
                    type="text"
                    value={form.transferFee}
                    onChange={(e) => setForm({ ...form, transferFee: e.target.value })}
                    placeholder="e.g., Free, €5M, Loan"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contract Until</label>
                  <input
                    type="text"
                    value={form.contractUntil}
                    onChange={(e) => setForm({ ...form, contractUntil: e.target.value })}
                    placeholder="e.g., 2026"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional details"
                  rows="3"
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                >
                  Add Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferHistory;
