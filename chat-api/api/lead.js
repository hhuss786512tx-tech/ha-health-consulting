// Vercel Node serverless function — replaces send-lead.php's PHP mail()
// dependency with Resend, for the same reason chat.js replaced
// chat-assistant.php: this cPanel host's .htaccess denies every .php file
// except send-lead.php by name, and our own automation can't push a new
// .php file to that host anyway. Moving the whole endpoint off PHP removes
// the dependency on that allowlist entirely.
//
// Requires RESEND_API_KEY as a Vercel env var, and hahealthconsulting.com
// verified as a sending domain in Resend (Domains -> add domain -> add the
// DNS records it gives you wherever this domain's DNS is managed).
//
// Logic is a straight port of send-lead.php: same required fields, same
// honeypot field name, same deterministic lead-scoring rules, same two
// emails (staff notification + lead auto-reply).

const ALLOWED_ORIGIN = 'https://hahealthconsulting.com';
const NOTIFY_TO = 'info@hahealthconsulting.com';
const NOTIFY_CC = 'mo@hahealthconsulting.com';
const FROM_NOTIFY = 'H&A Healthcare Consulting Website <website@hahealthconsulting.com>';
const FROM_AUTOREPLY = 'H&A Healthcare Consulting <info@hahealthconsulting.com>';

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Best-effort per-instance rate limit (resets on cold start), same
// trade-off as chat.js — good enough to blunt abuse without external
// storage for a contact form.
const hits = new Map();
function isRateLimited(ip, maxPerWindow = 5, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= maxPerWindow) return true;
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

function fail(res, status, message) {
  res.status(status).json({ success: false, error: message });
}

function cleanField(value, maxLength) {
  const v = String(value == null ? '' : value).trim().replace(/[\r\n]/g, ' ');
  return v.slice(0, maxLength);
}

const HIGH_VALUE_INTERESTS = ['Medical Billing & RCM', 'EHR Optimization', 'Compliance & Regulatory'];
const URGENT_TERMS = ['urgent', 'asap', 'as soon as possible', 'right away', 'immediately', 'this week', 'today'];
const SCALE_TERMS = ['multiple locations', 'several providers', 'multi-location', 'practice group', 'health system'];

function scoreLead(interest, message) {
  let score = 0;
  if (HIGH_VALUE_INTERESTS.includes(interest)) score += 2;
  else if (interest && interest !== 'Not sure yet') score += 1;

  const len = message.trim().length;
  if (len >= 200) score += 2;
  else if (len >= 40) score += 1;

  const lower = message.toLowerCase();
  if (URGENT_TERMS.some((t) => lower.includes(t))) score += 2;
  if (SCALE_TERMS.some((t) => lower.includes(t))) score += 1;

  if (score >= 5) return { label: 'HOT', score };
  if (score >= 3) return { label: 'WARM', score };
  return { label: 'STANDARD', score };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    fail(res, 405, 'Method not allowed');
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (isRateLimited(ip)) {
    fail(res, 429, 'Too many requests. Please try again in a little while, or call us at (832) 800-4352.');
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: real visitors never fill this in. Bots that do get a fake
  // success without an email actually being sent.
  if (body.company_website) {
    res.status(200).json({ success: true });
    return;
  }

  const name = cleanField(body.name, 200);
  const email = cleanField(body.email, 200);
  const phone = cleanField(body.phone, 50);
  const interest = cleanField(body.interest, 200);
  const message = cleanField(body.message, 2000);

  if (!name || !email || !phone) {
    fail(res, 400, 'Name, email, and phone are required.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(res, 400, 'Please enter a valid email address.');
    return;
  }

  const leadScore = scoreLead(interest, message);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    fail(res, 502, 'We could not send your message right now. Please call us at (832) 800-4352.');
    return;
  }

  const replyToName = name.replace(/["<>]/g, '');
  const notifyText = `New lead submitted through hahealthconsulting.com\n\n`
    + `Priority: ${leadScore.label} (score ${leadScore.score})\n\n`
    + `Name: ${name}\n`
    + `Email: ${email}\n`
    + `Phone: ${phone}\n`
    + `Area of interest: ${interest || 'Not specified'}\n`
    + `Message: ${message || '(none)'}\n\n`
    + `Submitted: ${new Date().toISOString()}\n`
    + `Source page: ${cleanField(req.headers.referer, 300) || 'unknown'}\n`;

  const autoReplyText = `Hi ${name},\n\n`
    + `Thanks for reaching out to H&A Healthcare Consulting`
    + (interest && interest !== 'Not sure yet' ? ` about ${interest}` : '') + `. `
    + `We've received your request and someone from our team will be in touch shortly, usually within one business day.\n\n`
    + `If your request is time-sensitive, you can also reach us directly at (832) 800-4352.\n\n`
    + `Talk soon,\n`
    + `H&A Healthcare Consulting\n`
    + `20008 Champion Forest Dr #203, Spring, TX 77379\n`;

  const send = (payload) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

  try {
    const notifyRes = await send({
      from: FROM_NOTIFY,
      to: NOTIFY_TO,
      cc: NOTIFY_CC,
      reply_to: `"${replyToName}" <${email}>`,
      subject: `[${leadScore.label}] New Lead - H&A Healthcare Consulting Website`,
      text: notifyText,
    });

    if (!notifyRes.ok) {
      const errText = await notifyRes.text().catch(() => '');
      console.error('lead notify failed', notifyRes.status, errText.slice(0, 500));
      fail(res, 502, 'We could not send your message right now. Please call us at (832) 800-4352.');
      return;
    }

    // Auto-reply is best-effort — the staff notification above already
    // succeeded, which is what matters most. Must be awaited: a serverless
    // function's execution context can be frozen the instant the response
    // is sent, so an un-awaited fire-and-forget call here would frequently
    // never actually reach the network (confirmed in testing — the
    // notification sent every time, the auto-reply never did until this
    // was awaited).
    try {
      await send({ from: FROM_AUTOREPLY, to: email, subject: 'Thanks for reaching out to H&A Healthcare Consulting', text: autoReplyText });
    } catch (err) {
      console.error('lead auto-reply failed', err);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('lead error', err);
    fail(res, 502, 'We could not send your message right now. Please call us at (832) 800-4352.');
  }
};
