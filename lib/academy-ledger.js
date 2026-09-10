'use strict';
const MODES=new Set(['off','shadow','required']);
function config(env=process.env){const mode=String(env.ACADEMY_LEDGER_MODE||'off').toLowerCase();if(!MODES.has(mode))throw new Error('academy_ledger_bad_mode');return{mode,url:String(env.ACADEMY_LEDGER_URL||''),secret:String(env.ACADEMY_LEDGER_SECRET||''),vercelBypass:String(env.ACADEMY_LEDGER_VERCEL_BYPASS||'')};}
async function ledgerCall(action,payload,{env=process.env,fetchImpl=globalThis.fetch}={}){
 const c=config(env);if(c.mode==='off')return{ok:true,skipped:true,mode:'off'};
 if(!c.url||!c.secret||c.secret.length<32){const e=new Error('academy_ledger_not_configured');if(c.mode==='required')throw e;console.error('[academy-ledger] bridge unavailable',{action,code:e.message});return{ok:false,mode:c.mode,error:e.message};}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const join=c.url.includes('?')?'&':'?';
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+c.secret};
  if(c.vercelBypass)headers['x-vercel-protection-bypass']=c.vercelBypass;
  const r=await fetchImpl(c.url+join+'action='+encodeURIComponent(action),{method:'POST',headers,body:JSON.stringify(payload),signal:controller.signal});
  let body=null;try{body=await r.json();}catch{}
  if(!r.ok){const e=new Error('academy_ledger_http_'+r.status);if(c.mode==='required')throw e;console.error('[academy-ledger] bridge failed',{action,code:e.message});return{ok:false,mode:c.mode,error:e.message};}
  return{ok:true,mode:c.mode,result:body};
 }catch(err){if(c.mode==='required')throw err;console.error('[academy-ledger] bridge failed',{action,code:err.name==='AbortError'?'timeout':err.message});return{ok:false,mode:c.mode,error:err.name==='AbortError'?'timeout':err.message};}
 finally{clearTimeout(timer);}
}
module.exports={config,ledgerCall};
