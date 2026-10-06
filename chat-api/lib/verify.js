// Email and phone checks for the lead form. Everything here is free and runs
// locally (DNS lookup + the libphonenumber database), no paid verification API.
//
// Rule of thumb: only hard-block on something that is definitely wrong
// (bad format, a domain that does not exist, a throwaway inbox, a number that
// cannot exist). Anything inconclusive, such as a DNS timeout, lets the lead
// through: losing a real lead is worse than letting one junk lead in.

const dns = require('dns').promises;
const { parsePhoneNumberFromString } = require('libphonenumber-js/max');

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

// Throwaway / temporary inboxes. Not exhaustive, covers the common ones.
const DISPOSABLE = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com', 'anonaddy.me', 'burnermail.io',
  'discard.email', 'dispostable.com', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net',
  'getairmail.com', 'getnada.com', 'guerrillamail.biz', 'guerrillamail.com', 'guerrillamail.de',
  'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'harakirimail.com', 'inboxbear.com', 'incognitomail.org', 'jetable.org', 'mail.tm', 'mailcatch.com',
  'maildrop.cc', 'mailinator.com', 'mailinator.net', 'mailnesia.com', 'mailpoof.com', 'mintemail.com',
  'mohmal.com', 'moakt.com', 'mytemp.email', 'nada.email', 'sharklasers.com', 'spam4.me',
  'spamgourmet.com', 'temp-mail.io', 'temp-mail.org', 'tempail.com', 'tempmail.com', 'tempmail.dev',
  'tempmail.net', 'tempmailo.com', 'tempr.email', 'throwawaymail.com', 'trashmail.com', 'trashmail.de',
  'trashmail.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net', 'grr.la', 'pokemail.net', 'emailfake.com',
  'tmpmail.org', 'tmpmail.net', 'linshiyouxiang.net', 'byom.de', 'minuteinbox.com', 'luxusmail.org',
]);

// Reserved / obviously fake domains.
const FAKE_DOMAINS = new Set(['example.com', 'example.org', 'example.net', 'test.com', 'test.test', 'email.com', 'domain.com', 'abc.com', 'asdf.com']);

// Common misspellings people actually type. Suggest, never silently change.
const TYPOS = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmaill.com': 'gmail.com',
  'gmal.com': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.comm': 'gmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yhoo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outlook.co': 'outlook.com', 'outlook.con': 'outlook.com', 'outloo.com': 'outlook.com',
  'icloud.co': 'icloud.com', 'iclod.com': 'icloud.com', 'icoud.com': 'icloud.com',
  'aol.co': 'aol.com', 'aol.con': 'aol.com', 'att.ner': 'att.net', 'comcast.ner': 'comcast.net', 'sbcglobal.ner': 'sbcglobal.net',
};

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// 'ok' = domain can receive mail, 'dead' = definitely cannot, 'unknown' = could not tell.
async function domainAcceptsMail(domain, timeoutMs = 2500) {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), timeoutMs);
    if (!mx.length) return 'dead';
    // RFC 7505 "null MX": the domain explicitly says it takes no mail.
    if (mx.length === 1 && (mx[0].exchange === '' || mx[0].exchange === '.')) return 'dead';
    return 'ok';
  } catch (err) {
    if (err.code === 'ENOTFOUND') return 'dead';
    if (err.code === 'ENODATA') {
      // No MX record: mail falls back to the A record (RFC 5321).
      try {
        const a = await withTimeout(dns.resolve4(domain), timeoutMs);
        return a.length ? 'ok' : 'dead';
      } catch (e) {
        return e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? 'dead' : 'unknown';
      }
    }
    return 'unknown';
  }
}

// Returns { ok, email, error?, suggestion?, flags[] }.
async function verifyEmail(raw) {
  const email = String(raw || '').trim();
  const flags = [];
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, email, error: 'Please enter a valid email address.', flags };
  }
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (local.length > 64) return { ok: false, email, error: 'Please enter a valid email address.', flags };

  if (TYPOS[domain]) {
    const suggestion = `${local}@${TYPOS[domain]}`;
    return { ok: false, email, suggestion, error: `Did you mean ${suggestion}? Please check your email address.`, flags };
  }
  if (FAKE_DOMAINS.has(domain)) {
    return { ok: false, email, error: 'Please use your real email address so we can reply.', flags };
  }
  if (DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`))) {
    return { ok: false, email, error: 'Temporary email addresses are not accepted. Please use your work or personal email.', flags };
  }

  const mail = await domainAcceptsMail(domain);
  if (mail === 'dead') {
    return { ok: false, email, error: `The email domain "${domain}" does not accept email. Please check the address.`, flags };
  }
  if (mail === 'unknown') flags.push('email domain could not be checked');
  return { ok: true, email: `${local}@${domain}`, flags };
}

// Returns { ok, phone (E.164 when valid), display, error?, flags[] }.
function verifyPhone(raw) {
  const input = String(raw || '').trim();
  const flags = [];
  const digits = input.replace(/\D/g, '');
  const bad = { ok: false, phone: input, error: 'Please enter a valid phone number so we can reach you.', flags };
  if (digits.length < 7 || digits.length > 15) return bad;
  if (/^(\d)\1+$/.test(digits.slice(-10))) return bad; // 0000000000, 1111111111 ...

  const parsed = parsePhoneNumberFromString(input, 'US');
  if (!parsed || !parsed.isValid()) return bad;

  const national = parsed.nationalNumber;
  if (parsed.countryCallingCode === '1') {
    // 555-0100 through 555-0199 are reserved for movies and examples.
    if (/^\d{3}55501\d\d$/.test(national)) return bad;
    if (national === '1234567890' || national === '0123456789') return bad;
  }

  const type = parsed.getType();
  if (type === 'PREMIUM_RATE' || type === 'SHARED_COST') return bad;
  if (type === 'TOLL_FREE') flags.push('toll-free number');
  if (type === 'VOIP') flags.push('VoIP number');
  if (parsed.country && parsed.country !== 'US') flags.push(`non-US number (${parsed.country})`);

  return { ok: true, phone: parsed.number, display: parsed.formatNational(), flags };
}

module.exports = { verifyEmail, verifyPhone, domainAcceptsMail };
