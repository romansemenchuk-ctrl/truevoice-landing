const assert=require('node:assert/strict');

function mockRes(){return{statusCode:0,body:null,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
async function run(env,{fetchImpl}={}){const old={...process.env},oldFetch=global.fetch;try{for(const k of ['VERCEL_ENV','ACADEMY_LEDGER_MODE','ACADEMY_LEDGER_URL','ACADEMY_LEDGER_SECRET','ACADEMY_LEDGER_VERCEL_BYPASS','WAYFORPAY_MERCHANT_ACCOUNT','WAYFORPAY_SECRET_KEY'])delete process.env[k];Object.assign(process.env,env);if(fetchImpl)global.fetch=fetchImpl;delete require.cache[require.resolve('./academy-health.js')];const handler=require('./academy-health.js');const res=mockRes();await handler({method:'GET'},res);return res;}finally{global.fetch=oldFetch;process.env=old;}}
(async()=>{
 let r=await run({VERCEL_ENV:'preview'},{fetchImpl:async()=>{throw Error('off_must_not_probe');}});
 assert.equal(r.statusCode,200);
 assert.deepEqual(r.body,{mode:'off',ledgerUrlConfigured:false,ledgerSecretConfigured:false,vercelBypassConfigured:false,wayForPayConfigured:false,bridgeReachable:false});

 const secret='x'.repeat(40),bypass='b'.repeat(40);let probe;
 r=await run({VERCEL_ENV:'preview',ACADEMY_LEDGER_MODE:'shadow',ACADEMY_LEDGER_URL:'https://academy.example/api/payment',ACADEMY_LEDGER_SECRET:secret,ACADEMY_LEDGER_VERCEL_BYPASS:bypass,WAYFORPAY_MERCHANT_ACCOUNT:'merchant',WAYFORPAY_SECRET_KEY:secret},{fetchImpl:async(url,opts)=>{probe={url,opts};return{ok:true,status:200,json:async()=>({ok:true})};}});
 assert.equal(r.statusCode,200);
 assert.deepEqual(r.body,{mode:'shadow',ledgerUrlConfigured:true,ledgerSecretConfigured:true,vercelBypassConfigured:true,wayForPayConfigured:true,bridgeReachable:true});
 assert.match(probe.url,/action=bridge-health/);
 assert.equal(probe.opts.method,'GET');
 assert.equal(probe.opts.headers.Authorization,'Bearer '+secret);
 assert.equal(probe.opts.headers['x-vercel-protection-bypass'],bypass);
 const serialized=JSON.stringify(r.body);
 assert.doesNotMatch(serialized,/academy\.example|merchant/);
 assert.doesNotMatch(serialized,new RegExp(secret));
 assert.doesNotMatch(serialized,new RegExp(bypass));

 r=await run({VERCEL_ENV:'preview',ACADEMY_LEDGER_MODE:'shadow',ACADEMY_LEDGER_URL:'https://academy.example/api/payment',ACADEMY_LEDGER_SECRET:secret,ACADEMY_LEDGER_VERCEL_BYPASS:bypass,WAYFORPAY_MERCHANT_ACCOUNT:'merchant',WAYFORPAY_SECRET_KEY:secret},{fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:'forbidden'})})});
 assert.equal(r.statusCode,200);
 assert.equal(r.body.bridgeReachable,false);

 r=await run({VERCEL_ENV:'production',ACADEMY_LEDGER_MODE:'required',ACADEMY_LEDGER_URL:'https://academy.example/api/payment',ACADEMY_LEDGER_SECRET:secret,ACADEMY_LEDGER_VERCEL_BYPASS:bypass,WAYFORPAY_MERCHANT_ACCOUNT:'merchant',WAYFORPAY_SECRET_KEY:secret},{fetchImpl:async()=>{throw Error('production_must_not_probe');}});
 assert.equal(r.statusCode,404);
 assert.deepEqual(r.body,{error:'not_found'});

 r=await run({VERCEL_ENV:'preview',ACADEMY_LEDGER_MODE:'invalid'});
 assert.equal(r.statusCode,503);
 assert.deepEqual(r.body,{error:'academy_ledger_bad_mode'});

 console.log('academy-health 5/5');
})().catch(err=>{console.error(err);process.exit(1);});
