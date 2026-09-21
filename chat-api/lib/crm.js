// Forwards chat turns and leads to the H&A CRM (receptionist-crm) so the team
// can see conversations and website leads. Best-effort by design: it never
// blocks or breaks the visitor-facing response, and does nothing until the
// three CRM_* env vars are set.
//
// Requests are signed: HMAC-SHA256 over `${timestamp}.${rawBody}` with the
// client's ingest secret, so the CRM can reject forged or replayed calls.

const crypto = require('crypto');
const { waitUntil } = require('@vercel/functions');

const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

function cleanKey(value) {
  return typeof value === 'string' && KEY_RE.test(value) ? value : null;
}

function cleanString(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : null;
}

async function forwardToCrm(path, payload, timeoutMs = 5000) {
  const base = process.env.CRM_INGEST_URL;
  const siteKey = process.env.CRM_SITE_KEY;
  const secret = process.env.CRM_INGEST_SECRET;
  if (!base || !siteKey || !secret) return false;

  const raw = JSON.stringify(payload);
  const ts = String(Date.now());
  const signature = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-site-key': siteKey, 'x-timestamp': ts, 'x-signature': signature },
      body: raw,
      signal: controller.signal,
    });
    if (!res.ok) console.error('crm forward rejected', path, res.status);
    return res.ok;
  } catch (err) {
    console.error('crm forward failed', path, err && err.name);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Run after the response has been sent, without holding the visitor up.
function forwardInBackground(path, payload) {
  const work = forwardToCrm(path, payload);
  try {
    waitUntil(work);
  } catch {
    // waitUntil is unavailable outside Vercel (e.g. local dev); the promise still runs.
  }
}

// True when the visitor's browser sends Do Not Track or Global Privacy Control.
// Those visitors' chats and visit links must not be logged.
function hasPrivacySignal(req) {
  const h = (req && req.headers) || {};
  return h['dnt'] === '1' || h['sec-gpc'] === '1';
}

module.exports = { forwardInBackground, forwardToCrm, cleanKey, cleanString, hasPrivacySignal };
