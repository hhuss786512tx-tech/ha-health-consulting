// Vercel Node serverless function — proxies the H&A Assistant chat widget to
// Gemini so the API key never reaches the browser. Lives off the cPanel host
// entirely: hahealthconsulting.com's WAF blocks every PHP file on that
// server regardless of content (confirmed via a rename test — a renamed
// copy of the same file also 403'd instantly), so the working proxy has to
// run somewhere else. This is a straight port of chat-assistant.php's logic
// — same system prompt, same response shape ({success, reply} /
// {success:false, error}) — so the widget's fetch call only needs a new URL.

const { forwardInBackground, cleanKey, cleanString, hasPrivacySignal } = require('../lib/crm');

const GEMINI_MODEL = 'gemini-3.6-flash';
const ALLOWED_ORIGIN = 'https://hahealthconsulting.com';

const SYSTEM_INSTRUCTION = `You are the H&A Assistant, a helpful chat assistant embedded on the website
of H&A Healthcare Consulting, a Houston-based company that works
EXCLUSIVELY inside eClinicalWorks (eCW) — no other EHR platforms.

Facts you can use (do not invent others):
- 20+ years of combined healthcare industry experience.
- Services: eClinicalWorks implementation & optimization, go-live support,
  migrations, lab/radiology interfacing; Medical Billing & Revenue Cycle
  Management (an in-house team of 150+ billing specialists); Telemedicine
  Integration; Compliance & Regulatory (HIPAA, HITECH, MACRA/MIPS); Practice
  Transformation/workflow optimization; IT Support & Managed Services.
- Official partner of Riceland Healthcare (Southeast Texas integrated
  healthcare network, "Complete Care, Close to Home").
- Founder & Chairman: Tahir Javed. President & Founder: Eddie Zakaria. CTO:
  Muhammad "Sajj" Sultan.
- Phone (832) 800-4352, email info@hahealthconsulting.com, Spring, TX.

Rules:
- Keep replies short — 2-4 sentences, this is a small chat widget, not an
  essay. No markdown formatting (no asterisks, no headers).
- Never invent pricing. If asked about cost, say it depends on practice
  size/needs and the fastest way to get a real number is a free consultation.
- Never discuss or imply anything about EHR platforms other than eCW.
- When a conversation reaches a natural point to suggest next steps, invite
  them to schedule a free consultation — but don't do this in every single
  reply, only when it's a genuinely good moment (they asked something you've
  now answered, or they show buying interest).
- Never use em dashes or en dashes in replies; use commas, periods, or parentheses instead.
- If asked something with no relation to healthcare IT/billing/H&A at all,
  briefly and politely redirect back to what you can help with.`;

// Gemini occasionally answers 429/503 ("high demand") for a few seconds at a time.
// One quick retry turns most of those into a normal reply; more than one would
// risk the function's time limit and leave the visitor waiting.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
async function callGemini(url, init) {
  const attempt = async () => {
    try {
      return await fetch(url, init);
    } catch (err) {
      console.error('chat-api Gemini network error', err && err.name);
      return null;
    }
  };
  let res = await attempt();
  if (!res || RETRYABLE_STATUSES.has(res.status)) {
    if (res) console.error('chat-api Gemini transient error', res.status, '- retrying once');
    await new Promise((resolve) => setTimeout(resolve, 700));
    res = await attempt();
  }
  return res;
}

// Best-effort per-instance rate limit (resets on cold start — Vercel
// functions have no persistent filesystem across invocations the way the
// old PHP proxy did). Good enough to blunt a runaway loop against the free
// tier without adding external storage for a chat widget.
const hits = new Map();
function isRateLimited(ip, maxPerWindow = 20, windowMs = 24 * 60 * 60 * 1000) {
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
    fail(res, 429, "You've reached today's chat limit. Call us at (832) 800-4352 or schedule a free consultation and we'll pick up right where this left off.");
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const userMessage = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
  if (!userMessage) {
    fail(res, 400, 'Missing message.');
    return;
  }

  // Log-only turn: the widget answered locally (e.g. a booking request that goes
  // straight to the lead form), so nothing is sent to Gemini. This only records the
  // exchange in the CRM, and never for visitors sending a privacy signal.
  if (body.logOnly === true) {
    const crm = body.crm && typeof body.crm === 'object' ? body.crm : {};
    const conversationKey = cleanKey(crm.conversationKey);
    const localReply = typeof body.reply === 'string' ? body.reply.trim().slice(0, 1000) : '';
    if (conversationKey && localReply && !hasPrivacySignal(req)) {
      forwardInBackground('/api/ingest/chat', {
        visitorKey: cleanKey(crm.visitorKey),
        sessionKey: cleanKey(crm.sessionKey),
        conversationKey,
        pagePath: cleanString(crm.pagePath, 300),
        topic: cleanString(crm.topic, 120),
        visitorMessage: userMessage,
        assistantReply: localReply,
      });
    }
    res.status(200).json({ success: true });
    return;
  }

  const contents = [];
  if (Array.isArray(body.history)) {
    for (const turn of body.history.slice(-12)) {
      if (!turn || !turn.role || !turn.text) continue;
      const role = turn.role === 'model' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: String(turn.text).slice(0, 1000) }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fail(res, 502, 'Assistant is temporarily unavailable. Please try again or call (832) 800-4352.');
    return;
  }

  try {
    const upstream = await callGemini(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 220,
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
        }),
      }
    );

    if (!upstream || !upstream.ok) {
      const errText = upstream ? await upstream.text().catch(() => '') : '';
      console.error('chat-api Gemini error', upstream ? upstream.status : 'no response', errText.slice(0, 500));
      fail(res, 502, 'Assistant is temporarily unavailable. Please try again or call (832) 800-4352.');
      return;
    }

    const data = await upstream.json();
    const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();

    if (!reply) {
      fail(res, 502, 'Assistant is temporarily unavailable. Please try again or call (832) 800-4352.');
      return;
    }

    res.status(200).json({ success: true, reply });

    // Log the turn to the CRM after the visitor already has their answer.
    const crm = body.crm && typeof body.crm === 'object' ? body.crm : {};
    const conversationKey = cleanKey(crm.conversationKey);
    if (conversationKey && !hasPrivacySignal(req)) {
      forwardInBackground('/api/ingest/chat', {
        visitorKey: cleanKey(crm.visitorKey),
        sessionKey: cleanKey(crm.sessionKey),
        conversationKey,
        pagePath: cleanString(crm.pagePath, 300),
        topic: cleanString(crm.topic, 120),
        visitorMessage: userMessage,
        assistantReply: reply,
      });
    }
  } catch (err) {
    console.error('chat-api error', err);
    fail(res, 502, 'Assistant is temporarily unavailable. Please try again or call (832) 800-4352.');
  }
};
