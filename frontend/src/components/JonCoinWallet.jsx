import React, { useEffect, useState } from 'react';

import { getJonCoinBalance, transferJonCoin, purchaseJonCoin, withdrawJonCoin, getJonCoinTransactions } from '../services/joncoin';
import { useAuth } from '../contexts/AuthContext';

const JonCoinWallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [message, setMessage] = useState('');


  useEffect(() => {
    fetchBalance();

    fetchTransactions();
  }, []);
  const fetchTransactions = async () => {
    try {
      const txs = await getJonCoinTransactions();
      // Always set as array
      if (Array.isArray(txs)) {
        setTransactions(txs);
      } else if (txs && typeof txs === 'object' && txs !== null) {
        setTransactions([txs]);
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    }
  };
  const handleBuy = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await purchaseJonCoin(Number(buyAmount));
      setMessage('Kërkesa për blerje u dërgua (pending)');
      setBuyAmount('');
      await fetchTransactions();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Blerja dështoi');
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await withdrawJonCoin(Number(withdrawAmount));
      setMessage('Kërkesa për tërheqje u dërgua (pending)');
      setWithdrawAmount('');
      await fetchTransactions();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Tërheqja dështoi');
    }
  };

  const fetchBalance = async () => {
    const bal = await getJonCoinBalance();
    setBalance(bal);
  };


  const handleTransfer = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await transferJonCoin(Number(toUserId), Number(amount));
      await fetchBalance();
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

      {/* Blerje JonCoin */}
      <form onSubmit={handleBuy} className="space-y-3 mb-6">
        <div className="font-semibold">Bli JonCoin</div>
        <input
          type="number"
          placeholder="Shuma për të blerë"
          value={buyAmount}
          onChange={e => setBuyAmount(e.target.value)}
          className="w-full border rounded px-3 py-2"
          min="1"
          required
        />
        <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Bli JonCoin</button>
      </form>

      {/* Tërheqje JonCoin */}
      <form onSubmit={handleWithdraw} className="space-y-3 mb-6">
        <div className="font-semibold">Tërhiq JonCoin (5% komision)</div>
        <input
          type="number"
          placeholder="Shuma për të tërhequr"
          value={withdrawAmount}
          onChange={e => setWithdrawAmount(e.target.value)}
          className="w-full border rounded px-3 py-2"
          min="1"
          required
        />
        <button type="submit" className="w-full bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700">Tërhiq JonCoin</button>
      </form>

      {/* Transfer JonCoin */}
      <form onSubmit={handleTransfer} className="space-y-3 mb-6">
        <div className="font-semibold">Transfero JonCoin</div>
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
          placeholder="Shuma për të transferuar"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Transfero JonCoin</button>
      </form>

      {/* Mesazhe */}
      {message && <div className="mt-3 text-center text-sm text-blue-600">{message}</div>}

      {/* Historiku i transaksioneve */}
      <div className="mt-8">
        <div className="font-semibold mb-2">Historiku i Transaksioneve</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-2 py-1">Data</th>
                <th className="px-2 py-1">Lloji</th>
                <th className="px-2 py-1">Shuma</th>
                <th className="px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr><td colSpan="4" className="text-center py-2">Nuk ka transaksione</td></tr>
              )}
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b">
                  <td className="px-2 py-1">{new Date(tx.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-1">{tx.type}</td>
                  <td className="px-2 py-1">{tx.amount}</td>
                  <td className="px-2 py-1">{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JonCoinWallet;
