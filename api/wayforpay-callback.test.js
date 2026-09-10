const {test,after}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const originalFetch=global.fetch,originalEnv={...process.env};
process.env.WAYFORPAY_SECRET_KEY='test_secret_key';process.env.WAYFORPAY_MERCHANT_ACCOUNT='test_merchant';
const handler=require('./wayforpay-callback.js'),SECRET='test_secret_key';
const sign=fields=>crypto.createHmac('md5',SECRET).update(fields.join(';'),'utf8').digest('hex');
function res(){return{code:0,body:null,headers:{},status(n){this.code=n;return this;},json(b){this.body=b;return this;},setHeader(k,v){this.headers[k]=v;}};}
function payload(over={}){const p={merchantAccount:'test_merchant',orderReference:'tv-pro-1700000000-abc123',amount:25,currency:'USD',authCode:'123456',cardPan:'44**** ****1111',transactionStatus:'Approved',reasonCode:1100,email:'buyer@example.com',phone:'+380931234567',...over};p.merchantSignature=sign([p.merchantAccount,p.orderReference,p.amount,p.currency,p.authCode,p.cardPan,p.transactionStatus,p.reasonCode]);return p;}
async function run(body=payload(),method='POST'){const r=res();await handler({method,body},r);return r;}
function ledger(mode){process.env.ACADEMY_LEDGER_MODE=mode;process.env.ACADEMY_LEDGER_URL='https://academy.example/api/payments';process.env.ACADEMY_LEDGER_SECRET='z'.repeat(40);}

test('valid Approved callback returns signed accept',async()=>{ledger('off');const r=await run();assert.equal(r.code,200);assert.equal(r.body.status,'accept');assert.equal(r.body.signature,sign([r.body.orderReference,'accept',r.body.time]));});
test('forged signature is rejected',async()=>{ledger('off');const p=payload();p.merchantSignature='deadbeef'.repeat(4);const r=await run(p);assert.equal(r.code,400);assert.notEqual(r.body.status,'accept');});
test('tampered amount breaks signature',async()=>{ledger('off');const p=payload();p.amount=1;const r=await run(p);assert.equal(r.code,400);});
test('Declined is acknowledged without SendPulse delivery',async()=>{ledger('off');const r=await run(payload({transactionStatus:'Declined',reasonCode:1101}));assert.equal(r.code,200);assert.equal(r.body.status,'accept');});
test('form-encoded body with JSON key is accepted',async()=>{ledger('off');const asKey={};asKey[JSON.stringify(payload())]='';const r=await run(asKey);assert.equal(r.code,200);});
test('GET is refused',async()=>{ledger('off');const r=await run(undefined,'GET');assert.equal(r.code,405);});
test('shadow ledger failure preserves current callback behavior',async()=>{ledger('shadow');global.fetch=async()=>({ok:false,status:503,json:async()=>({error:'down'})});const r=await run();assert.equal(r.code,200);assert.equal(r.body.status,'accept');});
test('required ledger failure stays retryable and does not accept',async()=>{ledger('required');global.fetch=async()=>({ok:false,status:503,json:async()=>({error:'down'})});const r=await run();assert.equal(r.code,503);assert.equal(r.body.error,'academy_ledger_unavailable');});
test('provider-event bridge never forwards callback buyer email',async()=>{ledger('required');let sent;global.fetch=async(url,opts)=>{sent={url,body:JSON.parse(opts.body)};return{ok:true,status:200,json:async()=>({ok:true})};};const r=await run(payload({email:'attacker@example.test'}));assert.equal(r.code,200);assert.match(sent.url,/action=provider-event/);assert.equal(Object.hasOwn(sent.body,'email'),false);assert.equal(Object.hasOwn(sent.body,'clientEmail'),false);assert.equal(Object.hasOwn(sent.body,'buyerEmail'),false);assert.equal(sent.body.orderReference,'tv-pro-1700000000-abc123');});
after(()=>{global.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in originalEnv))delete process.env[k];Object.assign(process.env,originalEnv);});
