// Ndrysho statusin e një transaksioni JonCoin (admin)
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

export const getJonCoinBalance = async () => {
  try {
    const res = await API.get('/joncoin/balance');
    return res.data.balance;
  } catch {
    return 0;
  }
};


export const getJonCoinTransactions = async () => {
  const res = await API.get('/joncoin/transactions');
  return res.data;
};


export const purchaseJonCoin = async (amount) => {
  const res = await API.post('/joncoin/purchase', { amount });
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
  const res = await API.post('/joncoin/withdraw', { amount });
  return res.data;
};


export const transferJonCoin = async (toUserId, amount, description) => {
  const res = await API.post('/joncoin/transfer', { toUserId, amount, description });
  return res.data;
};
