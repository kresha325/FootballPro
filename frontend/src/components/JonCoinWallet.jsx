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

function transactionFlow(type) {
  if (['purchase', 'reward'].includes(String(type || '').toLowerCase())) return 'incoming';
  if (['spend', 'withdrawal'].includes(String(type || '').toLowerCase())) return 'outgoing';
  return 'activity';
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
    if (!window.confirm('Prano porosinë? XCoin do të transferohen tani.')) return;
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
    if (!window.confirm('Refuzo porosinë? Stoku kthehet, pa transfer XCoin.')) return;
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
          ? 'XCoin u shtua në llogarinë tënde.'
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
    <div className="mx-auto min-h-screen max-w-5xl space-y-5 bg-[var(--xt-color-canvas)] px-4 py-5 pb-24 text-[var(--xt-color-text)] sm:px-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--xt-color-gold-bright)]">X TALENTI · Wallet</p><h1 className="mt-1 text-3xl font-black text-white">XCoin</h1></div>
        <Link
          to="/marketplace"
          className="btn btn-outline min-h-11 text-sm"
        >
          Shko te marketplace
        </Link>
      </div>
      <div className="flex flex-wrap gap-2"><Link to="/marketplace" className="xt-badge hover:border-[var(--xt-color-gold)]">Tregu XCoin</Link><Link to="/premium" className="xt-badge hover:border-[var(--xt-color-gold)]">Abonimi Premium</Link></div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="xt-card p-4 sm:p-6">
          <div className="mb-2 text-sm text-[var(--xt-color-text-muted)]">Bilanci i disponueshëm</div>
          <div className="mb-6 flex items-baseline gap-2 text-white">
            <span className="font-mono text-4xl font-black tabular-nums text-[var(--xt-color-gold-bright)]">{balance}</span>
            <span className="font-semibold text-[var(--xt-color-text-muted)]">XCoin</span>
          </div>

          <form onSubmit={handleBuy} className="space-y-3 mb-6">
            <div className="font-semibold text-[var(--xt-color-text)]">Bli XCoin</div>
            <p className="text-xs text-[var(--xt-color-text-subtle)]">
              Në prodhim, blerjet mund të jenë në pritje derisa admin t’i konfirmojë, përveç nëse përdoret auto-approve në server.
            </p>
            <input
              type="number"
              placeholder="Shuma"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="input"
              min="1"
              required
            />
            <button type="submit" className="btn btn-primary w-full">
              Bli XCoin
            </button>
          </form>

          <form onSubmit={handleWithdraw} className="space-y-3 mb-6">
            <div className="font-semibold text-[var(--xt-color-text)]">
              Tërhiq ({withdrawFeePct}% komision në tërheqje)
            </div>
            <p className="text-xs text-[var(--xt-color-text-subtle)]">
              Nga shuma që tërheq nga wallet zbatohet komisioni; shitjet në marketplace nuk kanë komision veçmas.
            </p>
            <input
              type="number"
              placeholder="Shuma"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="input"
              min="1"
              required
            />
            <button type="submit" className="btn btn-outline w-full">
              Tërhiq
            </button>
          </form>

          <form onSubmit={handleTransfer} className="space-y-3">
            <div className="font-semibold text-[var(--xt-color-text)]">Transfer te përdorues tjetër</div>
            <input
              type="number"
              placeholder="ID e marrësit"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="input"
              required
            />
            <input
              type="number"
              placeholder="Shuma"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              required
            />
            <button type="submit" className="btn btn-primary w-full">
              Transfero
            </button>
          </form>
        </div>

        <div className="xt-card space-y-6 p-4 sm:p-6">
          <div>
            <div className="font-semibold text-[var(--xt-color-text)] mb-1">Shitjet e mia (prano / refuzo)</div>
            <p className="text-xs text-[var(--xt-color-text-subtle)] mb-3">
              Kur pranon, XCoin transferohen. Deri atëherë porosia është pending.
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
                  <div className="flex justify-between gap-2 font-semibold text-[var(--xt-color-text)]">
                    <span>#{o.id} · {o.totalAmount} XCoin</span>
                    <span className="capitalize text-amber-600">{o.status}</span>
                  </div>
                  <p className="text-[var(--xt-color-text-muted)]">
                    Nga: <strong>{o.buyerName || `User #${o.userId}`}</strong>
                  </p>
                  <p className="text-[var(--xt-color-text-muted)]">{orderLinesText(o)}</p>
                  <p className="text-[var(--xt-color-text-muted)]">
                    {deliveryLabel(o.deliveryMethod)}
                    {o.buyerContact ? ` · ${o.buyerContact}` : ''}
                  </p>
                  {o.deliveryAddress ? (
                    <p className="text-[var(--xt-color-text-muted)]">Adresa: {o.deliveryAddress}</p>
                  ) : null}
                  {o.deliveryNotes ? (
                    <p className="text-[var(--xt-color-text-muted)]">Shënim: {o.deliveryNotes}</p>
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
                        className="btn btn-outline min-h-10 flex-1 disabled:opacity-50"
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
            <div className="font-semibold text-[var(--xt-color-text)] mb-3">Blerjet e mia</div>
            <div className="space-y-3 max-h-64 overflow-y-auto text-xs">
              {orders.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nuk ka porosi ende. Bli nga marketplace.</p>
              )}
              {orders.map((o) => (
                <div
                  key={`buy-${o.id}`}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-1"
                >
                  <div className="flex justify-between gap-2 font-semibold text-[var(--xt-color-text)]">
                    <span>#{o.id} · {o.totalAmount} XCoin</span>
                    <span className="capitalize">{o.status}</span>
                  </div>
                  <p className="text-[var(--xt-color-text-muted)]">
                    Shitësi: <strong>{o.sellerName || `User #${o.sellerId}`}</strong>
                  </p>
                  <p className="text-[var(--xt-color-text-muted)]">{orderLinesText(o)}</p>
                  <p className="text-[var(--xt-color-text-muted)]">
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
        <div className="mt-4 text-center text-sm text-[var(--xt-color-gold-bright)] bg-blue-50 dark:bg-blue-900/30 rounded-lg py-2 px-3">
          {message}
        </div>
      )}

      <div className="xt-card mt-5 p-4 sm:p-6">
        <div className="font-semibold text-[var(--xt-color-text)] mb-2">Historiku i transaksioneve</div>
        <div className="xt-table-wrap overflow-x-auto">
          <table className="xt-table min-w-[640px] text-xs">
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
                  <td className="px-2 py-1"><span className={`xt-badge ${transactionFlow(tx.type) === 'incoming' ? 'xt-badge-gold' : ''}`}>{transactionFlow(tx.type) === 'incoming' ? 'Hyrje' : transactionFlow(tx.type) === 'outgoing' ? 'Dalje' : 'Aktivitet'}</span><span className="ml-2 text-[var(--xt-color-text-subtle)]">{tx.type}</span></td>
                  <td className={`px-2 py-1 font-mono font-semibold tabular-nums ${transactionFlow(tx.type) === 'incoming' ? 'text-[var(--xt-color-success)]' : transactionFlow(tx.type) === 'outgoing' ? 'text-[var(--xt-color-warning)]' : 'text-[var(--xt-color-text)]'}`}>{transactionFlow(tx.type) === 'incoming' ? '+' : transactionFlow(tx.type) === 'outgoing' ? '−' : ''}{tx.amount} XCoin</td>
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
