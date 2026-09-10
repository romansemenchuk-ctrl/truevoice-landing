// WayForPay server-to-server callback. Signature verification remains the trust boundary.
const crypto=require('crypto');
const {ledgerCall}=require('../lib/academy-ledger.js');
const CALLBACK_SIGNATURE_FIELDS=['merchantAccount','orderReference','amount','currency','authCode','cardPan','transactionStatus','reasonCode'];
function parseBody(raw){let body=raw;if(typeof body==='string'){try{return JSON.parse(body);}catch{return{};}}if(body&&typeof body==='object'){const keys=Object.keys(body);if(keys.length===1&&body[keys[0]]===''&&keys[0].trim().startsWith('{')){try{return JSON.parse(keys[0]);}catch{return body;}}}return body||{};}
const hmacMd5=(secret,message)=>crypto.createHmac('md5',secret).update(message,'utf8').digest('hex');
function signaturesMatch(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function planFromReference(reference){const m=/^tv-(base|pro|upgrade)-/.exec(String(reference||''));return m?m[1]:'base';}
async function sendPulseToken(id,secret){const r=await fetch('https://api.sendpulse.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:id,client_secret:secret})});if(!r.ok)throw new Error(`sendpulse_token_${r.status}`);const j=await r.json();if(!j.access_token)throw new Error('sendpulse_token_missing');return j.access_token;}
async function fulfilViaSendPulse(order){const id=process.env.SENDPULSE_CLIENT_ID,secret=process.env.SENDPULSE_CLIENT_SECRET,book=process.env.SENDPULSE_BOOK_ID;if(!id||!secret||!book)return{delivered:false,reason:'sendpulse_not_configured'};const token=await sendPulseToken(id,secret);const r=await fetch(`https://api.sendpulse.com/addressbooks/${encodeURIComponent(book)}/emails`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({emails:[{email:order.email,variables:{plan:order.plan,phone:order.phone,amount:order.amount,currency:order.currency,order_reference:order.orderReference}}]})});if(!r.ok)throw new Error(`sendpulse_add_${r.status}`);return{delivered:true};}
module.exports=async(req,res)=>{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'method_not_allowed'});}
 const secretKey=process.env.WAYFORPAY_SECRET_KEY;if(!secretKey){console.error('[wfp-callback] WAYFORPAY_SECRET_KEY is not set');return res.status(500).json({error:'not_configured'});}
 const data=parseBody(req.body),orderReference=String(data.orderReference||'');if(!orderReference)return res.status(400).json({error:'bad_payload'});
 const expected=hmacMd5(secretKey,CALLBACK_SIGNATURE_FIELDS.map(f=>data[f]===undefined||data[f]===null?'':data[f]).join(';'));
 if(!signaturesMatch(expected,data.merchantSignature)){console.warn('[wfp-callback] signature mismatch',{orderReference});return res.status(400).json({error:'bad_signature'});}
 const providerEvent={merchantAccount:data.merchantAccount,orderReference,amount:data.amount,currency:data.currency,authCode:data.authCode,cardPan:data.cardPan,transactionStatus:data.transactionStatus,reasonCode:data.reasonCode,merchantSignature:data.merchantSignature};
 for(const key of ['refundAmount','processingDate','createdDate'])if(data[key]!==undefined)providerEvent[key]=data[key];
 try{await ledgerCall('provider-event',providerEvent);}catch(err){console.error('[wfp-callback] Academy ledger required but unavailable',{orderReference,code:err.message});return res.status(503).json({error:'academy_ledger_unavailable'});}
 const time=Math.floor(Date.now()/1000),ack={orderReference,status:'accept',time,signature:hmacMd5(secretKey,[orderReference,'accept',time].join(';'))};
 const status=String(data.transactionStatus||''),order={orderReference,plan:planFromReference(orderReference),status,amount:data.amount,currency:data.currency,email:String(data.email||data.clientEmail||'').trim(),phone:String(data.phone||data.clientPhone||'').trim()};
 if(status!=='Approved')return res.status(200).json(ack);
 if(!order.email){console.error('[wfp-callback] approved payment without an email',{orderReference});return res.status(200).json(ack);}
 try{const result=await fulfilViaSendPulse(order);if(result.delivered)console.info('[wfp-callback] delivered',{orderReference,plan:order.plan});else console.error('[wfp-callback] PAID BUT NOT DELIVERED',{orderReference,reason:result.reason});}catch(err){console.error('[wfp-callback] PAID BUT NOT DELIVERED',{orderReference,code:err.message});}
 return res.status(200).json(ack);
};
