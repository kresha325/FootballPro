import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { getJonCoinBalance, transferJonCoin, purchaseJonCoin, withdrawJonCoin, getJonCoinTransactions } from '../services/joncoin';
import { ordersAPI } from '../services/api';

const JonCoinWallet = () => {
  const [balance, setBalance] = useState(0);
  const [withdrawFeePct, setWithdrawFeePct] = useState(5);
  const [amount, setAmount] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');

  const fetchTransactions = useCallback(async () => {
    try {
      const txs = await getJonCoinTransactions();
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
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.getMyOrders();
      const list = Array.isArray(res.data) ? res.data : [];
      setOrders(list.slice(0, 20));
    } catch {
      setOrders([]);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    const { balance: b, withdrawCommissionPercent } = await getJonCoinBalance();
    setBalance(b);
    setWithdrawFeePct(withdrawCommissionPercent);
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
    fetchOrders();
  }, [fetchBalance, fetchTransactions, fetchOrders]);

  const handleBuy = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await purchaseJonCoin(Number(buyAmount));
      const auto = res?.autoCompleted;
      setMessage(
        auto
          ? 'JonCoin u shtua në llogarinë tënde.'
          : 'Kërkesa për blerje u dërgua (në pritje të konfirmimit nga admin).'
      );
      setBuyAmount('');
      await fetchTransactions();
      await fetchBalance();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Blerja dështoi');
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const wd = await withdrawJonCoin(Number(withdrawAmount));
      const extra =
        wd?.netPayout != null && wd?.feeAmount != null
          ? ` Bruto ${wd.grossAmount}, komision ${wd.commissionPercent}% (${wd.feeAmount}), net për pagesë ${wd.netPayout}.`
          : '';
      setMessage(`Kërkesa për tërheqje u dërgua (pending).${extra}`);
      setWithdrawAmount('');
      await fetchTransactions();
      await fetchBalance();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Tërheqja dështoi');
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await transferJonCoin(Number(toUserId), Number(amount));
      setToUserId('');
      setAmount('');
      await fetchBalance();
      await fetchTransactions();
      setMessage('Transferi u krye.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Transferi dështoi');
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">JonCoin Wallet</h2>
        <Link
          to="/marketplace"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
        >
          Shko te marketplace
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">1 JonCoin = 1 € (referencë)</div>
          <div className="mb-6 text-lg text-gray-900 dark:text-white">
            Balanca: <span className="font-mono text-green-600 dark:text-green-400">{balance}</span>{' '}
            <span className="text-gray-600 dark:text-gray-300">JonCoin</span>
          </div>

          <form onSubmit={handleBuy} className="space-y-3 mb-6">
            <div className="font-semibold text-gray-900 dark:text-white">Bli JonCoin</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Në prodhim, blerjet mund të jenë në pritje derisa admin t’i konfirmojë, përveç nëse përdoret auto-approve në server.
            </p>
            <input
              type="number"
              placeholder="Shuma"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="1"
              required
            />
            <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
              Bli JonCoin
            </button>
          </form>

          <form onSubmit={handleWithdraw} className="space-y-3 mb-6">
            <div className="font-semibold text-gray-900 dark:text-white">
              Tërhiq ({withdrawFeePct}% komision në tërheqje)
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nga shuma që tërheq nga wallet zbatohet komisioni; shitjet në marketplace nuk kanë komision veçmas.
            </p>
            <input
              type="number"
              placeholder="Shuma"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="1"
              required
            />
            <button type="submit" className="w-full bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700">
              Tërhiq
            </button>
          </form>

          <form onSubmit={handleTransfer} className="space-y-3">
            <div className="font-semibold text-gray-900 dark:text-white">Transfer te përdorues tjetër</div>
            <input
              type="number"
              placeholder="ID e marrësit"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
            <input
              type="number"
              placeholder="Shuma"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              Transfero
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="font-semibold text-gray-900 dark:text-white mb-3">Porositë e mia (JonCoin)</div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto text-xs">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-left">
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">Shuma</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Data</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-3 text-gray-500">
                      Nuk ka porosi ende. Bli nga marketplace me JonCoin.
                    </td>
                  </tr>
                )}
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-200 dark:border-gray-600">
                    <td className="px-2 py-1">{o.id}</td>
                    <td className="px-2 py-1">{o.totalAmount}</td>
                    <td className="px-2 py-1">{o.status}</td>
                    <td className="px-2 py-1">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-4 text-center text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg py-2 px-3">
          {message}
        </div>
      )}

      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="font-semibold text-gray-900 dark:text-white mb-2">Historiku i transaksioneve</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-2 py-1 text-left">Data</th>
                <th className="px-2 py-1 text-left">Lloji</th>
                <th className="px-2 py-1 text-left">Shuma</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-left">Përshkrim</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-2 text-gray-500">
                    Nuk ka transaksione
                  </td>
                </tr>
              )}
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="px-2 py-1">{new Date(tx.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-1">{tx.type}</td>
                  <td className="px-2 py-1">{tx.amount}</td>
                  <td className="px-2 py-1">{tx.status}</td>
                  <td className="px-2 py-1 max-w-[180px] truncate" title={tx.description}>
                    {tx.description || '—'}
                  </td>
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
