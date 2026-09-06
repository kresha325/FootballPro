import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { getJonCoinBalance, transferJonCoin, purchaseJonCoin, withdrawJonCoin, getJonCoinTransactions } from '../services/joncoin';
import { ordersAPI } from '../services/api';

function deliveryLabel(method) {
  const m = String(method || '').toLowerCase();
  if (m === 'pickup') return 'Marrje personale';
  if (m === 'shipping') return 'Dërgesë';
  if (m === 'meetup') return 'Takim';
  return method || '—';
}

function orderLinesText(o) {
  const lines = Array.isArray(o?.products) ? o.products : [];
  return lines.map((l) => `${l.name || 'Produkt'} × ${l.quantity}`).join(', ') || '—';
}

const JonCoinWallet = () => {
  const [balance, setBalance] = useState(0);
  const [withdrawFeePct, setWithdrawFeePct] = useState(5);
  const [amount, setAmount] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [orderBusyId, setOrderBusyId] = useState(null);
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
      const [buyRes, sellRes] = await Promise.all([
        ordersAPI.getMyOrders(),
        ordersAPI.getSellerOrders(),
      ]);
      setOrders(Array.isArray(buyRes.data) ? buyRes.data.slice(0, 30) : []);
      setSellerOrders(Array.isArray(sellRes.data) ? sellRes.data.slice(0, 30) : []);
    } catch {
      setOrders([]);
      setSellerOrders([]);
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

  const refreshAll = async () => {
    await Promise.all([fetchBalance(), fetchTransactions(), fetchOrders()]);
  };

  const handleAcceptSale = async (id) => {
    if (!window.confirm('Prano porosinë? JonCoin do të transferohen tani.')) return;
    setOrderBusyId(id);
    setMessage('');
    try {
      const res = await ordersAPI.acceptOrder(id);
      setMessage(res.data?.msg || 'Porosia u pranua.');
      await refreshAll();
    } catch (err) {
      setMessage(err.response?.data?.msg || 'Pranimi dështoi');
    } finally {
      setOrderBusyId(null);
    }
  };

  const handleRejectSale = async (id) => {
    if (!window.confirm('Refuzo porosinë? Stoku kthehet, pa transfer JonCoin.')) return;
    setOrderBusyId(id);
    setMessage('');
    try {
      const res = await ordersAPI.rejectOrder(id);
      setMessage(res.data?.msg || 'Porosia u refuzua.');
      await refreshAll();
    } catch (err) {
      setMessage(err.response?.data?.msg || 'Refuzimi dështoi');
    } finally {
      setOrderBusyId(null);
    }
  };

  const handleCancelPurchase = async (id) => {
    if (!window.confirm('Anulo porosinë në pritje?')) return;
    setOrderBusyId(id);
    setMessage('');
    try {
      await ordersAPI.cancelOrder(id);
      setMessage('Porosia u anulua.');
      await refreshAll();
    } catch (err) {
      setMessage(err.response?.data?.msg || 'Anulimi dështoi');
    } finally {
      setOrderBusyId(null);
    }
  };
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          <div>
            <div className="font-semibold text-gray-900 dark:text-white mb-1">Shitjet e mia (prano / refuzo)</div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Kur pranon, JonCoin transferohen. Deri atëherë porosia është pending.
            </p>
            <div className="space-y-3 max-h-72 overflow-y-auto text-xs">
              {sellerOrders.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nuk ke shitje ende.</p>
              )}
              {sellerOrders.map((o) => (
                <div
                  key={`sale-${o.id}`}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-1"
                >
                  <div className="flex justify-between gap-2 font-semibold text-gray-900 dark:text-white">
                    <span>#{o.id} · {o.totalAmount} JonCoin</span>
                    <span className="capitalize text-amber-600">{o.status}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">
                    Nga: <strong>{o.buyerName || `User #${o.userId}`}</strong>
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">{orderLinesText(o)}</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {deliveryLabel(o.deliveryMethod)}
                    {o.buyerContact ? ` · ${o.buyerContact}` : ''}
                  </p>
                  {o.deliveryAddress ? (
                    <p className="text-gray-600 dark:text-gray-400">Adresa: {o.deliveryAddress}</p>
                  ) : null}
                  {o.deliveryNotes ? (
                    <p className="text-gray-600 dark:text-gray-400">Shënim: {o.deliveryNotes}</p>
                  ) : null}
                  {o.status === 'pending' ? (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={orderBusyId === o.id}
                        onClick={() => handleAcceptSale(o.id)}
                        className="flex-1 py-1.5 rounded bg-emerald-600 text-white font-semibold disabled:opacity-50"
                      >
                        Prano porosinë
                      </button>
                      <button
                        type="button"
                        disabled={orderBusyId === o.id}
                        onClick={() => handleRejectSale(o.id)}
                        className="flex-1 py-1.5 rounded bg-red-600 text-white font-semibold disabled:opacity-50"
                      >
                        Refuzo
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="font-semibold text-gray-900 dark:text-white mb-3">Blerjet e mia</div>
            <div className="space-y-3 max-h-64 overflow-y-auto text-xs">
              {orders.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nuk ka porosi ende. Bli nga marketplace.</p>
              )}
              {orders.map((o) => (
                <div
                  key={`buy-${o.id}`}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-1"
                >
                  <div className="flex justify-between gap-2 font-semibold text-gray-900 dark:text-white">
                    <span>#{o.id} · {o.totalAmount} JonCoin</span>
                    <span className="capitalize">{o.status}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">
                    Shitësi: <strong>{o.sellerName || `User #${o.sellerId}`}</strong>
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">{orderLinesText(o)}</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {deliveryLabel(o.deliveryMethod)}
                    {o.buyerContact ? ` · ${o.buyerContact}` : ''}
                  </p>
                  {o.status === 'pending' ? (
                    <button
                      type="button"
                      disabled={orderBusyId === o.id}
                      onClick={() => handleCancelPurchase(o.id)}
                      className="mt-2 w-full py-1.5 rounded border border-red-300 text-red-700 font-semibold disabled:opacity-50"
                    >
                      Anulo porosinë
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
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
