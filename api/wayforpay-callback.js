// Vercel serverless function (Node.js).
//
// WayForPay's server-to-server callback (serviceUrl). This is the ONLY
// trustworthy confirmation that money actually arrived — the browser
// callbacks in the widget can be faked or simply never fire if the user
// closes the tab mid-payment. Access is granted from here, not from the
// front-end.
//
// Flow:
//   1. verify merchantSignature   (unsigned/forged callbacks are dropped)
//   2. answer WayForPay with a signed "accept" (they retry until we do)
//   3. hand the paid order to SendPulse so the bot can open access
//
// Signature WayForPay sends us — HMAC-MD5 over ";"-joined fields:
//   merchantAccount;orderReference;amount;currency;authCode;cardPan;
//   transactionStatus;reasonCode
//
// Signature we send back — HMAC-MD5 over:
//   orderReference;status;time
//
// Required env vars:
//   WAYFORPAY_MERCHANT_ACCOUNT, WAYFORPAY_SECRET_KEY
// Fulfilment (optional — without them the order is logged, not delivered):
//   SENDPULSE_CLIENT_ID, SENDPULSE_CLIENT_SECRET, SENDPULSE_BOOK_ID

const crypto = require('crypto');

const CALLBACK_SIGNATURE_FIELDS = [
  'merchantAccount',
  'orderReference',
  'amount',
  'currency',
  'authCode',
  'cardPan',
  'transactionStatus',
  'reasonCode',
];

/* WayForPay posts JSON, but some integrations arrive form-encoded with the
   whole JSON document sitting in the first key. Accept both shapes. */
function parseBody(raw) {
  let body = raw;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (e) {
      return {};
    }
  }
  if (body && typeof body === 'object') {
    const keys = Object.keys(body);
    if (keys.length === 1 && body[keys[0]] === '' && keys[0].trim().startsWith('{')) {
      try {
        return JSON.parse(keys[0]);
      } catch (e) {
        return body;
      }
    }
  }
  return body || {};
}

function hmacMd5(secret, message) {
  return crypto.createHmac('md5', secret).update(message, 'utf8').digest('hex');
}

/* Constant-time compare so a wrong signature cannot be brute-forced by
   timing the response. */
function signaturesMatch(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/* orderReference is minted as tv-<plan>-<ts>-<rand> by wayforpay-create.js */
function planFromReference(reference) {
  const m = /^tv-(base|pro|upgrade)-/.exec(String(reference || ''));
  return m ? m[1] : 'base';
}

async function sendPulseToken(id, secret) {
  const res = await fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!res.ok) throw new Error(`sendpulse_token_${res.status}`);
  const json = await res.json();
  if (!json.access_token) throw new Error('sendpulse_token_missing');
  return json.access_token;
}

/* Adds the buyer to the address book with the plan as a variable, which is
   what a SendPulse automation keys off to open the right package. */
async function fulfilViaSendPulse(order) {
  const id = process.env.SENDPULSE_CLIENT_ID;
  const secret = process.env.SENDPULSE_CLIENT_SECRET;
  const book = process.env.SENDPULSE_BOOK_ID;
  if (!id || !secret || !book) return { delivered: false, reason: 'sendpulse_not_configured' };

  const token = await sendPulseToken(id, secret);
  const res = await fetch(`https://api.sendpulse.com/addressbooks/${encodeURIComponent(book)}/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      emails: [
        {
          email: order.email,
          variables: {
            plan: order.plan,
            phone: order.phone,
            amount: order.amount,
            currency: order.currency,
            order_reference: order.orderReference,
          },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`sendpulse_add_${res.status}`);
  return { delivered: true };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const secretKey = process.env.WAYFORPAY_SECRET_KEY;
  if (!secretKey) {
    console.error('[wfp-callback] WAYFORPAY_SECRET_KEY is not set — cannot verify callbacks');
    return res.status(500).json({ error: 'not_configured' });
  }

  const data = parseBody(req.body);
  const orderReference = String(data.orderReference || '');

  if (!orderReference) {
    console.warn('[wfp-callback] payload without orderReference', data);
    return res.status(400).json({ error: 'bad_payload' });
  }

  // ── 1 · verify it really came from WayForPay ─────────────────────────
  const expected = hmacMd5(
    secretKey,
    CALLBACK_SIGNATURE_FIELDS.map((f) => (data[f] === undefined || data[f] === null ? '' : data[f])).join(';')
  );

  if (!signaturesMatch(expected, data.merchantSignature)) {
    // Do NOT acknowledge: an unsigned callback must never grant access.
    console.warn('[wfp-callback] signature mismatch', { orderReference });
    return res.status(400).json({ error: 'bad_signature' });
  }

  // ── 2 · acknowledge ──────────────────────────────────────────────────
  // WayForPay keeps retrying until it gets a signed accept. We answer as
  // soon as the signature checks out: a delivery problem on our side is
  // ours to fix and retrying the callback would not fix it.
  const time = Math.floor(Date.now() / 1000);
  const ack = {
    orderReference,
    status: 'accept',
    time,
    signature: hmacMd5(secretKey, [orderReference, 'accept', time].join(';')),
  };

  const status = String(data.transactionStatus || '');
  const order = {
    orderReference,
    plan: planFromReference(orderReference),
    status,
    amount: data.amount,
    currency: data.currency,
    email: String(data.email || data.clientEmail || '').trim(),
    phone: String(data.phone || data.clientPhone || '').trim(),
  };

  // ── 3 · only a real "Approved" opens access ──────────────────────────
  if (status !== 'Approved') {
    console.info('[wfp-callback] not approved, nothing to deliver', {
      orderReference, status, reasonCode: data.reasonCode,
    });
    return res.status(200).json(ack);
  }

  if (!order.email) {
    console.error('[wfp-callback] approved payment without an email — deliver manually', order);
    return res.status(200).json(ack);
  }

  try {
    const result = await fulfilViaSendPulse(order);
    if (result.delivered) {
      console.info('[wfp-callback] delivered', { orderReference, plan: order.plan, email: order.email });
    } else {
      // Loud on purpose: the customer has paid and is waiting.
      console.error('[wfp-callback] PAID BUT NOT DELIVERED —', result.reason, order);
    }
  } catch (err) {
    console.error('[wfp-callback] PAID BUT NOT DELIVERED —', err.message, order);
  }

  return res.status(200).json(ack);
};
