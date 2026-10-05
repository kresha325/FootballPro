// Ndrysho statusin e një transaksioni XCoin (admin)
export const updateJonCoinTransactionStatus = async (id, status) => {
  const res = await API.patch(`/joncoin/transaction/${id}`, { status });
  return res.data;
};

import axios from 'axios';


const API = axios.create({ baseURL: import.meta.env.VITE_API_URL });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function newIdempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const getJonCoinBalance = async () => {
  try {
    const res = await API.get('/joncoin/balance');
    const d = res.data || {};
    return {
      balance: Number(d.balance) || 0,
      spendable: Number(d.spendable ?? d.balance) || 0,
      withdrawCommissionPercent: Number.isFinite(Number(d.withdrawCommissionPercent))
        ? Number(d.withdrawCommissionPercent)
        : 5,
      joncoinPerEur: Number(d.joncoinPerEur) || 1,
      marketplaceFeePercent: Number(d.marketplaceFeePercent) || 0,
      cardDepositsEnabled: Boolean(d.cardDepositsEnabled),
      currency: d.currency || 'JON',
    };
  } catch {
    return { balance: 0, spendable: 0, withdrawCommissionPercent: 5, joncoinPerEur: 1, marketplaceFeePercent: 0, cardDepositsEnabled: false, currency: 'JON' };
  }
};


export const getJonCoinTransactions = async () => {
  const res = await API.get('/joncoin/transactions');
  return res.data;
};


export const purchaseJonCoin = async (amount) => {
  const res = await API.post('/joncoin/purchase', { amount }, { headers: { 'Idempotency-Key': newIdempotencyKey('deposit') } });
  return res.data;
};


export const spendJonCoin = async (amount, relatedEntityType, relatedEntityId, description) => {
  const res = await API.post('/joncoin/spend', { amount, relatedEntityType, relatedEntityId, description });
  return res.data;
};


export const rewardJonCoin = async (userId, amount, description, relatedEntityType, relatedEntityId) => {
  const res = await API.post('/joncoin/reward', { userId, amount, description, relatedEntityType, relatedEntityId });
  return res.data;
};


export const withdrawJonCoin = async (amount) => {
  const res = await API.post('/joncoin/withdraw', { amount }, { headers: { 'Idempotency-Key': newIdempotencyKey('withdraw') } });
  return res.data;
};


export const transferJonCoin = async (toUserId, amount, description) => {
  const res = await API.post('/joncoin/transfer', { toUserId, amount, description }, { headers: { 'Idempotency-Key': newIdempotencyKey('transfer') } });
  return res.data;
};
