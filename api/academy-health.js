'use strict';
const {config}=require('../lib/academy-ledger.js');

module.exports=async(req,res)=>{
 res.setHeader?.('Cache-Control','private, no-store, max-age=0');
 if(process.env.VERCEL_ENV==='production')return res.status(404).json({error:'not_found'});
 if(req.method!=='GET'){
  res.setHeader?.('Allow','GET');
  return res.status(405).json({error:'method_not_allowed'});
 }
 try{
  const ledger=config(process.env);
  const wfpAccount=String(process.env.WAYFORPAY_MERCHANT_ACCOUNT||'');
  const wfpSecret=String(process.env.WAYFORPAY_SECRET_KEY||'');
  return res.status(200).json({
   mode:ledger.mode,
   ledgerUrlConfigured:ledger.url.length>0,
   ledgerSecretConfigured:ledger.secret.length>=32,
   vercelBypassConfigured:ledger.vercelBypass.length>0,
   wayForPayConfigured:wfpAccount.length>0&&wfpSecret.length>0
  });
 }catch(err){
  if(err?.message==='academy_ledger_bad_mode')return res.status(503).json({error:'academy_ledger_bad_mode'});
  return res.status(500).json({error:'server_error'});
 }
};
