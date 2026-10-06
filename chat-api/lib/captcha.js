// Self-hosted proof-of-work captcha (same idea as ALTCHA / Friendly Captcha).
// No third-party account, no tracking cookies, no image puzzles.
//
// The server hands out a challenge: a random salt plus SHA-256(salt + n) for a
// secret random n below MAX_NUMBER. The browser has to find n by brute force
// (about a second on a phone), which is cheap for one real visitor and
// expensive for a bot sending thousands of forms. The challenge is HMAC-signed
// and expires, so it cannot be forged or saved up, and each solved challenge
// is accepted once per warm instance.
//
// Requires CAPTCHA_SECRET (any long random string) as a Vercel env var.

const crypto = require('crypto');

const MAX_NUMBER = 60000;
const TTL_MS = 20 * 60 * 1000; // a visitor can take a while to fill in the form
const MIN_SOLVE_MS = 1500; // nobody reads and fills the form faster than this

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sign = (secret, s) => crypto.createHmac('sha256', secret).update(s).digest('hex');

function getSecret() {
  return process.env.CAPTCHA_SECRET || '';
}

function createChallenge(now = Date.now()) {
  const secret = getSecret();
  if (!secret) return null;
  const issued = now;
  const salt = `${crypto.randomBytes(12).toString('hex')}.${issued}`;
  const number = crypto.randomInt(0, MAX_NUMBER);
  const challenge = sha256(salt + number);
  return { algorithm: 'SHA-256', salt, challenge, maxnumber: MAX_NUMBER, signature: sign(secret, challenge) };
}

const used = new Map(); // challenge -> expiry, per warm instance
function markUsed(challenge, now) {
  for (const [k, exp] of used) if (exp < now) used.delete(k);
  if (used.has(challenge)) return false;
  used.set(challenge, now + TTL_MS);
  return true;
}

// Returns { ok: true } or { ok: false, reason }.
function verifySolution(solution, now = Date.now()) {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: 'not-configured' };
  if (!solution || typeof solution !== 'object') return { ok: false, reason: 'missing' };

  const { salt, challenge, signature } = solution;
  const number = Number(solution.number);
  if (typeof salt !== 'string' || typeof challenge !== 'string' || typeof signature !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  if (!Number.isInteger(number) || number < 0 || number > MAX_NUMBER) return { ok: false, reason: 'malformed' };

  const expected = sign(secret, challenge);
  if (signature.length !== expected.length
    || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return { ok: false, reason: 'bad-signature' };
  }
  if (sha256(salt + number) !== challenge) return { ok: false, reason: 'wrong-answer' };

  const issued = Number(salt.split('.')[1]);
  if (!Number.isFinite(issued) || now - issued > TTL_MS) return { ok: false, reason: 'expired' };
  if (now - issued < MIN_SOLVE_MS) return { ok: false, reason: 'too-fast' };
  if (!markUsed(challenge, now)) return { ok: false, reason: 'reused' };
  return { ok: true };
}

module.exports = { createChallenge, verifySolution, MAX_NUMBER };
