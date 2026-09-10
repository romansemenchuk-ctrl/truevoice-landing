const assert=require('node:assert/strict');

function mockRes(){return{statusCode:0,body:null,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
async function run(env){const old={...process.env};try{for(const k of ['VERCEL_ENV','ACADEMY_LEDGER_MODE','ACADEMY_LEDGER_URL','ACADEMY_LEDGER_SECRET','WAYFORPAY_MERCHANT_ACCOUNT','WAYFORPAY_SECRET_KEY'])delete process.env[k];Object.assign(process.env,env);delete require.cache[require.resolve('./academy-health.js')];const handler=require('./academy-health.js');const res=mockRes();await handler({method:'GET'},res);return res;}finally{process.env=old;}}
(async()=>{
 let r=await run({VERCEL_ENV:'preview'});
 assert.equal(r.statusCode,200);
 assert.deepEqual(r.body,{mode:'off',ledgerUrlConfigured:false,ledgerSecretConfigured:false,wayForPayConfigured:false});

 const secret='x'.repeat(40);
 r=await run({VERCEL_ENV:'preview',ACADEMY_LEDGER_MODE:'shadow',ACADEMY_LEDGER_URL:'https://academy.example/api/payment',ACADEMY_LEDGER_SECRET:secret,WAYFORPAY_MERCHANT_ACCOUNT:'merchant',WAYFORPAY_SECRET_KEY:secret});
 assert.equal(r.statusCode,200);
 assert.deepEqual(r.body,{mode:'shadow',ledgerUrlConfigured:true,ledgerSecretConfigured:true,wayForPayConfigured:true});
 const serialized=JSON.stringify(r.body);
 assert.doesNotMatch(serialized,/academy\.example|merchant/);
 assert.doesNotMatch(serialized,new RegExp(secret));

 r=await run({VERCEL_ENV:'production',ACADEMY_LEDGER_MODE:'required',ACADEMY_LEDGER_URL:'https://academy.example/api/payment',ACADEMY_LEDGER_SECRET:secret,WAYFORPAY_MERCHANT_ACCOUNT:'merchant',WAYFORPAY_SECRET_KEY:secret});
 assert.equal(r.statusCode,404);
 assert.deepEqual(r.body,{error:'not_found'});

 r=await run({VERCEL_ENV:'preview',ACADEMY_LEDGER_MODE:'invalid'});
 assert.equal(r.statusCode,503);
 assert.deepEqual(r.body,{error:'academy_ledger_bad_mode'});

 console.log('academy-health 4/4');
})().catch(err=>{console.error(err);process.exit(1);});
