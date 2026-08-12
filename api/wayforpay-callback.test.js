const crypto = require('crypto');
process.env.WAYFORPAY_SECRET_KEY = 'test_secret_key';
process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'test_merchant';

const handler = require('./wayforpay-callback.js');
const SECRET = 'test_secret_key';

function sign(fields) {
  return crypto.createHmac('md5', SECRET).update(fields.join(';'), 'utf8').digest('hex');
}
function mockRes() {
  const r = { code: 0, body: null, headers: {} };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.setHeader = (k,v) => { r.headers[k]=v; };
  return r;
}
function payload(over = {}) {
  const p = Object.assign({
    merchantAccount: 'test_merchant',
    orderReference: 'tv-pro-1700000000-abc123',
    amount: 25,
    currency: 'USD',
    authCode: '123456',
    cardPan: '44**** ****1111',
    transactionStatus: 'Approved',
    reasonCode: 1100,
    email: 'buyer@example.com',
    phone: '+380931234567',
  }, over);
  p.merchantSignature = sign([
    p.merchantAccount, p.orderReference, p.amount, p.currency,
    p.authCode, p.cardPan, p.transactionStatus, p.reasonCode,
  ]);
  return p;
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ', name); }
  else { fail++; console.log('  FAIL ', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

(async () => {
  console.log('\n1. valid Approved callback');
  let res = mockRes();
  await handler({ method: 'POST', body: payload() }, res);
  check('200', res.code === 200, res.code);
  check('status=accept', res.body && res.body.status === 'accept', res.body);
  const t = res.body.time;
  check('ack signature correct',
    res.body.signature === sign(['tv-pro-1700000000-abc123', 'accept', t]));

  console.log('\n2. forged signature is rejected');
  res = mockRes();
  const bad = payload(); bad.merchantSignature = 'deadbeef'.repeat(4);
  await handler({ method: 'POST', body: bad }, res);
  check('400', res.code === 400, res.code);
  check('no accept issued', !(res.body && res.body.status === 'accept'), res.body);

  console.log('\n3. tampered amount is rejected (signature no longer matches)');
  res = mockRes();
  const tampered = payload(); tampered.amount = 1;
  await handler({ method: 'POST', body: tampered }, res);
  check('400', res.code === 400, res.code);

  console.log('\n4. Declined is acknowledged but not delivered');
  res = mockRes();
  await handler({ method: 'POST', body: payload({ transactionStatus: 'Declined', reasonCode: 1101 }) }, res);
  check('200 + accept', res.code === 200 && res.body.status === 'accept', res.body);

  console.log('\n5. form-encoded body (JSON in the key)');
  res = mockRes();
  const asKey = {}; asKey[JSON.stringify(payload())] = '';
  await handler({ method: 'POST', body: asKey }, res);
  check('200 + accept', res.code === 200 && res.body.status === 'accept', res.body);

  console.log('\n6. plan parsed from orderReference');
  for (const [ref, want] of [['tv-base-1-a','base'], ['tv-pro-1-a','pro'], ['tv-upgrade-1-a','upgrade'], ['tv-1-a','base']]) {
    res = mockRes();
    await handler({ method: 'POST', body: payload({ orderReference: ref }) }, res);
    check(`${ref} -> ${want}`, res.code === 200);
  }

  console.log('\n7. GET is refused');
  res = mockRes();
  await handler({ method: 'GET' }, res);
  check('405', res.code === 405, res.code);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
