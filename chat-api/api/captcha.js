// GET -> a fresh proof-of-work challenge for the lead form (see lib/captcha.js).

const { createChallenge } = require('../lib/captcha');

const ALLOWED_ORIGIN = 'https://hahealthconsulting.com';

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const challenge = createChallenge();
  if (!challenge) {
    res.status(503).json({ error: 'Captcha is not configured' });
    return;
  }
  res.status(200).json(challenge);
};
