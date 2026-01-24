import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const JonCoinWallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) fetchBalance();
  }, [user]);

  const fetchBalance = async () => {
    try {
      const res = await axios.get('/api/joncoin/balance');
      setBalance(res.data.balance);
    } catch {
      setBalance(0);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await axios.post('/api/joncoin/transfer', { toUserId, amount: Number(amount) });
      setBalance(res.data.fromBalance);
      setMessage('Transfer successful!');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Transfer failed');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
      <h2 className="text-2xl font-bold mb-4">JonCoin Wallet</h2>
      <div className="mb-2 text-sm text-gray-500">1 JonCoin = 1 €</div>
      <div className="mb-4 text-lg">Balance: <span className="font-mono text-green-600">{balance} JonCoins</span></div>
      <form onSubmit={handleTransfer} className="space-y-3">
        <input
          type="number"
          placeholder="Recipient User ID"
          value={toUserId}
          onChange={e => setToUserId(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Send JonCoins</button>
      </form>
      {message && <div className="mt-3 text-center text-sm text-blue-600">{message}</div>}
    </div>
  );
};

export default JonCoinWallet;
