const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8').split('\n').filter(Boolean).reduce((acc, line) => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    acc[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return acc;
}, {});
const BASE_URL = env.SQUAD_API_BASE_URL || 'https://sandbox-api-d.squadco.com';
const KEY = env.SQUAD_SECRET_KEY;
const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: 'Bearer ' + KEY,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});
const endpoints = [
  '/transaction/mandate/banklists',
  '/transaction/banklists',
  '/transaction/bank/list',
  '/transaction/bank-list',
  '/bank/list',
  '/banklists',
  '/transaction/mandate/banks',
  '/transaction/mandate/bank-list',
  '/transaction/mandate/list',
  '/payout/bank-list',
  '/bank',
  '/banks',
  '/transaction/bank',
  '/transaction/banks',
  '/payout/bank',
  '/payout/banks',
];
(async () => {
  for (const ep of endpoints) {
    try {
      const res = await client.get(ep);
      console.log('OK', ep, res.status, JSON.stringify(res.data).slice(0, 300));
    } catch (err) {
      const status = err.response?.status || 'ERR';
      const data = err.response?.data || err.message;
      console.log('FAIL', ep, status, JSON.stringify(data).slice(0, 300));
    }
  }
})();
