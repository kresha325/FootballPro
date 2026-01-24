import axios from 'axios';

export const getJonCoinBalance = async (userId) => {
  try {
    const res = await axios.get(`/api/joncoin/balance`, {
      headers: { 'X-User-Id': userId }
    });
    return res.data.balance;
  } catch {
    return 0;
  }
};
