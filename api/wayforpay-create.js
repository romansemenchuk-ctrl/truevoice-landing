// Vercel serverless function (Node.js). Signs a WayForPay order server-side.
const crypto=require('crypto');
const {ledgerCall}=require('../lib/academy-ledger.js');
const PRODUCT_IDS={base:'mini-base',pro:'mini-pro',upgrade:'mini-upgrade'};
const amountMinor=n=>Math.round(Number(n)*100);
module.exports=async(req,res)=>{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'method_not_allowed'});}
 const merchantAccount=process.env.WAYFORPAY_MERCHANT_ACCOUNT,secretKey=process.env.WAYFORPAY_SECRET_KEY,domain=process.env.WAYFORPAY_DOMAIN||'7d.truevoice.academy';
 if(!merchantAccount||!secretKey)return res.status(500).json({error:'wayforpay_not_configured',message:'WAYFORPAY_MERCHANT_ACCOUNT / WAYFORPAY_SECRET_KEY не задані у Vercel.'});
 let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body);}catch{body={};}}body=body||{};
 const email=String(body.email||'').trim(),phone=String(body.phone||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'invalid_email'});
 if(phone.replace(/\D/g,'').length<7)return res.status(400).json({error:'invalid_phone'});
 const localPart=(email.split('@')[0]||'client').replace(/[._-]+/g,' ').trim(),nameParts=localPart.split(' ').filter(Boolean),cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
 const clientFirstName=cap(nameParts[0])||'Client',clientLastName=nameParts.length>1?nameParts.slice(1).map(cap).join(' '):'TrueVoice';
 const PLANS={base:{price:Number(process.env.PRICE_BASE||15),name:process.env.PRODUCT_NAME||'TrueVoice 7D — 7 днів до живого звучання'},pro:{price:Number(process.env.PRICE_PRO||25),name:'TrueVoice 7D max — курс + групова Q&A-сесія'},upgrade:{price:Number(process.env.PRICE_UPGRADE||10),name:'TrueVoice — апгрейд до 7D max'}};
 const planKey=Object.prototype.hasOwnProperty.call(PLANS,body.plan)?body.plan:'base',plan=PLANS[planKey],productName=plan.name,currency=process.env.PRODUCT_CURRENCY||'USD',amount=plan.price;
 if(!Number.isFinite(amount)||amount<=0)return res.status(500).json({error:'invalid_product_price'});
 const orderReference=`tv-${planKey}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,orderDate=Math.floor(Date.now()/1000),productNameArr=[productName],productCountArr=[1],productPriceArr=[amount];
 const signatureString=[merchantAccount,domain,orderReference,orderDate,amount,currency,...productNameArr,...productCountArr,...productPriceArr].join(';');
 const merchantSignature=crypto.createHmac('md5',secretKey).update(signatureString,'utf8').digest('hex');
 const oidcToken=String(req.headers?.['x-vercel-oidc-token']||'');
 try{await ledgerCall('register-order',{reference:orderReference,email:email.toLowerCase(),productId:PRODUCT_IDS[planKey],amountMinor:amountMinor(amount),currency:String(currency).toUpperCase(),purchasedAt:new Date(orderDate*1000).toISOString()},{oidcToken});}
 catch(err){console.error('[wfp-create] Academy ledger required but unavailable',{code:err.message});return res.status(503).json({error:'academy_ledger_unavailable'});}
 const siteUrl=(process.env.SITE_URL||`https://${domain}`).replace(/\/+$/,'');
 return res.status(200).json({merchantAccount,merchantAuthType:'SimpleSignature',merchantDomainName:domain,merchantSignature,serviceUrl:`${siteUrl}/api/wayforpay-callback`,returnUrl:`${siteUrl}/success?plan=${planKey}`,orderReference,orderDate,amount,currency,productName:productNameArr,productCount:productCountArr,productPrice:productPriceArr,clientEmail:email,clientPhone:phone,clientFirstName,clientLastName,language:'UA',plan:planKey});
};
