// Vercel serverless function (Node.js).
//
// Signs a WayForPay order server-side so the merchant secret key never
// reaches the browser. The front-end (Popup in sections-c.jsx) POSTs
// { email, phone } here, gets back a signed payload, and passes it
// straight into the WayForPay Merchant Widget:
//
//   const wayforpay = new Wayforpay();
//   wayforpay.run(payload, onApproved, onDeclined, onPending);
//
// Signature algorithm (confirmed against WayForPay's own docs + reference
// implementations): HMAC-MD5, key = merchant secret key, message = the
// listed fields joined with ";" in this exact order:
//   merchantAccount;merchantDomainName;orderReference;orderDate;amount;
//   currency;productName(s);productCount(s);productPrice(s)
//
// Required env vars (set in Vercel → Project Settings → Environment
// Variables — see .env.example):
//   WAYFORPAY_MERCHANT_ACCOUNT
//   WAYFORPAY_SECRET_KEY
// Optional (sensible defaults below):
//   WAYFORPAY_DOMAIN, PRODUCT_NAME, PRODUCT_PRICE, PRODUCT_CURRENCY

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
  const secretKey = process.env.WAYFORPAY_SECRET_KEY;
  const domain = process.env.WAYFORPAY_DOMAIN || '7d.truevoice.academy';

  if (!merchantAccount || !secretKey) {
    // Fails soft with a clear reason instead of a raw 500 — the popup
    // shows a friendly "оплата тимчасово недоступна" message for this.
    return res.status(500).json({
      error: 'wayforpay_not_configured',
      message: 'WAYFORPAY_MERCHANT_ACCOUNT / WAYFORPAY_SECRET_KEY не задані у Vercel.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  if (phone.replace(/\D/g, '').length < 7) {
    return res.status(400).json({ error: 'invalid_phone' });
  }

  // WayForPay's widget lists clientFirstName/clientLastName as obligatory
  // client-side fields. Rather than adding a "name" field to the form
  // (extra friction), we derive a passable name from the email so the
  // widget's own validation never blocks checkout.
  const localPart = (email.split('@')[0] || 'client').replace(/[._-]+/g, ' ').trim();
  const nameParts = localPart.split(' ').filter(Boolean);
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const clientFirstName = cap(nameParts[0]) || 'Client';
  const clientLastName = nameParts.length > 1 ? nameParts.slice(1).map(cap).join(' ') : 'TrueVoice';

  // Prices live here, never in the browser: the client only names a plan.
  // Trusting a price from the request body would let anyone pay $0.01.
  const PLANS = {
    base: {
      price: Number(process.env.PRICE_BASE || 15),
      name: process.env.PRODUCT_NAME || 'TrueVoice 7D — 7 днів до живого звучання',
    },
    pro: {
      price: Number(process.env.PRICE_PRO || 25),
      name: 'TrueVoice 7D max — курс + групова Q&A-сесія',
    },
    // paid after the fact by BASE buyers who want the group session
    upgrade: {
      price: Number(process.env.PRICE_UPGRADE || 10),
      name: 'TrueVoice — апгрейд до 7D max',
    },
  };

  const planKey = Object.prototype.hasOwnProperty.call(PLANS, body.plan) ? body.plan : 'base';
  const plan = PLANS[planKey];

  const productName = plan.name;
  const currency = process.env.PRODUCT_CURRENCY || 'USD';
  const amount = plan.price;

  // plan is encoded in the reference so the payment webhook can tell
  // which package to unlock without a second lookup
  const orderReference = `tv-${planKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const orderDate = Math.floor(Date.now() / 1000);

  const productNameArr = [productName];
  const productCountArr = [1];
  const productPriceArr = [amount];

  const signatureString = [
    merchantAccount,
    domain,
    orderReference,
    orderDate,
    amount,
    currency,
    ...productNameArr,
    ...productCountArr,
    ...productPriceArr,
  ].join(';');

  const merchantSignature = crypto
    .createHmac('md5', secretKey)
    .update(signatureString, 'utf8')
    .digest('hex');

  return res.status(200).json({
    merchantAccount,
    merchantAuthType: 'SimpleSignature',
    merchantDomainName: domain,
    merchantSignature,
    orderReference,
    orderDate,
    amount,
    currency,
    productName: productNameArr,
    productCount: productCountArr,
    productPrice: productPriceArr,
    clientEmail: email,
    clientPhone: phone,
    clientFirstName,
    clientLastName,
    language: 'UA',
    plan: planKey,
  });
};
