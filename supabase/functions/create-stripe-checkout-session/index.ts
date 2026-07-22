import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@2'

const secretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const stripe = new Stripe(secretKey)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const service = createClient(supabaseUrl, serviceRoleKey, { auth:{ persistSession:false } })
const configuredOrigin = (Deno.env.get('PUBLIC_SITE_ORIGIN') || 'https://phoenix-hibachi.com').replace(/\/$/,'')
const companyEmail = String(Deno.env.get('BOOKING_COMPANY_EMAIL') || '').trim().toLowerCase()
const allowedOrigins = new Set([configuredOrigin, 'https://www.phoenix-hibachi.com'])
const selectFields = [
  'id','booking_number','customer_id','customer_email','request_status','checkout_expires_at','deposit_status',
  'deposit_required_cents','deposit_due_cents','balance_due_cents','order_total_cents','deposit_amount',
  'paid_amount','payment_status','stripe_checkout_session_id','created_at','payment_access_token_hash',
  'event_date','address','state','zip','postal_code','latitude','longitude','package_name','adults','kids','guest_count',
  'add_ons','protein_selections','admin_notes','service_notes','customer_notes','special_requests',
  'travel_fee','food_subtotal','food_subtotal_cents','sales_tax','sales_tax_cents',
  'manager_discount','coupon_discount','applied_coupon_id','applied_coupon_code'
].join(',')

type Row = Record<string,any>
type PricingConfig = {
  packages: Record<string,number>
  packageProteinPortions: Record<string,number>
  proteinUpcharge: number
  premiumProteins: string[]
  addons: Record<string,number>
  moneyRules: Record<string,number>
}
const DEFAULT_PRICING: PricingConfig = {
  packages:{Classic:55,Premium:65,Signature:110},
  packageProteinPortions:{Classic:2,Premium:3,Signature:4},
  proteinUpcharge:5,
  premiumProteins:['Scallop','Lobster','Filet Mignon'],
  addons:{
    'Sushi Roll Tray':85,'Premium Sushi Tray':130,'Sushi & Sashimi Combo':160,
    'Extra Gyoza Tray':45,'Extra Edamame Tray':35,'Noodle / Yakisoba Tray':50,
  },
  moneyRules:{
    minimumFoodOrder:550,depositRequired:200,defaultTravelFee:50,travelFeeBase:50,
    travelFeeIncludedMiles:20,travelFeePerExtraMile:2,njTollFee:30,
    travelFeeCustomQuoteMiles:100,salesTaxRate:8.875,
  },
}

function cors(req:Request){
  const requested=req.headers.get('origin')||configuredOrigin
  const origin=allowedOrigins.has(requested)?requested:configuredOrigin
  return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json'}})}
function text(v:unknown){return String(v??'').trim()}
function lower(v:unknown){return text(v).toLowerCase()}
function exactLike(v:unknown){return text(v).replace(/[\\%_]/g,match=>`\\${match}`)}
function moneyField(...values:unknown[]){for(const value of values){if(value===null||value===undefined||value==='')continue;const n=Number(String(value).replace(/[$,]/g,''));if(Number.isFinite(n))return Math.max(0,n)}return 0}
function normalizeNumber(v:unknown){const raw=text(v).replace(/[\u200B-\u200D\uFEFF]/g,'');return raw.toUpperCase().match(/PHX-\d{6}-[A-Z0-9]{4,12}/)?.[0]||raw.toUpperCase()}
async function sha256(raw:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function authenticatedEmail(req:Request){const auth=req.headers.get('Authorization');if(!auth||!anonKey)return'';const scoped=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}});const {data}=await scoped.auth.getUser();return lower(data.user?.email)}
async function byNumber(table:string,number:string){const {data,error}=await service.from(table).select(selectFields).eq('booking_number',number).order('created_at',{ascending:false}).limit(1);if(error)throw new Error(`${table} lookup failed: ${error.message}`);return(data?.[0] as Row|undefined)||null}
async function existingTokenValid(row:Row,raw:string){if(!raw)return false;const hash=await sha256(raw);if(row.payment_access_token_hash&&row.payment_access_token_hash===hash)return true;const{data,error}=await service.from('booking_payment_access').select('token_hash,revoked_at').eq('booking_id',row.id).maybeSingle();if(error)throw new Error(`Secure token lookup failed: ${error.message}`);return!!data&&!data.revoked_at&&data.token_hash===hash}
async function sandboxRecent(email:string){if(!secretKey.startsWith('sk_test_')||!companyEmail||email!==companyEmail)return null;const since=new Date(Date.now()-4*60*60*1000).toISOString();for(const table of ['booking_drafts','bookings']){const{data,error}=await service.from(table).select(selectFields).eq('customer_email',email).gte('created_at',since).order('created_at',{ascending:false}).limit(1);if(error)throw new Error(`Sandbox ${table} lookup failed: ${error.message}`);if(data?.[0])return{row:data[0] as Row,table}}return null}
function numberMap(raw:unknown,fallback:Record<string,number>){const out={...fallback};if(raw&&typeof raw==='object')for(const[key,value]of Object.entries(raw as Row)){const n=Number(value);if(Number.isFinite(n)&&n>=0)out[key]=n}return out}
function mergePricing(raw:unknown):PricingConfig{const value=raw&&typeof raw==='object'?raw as Row:{};return{packages:numberMap(value.packages,DEFAULT_PRICING.packages),packageProteinPortions:numberMap(value.packageProteinPortions,DEFAULT_PRICING.packageProteinPortions),proteinUpcharge:Math.max(0,Number(value.proteinUpcharge??DEFAULT_PRICING.proteinUpcharge)||DEFAULT_PRICING.proteinUpcharge),premiumProteins:Array.isArray(value.premiumProteins)?value.premiumProteins.map(text).filter(Boolean):DEFAULT_PRICING.premiumProteins,addons:numberMap(value.addons,DEFAULT_PRICING.addons),moneyRules:numberMap(value.moneyRules,DEFAULT_PRICING.moneyRules)}}
async function loadPricing(){const{data,error}=await service.from('app_settings').select('value').eq('key','pricing_settings_v140').maybeSingle();if(error)console.warn('Pricing settings fallback to defaults:',error.message);return mergePricing(data?.value)}
function noteValue(b:Row,label:string){const safe=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const notes=[b.admin_notes,b.service_notes,b.customer_notes,b.special_requests].map(text).join('\n');return notes.match(new RegExp(`(?:^|\\n)${safe}:\\s*([^\\n]+)`,'i'))?.[1]?.trim()||''}
function splitLines(v:unknown){return Array.isArray(v)?v:text(v).split(/\n+/).map(x=>x.trim()).filter(Boolean)}
function normalizeAddonName(raw:unknown){return text(raw).replace(/\s*\([^)]*\)\s*$/,'').replace(/\s*[×x]\s*\d+.*$/,'').replace(/\s+/g,' ').trim()}
function addonTotal(raw:unknown,pricing:PricingConfig){let total=0;const entries=Object.entries(pricing.addons);for(const item of splitLines(raw)){const obj=typeof item==='object'&&item?item as Row:null;const supplied=obj?text(obj.name||obj.label):normalizeAddonName(item);const match=entries.find(([name])=>lower(name)===lower(supplied));if(!match)continue;const qty=obj?Math.max(1,Math.floor(Number(obj.qty||obj.quantity||1))):Math.max(1,Math.floor(Number(text(item).match(/[×x]\s*(\d+)/i)?.[1]||1)));total+=match[1]*qty}return total}
function premiumProteinCount(raw:unknown,pricing:PricingConfig){if(!raw||typeof raw!=='object')return 0;const premium=new Set(pricing.premiumProteins.flatMap(name=>{const clean=lower(name);return clean==='scallop'?['scallop','scallops']:clean==='filet mignon'?['filet','filet mignon']:[clean]}));let total=0;for(const[name,value]of Object.entries(raw as Row)){if(!premium.has(lower(name)))continue;const n=typeof value==='object'&&value?Number((value as Row).qty||(value as Row).quantity||(value as Row).count||0):Number(value||0);total+=Math.max(0,n)}return total}
function inferState(b:Row){const raw=text(b.state).toUpperCase().replace(/[^A-Z]/g,'').slice(0,2);if(raw)return raw;const address=text(b.address).toUpperCase(),zip=text(b.zip||b.postal_code);if(/\bNJ\b|NEW JERSEY/.test(address)||/^0[78]/.test(zip))return'NJ';if(/\bCT\b|CONNECTICUT/.test(address)||/^06/.test(zip))return'CT';if(/\bPA\b|PENNSYLVANIA/.test(address)||/^(15|16|17|18|19)/.test(zip))return'PA';return'NY'}
function taxRate(b:Row,pricing:PricingConfig){const rules=pricing.moneyRules,state=inferState(b),address=text(b.address).toUpperCase(),zip=text(b.zip||b.postal_code);if(state==='NJ')return Number(rules.njSalesTaxRate??6.625)/100;if(state==='CT')return Number(rules.ctSalesTaxRate??6.35)/100;if(state==='PA')return Number(rules.paSalesTaxRate??0)/100;if(/^11[5789]/.test(zip)||/LONG ISLAND|NASSAU|SUFFOLK/.test(address))return Number(rules.longIslandSalesTaxRate??8.625)/100;return Number(rules.salesTaxRate??8.875)/100}
function tollFee(b:Row,pricing:PricingConfig){return Math.max(0,moneyField((b as Row).nj_toll_fee,(b as Row).njTollFee,noteValue(b,'NJ Toll Fee'),noteValue(b,'New Jersey Toll Fee'))||(inferState(b)==='NJ'?Number(pricing.moneyRules.njTollFee??30):0))}
function staffingFee(b:Row){const notes=[b.admin_notes,b.service_notes,b.customer_notes,b.special_requests].map(text).join('\n');const wait=Math.max(0,Number(notes.match(/Waitstaff requested:\s*(\d+)/i)?.[1]||0))*100;const guests=Number(b.adults||0)+Number(b.kids||0);return wait+(/Additional chef requested:\s*Yes/i.test(notes)&&guests<=30?150:0)}
function haversineMiles(lat1:number,lon1:number,lat2:number,lon2:number){const r=(v:number)=>v*Math.PI/180,dLat=r(lat2-lat1),dLon=r(lon2-lon1),a=Math.sin(dLat/2)**2+Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(dLon/2)**2;return 2*3958.8*Math.asin(Math.sqrt(a))}
function secureTravel(b:Row,pricing:PricingConfig,table:string){const rules=pricing.moneyRules,base=Math.max(0,Number(rules.travelFeeBase??rules.defaultTravelFee??50)||50),quoted=Math.max(0,moneyField(b.travel_fee));if(table==='bookings')return quoted;const lat=Number(b.latitude),lon=Number(b.longitude);let floor=base;if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat&&lon){const roadFloor=haversineMiles(40.6169,-74.0132,lat,lon)*1.12,limit=Number(rules.travelFeeCustomQuoteMiles??100)||100;if(roadFloor>limit)throw new Error('This address needs a custom travel quote before card payment.');floor=base+Math.max(0,Math.ceil(roadFloor-(Number(rules.travelFeeIncludedMiles??20)||20)))*(Number(rules.travelFeePerExtraMile??2)||2)}return Math.min(5000,Math.max(base,quoted,floor))}
function securePricing(b:Row,pricing:PricingConfig,table:string,couponDiscount=0){const packageName=text(b.package_name||'Classic'),price=pricing.packages[packageName]??pricing.packages.Classic??55,adults=Math.max(0,Math.floor(Number(b.adults||0))),kids=Math.max(0,Math.floor(Number(b.kids||0))),kidPrice=packageName==='Classic'?28:Math.ceil(price/2),food=Math.max(Number(pricing.moneyRules.minimumFoodOrder??550)||550,adults*price+kids*kidPrice+addonTotal(b.add_ons,pricing)+premiumProteinCount(b.protein_selections,pricing)*pricing.proteinUpcharge),travel=secureTravel(b,pricing,table),staff=staffingFee(b),toll=tollFee(b,pricing),tax=Math.round((food+travel+staff+toll)*taxRate(b,pricing)*100)/100,manager=table==='bookings'?Math.min(food,moneyField(b.manager_discount)):0,coupon=manager>0?0:Math.min(food,Math.max(0,couponDiscount)),total=Math.max(0,food+travel+staff+toll+tax-manager-coupon),paid=moneyField(b.paid_amount,b.deposit_amount);return{food,travel,staff,toll,tax,manager,coupon,total,balance:Math.max(0,total-paid)}}
async function validateCoupon(row:Row,rawCode:unknown,table:string,pricing:PricingConfig){
  const code=text(rawCode).toUpperCase()
  if(!code)return null
  if(table==='bookings'&&moneyField(row.manager_discount)>0)throw new Error('A manager discount is already applied. Coupons cannot be combined.')
  const{data:coupon,error}=await service.from('coupons').select('*').eq('code',code).maybeSingle()
  if(error)throw new Error(error.message)
  if(!coupon||lower(coupon.status)!=='active')throw new Error('This coupon is invalid or inactive.')
  if(coupon.assigned_customer_id&&text(coupon.assigned_customer_id)!==text(row.customer_id))throw new Error('This coupon is assigned to another customer account.')
  const now=Date.now()
  if(coupon.starts_at&&new Date(coupon.starts_at).getTime()>now)throw new Error('This coupon is not active yet.')
  if(coupon.expires_at&&new Date(coupon.expires_at).getTime()<now)throw new Error('This coupon has expired.')
  const eventDate=text(row.event_date)
  if(coupon.applicable_event_date_start&&eventDate<text(coupon.applicable_event_date_start))throw new Error('This coupon is not valid for the selected event date.')
  if(coupon.applicable_event_date_end&&eventDate>text(coupon.applicable_event_date_end))throw new Error('This coupon is not valid for the selected event date.')
  if(coupon.applicable_month&&Number(eventDate.slice(5,7))!==Number(coupon.applicable_month))throw new Error('This coupon is not valid for the selected event month.')
  const base=securePricing(row,pricing,table,0)
  if(base.food<moneyField(coupon.minimum_order_amount))throw new Error(`This coupon requires at least $${moneyField(coupon.minimum_order_amount).toFixed(2)} in food subtotal.`)
  const existingCode=text(row.applied_coupon_code).toUpperCase()
  if(moneyField(row.paid_amount,row.deposit_amount)>0&&existingCode!==code)throw new Error('A new coupon cannot be added after payment has been received.')

  const resourceColumn=table==='booking_drafts'?'draft_id':'booking_id'
  const{data:own,error:ownError}=await service.from('coupon_redemptions').select('id,coupon_id,status').eq(resourceColumn,row.id).in('status',['reserved','redeemed']).order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(ownError)throw new Error(ownError.message)
  const ownsThisCoupon=text(own?.coupon_id)===text(coupon.id)

  const maximum=Number(coupon.max_redemptions||0)
  if(maximum>0){
    const{count,error:e}=await service.from('coupon_redemptions').select('id',{count:'exact',head:true}).eq('coupon_id',coupon.id).in('status',['reserved','redeemed'])
    if(e)throw new Error(e.message)
    if(Math.max(0,Number(count||0)-(ownsThisCoupon?1:0))>=maximum)throw new Error('This coupon has reached its usage limit.')
  }
  const per=Number(coupon.max_redemptions_per_customer||0)
  if(per>0&&row.customer_id){
    const{count,error:e}=await service.from('coupon_redemptions').select('id',{count:'exact',head:true}).eq('coupon_id',coupon.id).eq('customer_id',row.customer_id).in('status',['reserved','redeemed'])
    if(e)throw new Error(e.message)
    if(Math.max(0,Number(count||0)-(ownsThisCoupon?1:0))>=per)throw new Error('This coupon has already been used by this customer.')
  }else if(per>0&&text(row.customer_email)){
    const{count,error:e}=await service.from('coupon_redemptions').select('id',{count:'exact',head:true}).eq('coupon_id',coupon.id).ilike('customer_email',exactLike(lower(row.customer_email))).in('status',['reserved','redeemed'])
    if(e)throw new Error(e.message)
    if(Math.max(0,Number(count||0)-(ownsThisCoupon?1:0))>=per)throw new Error('This coupon has already been used by this customer.')
  }
  if(coupon.first_time_customer_only===true&&text(row.customer_email)){
    let q=service.from('bookings').select('id',{count:'exact',head:true}).ilike('customer_email',exactLike(lower(row.customer_email)))
    if(table==='bookings'&&row.id)q=q.neq('id',row.id)
    const{count,error:e}=await q
    if(e)throw new Error(e.message)
    if(Number(count||0)>0)throw new Error('This coupon is limited to first-time customers.')
  }
  const discount=lower(coupon.discount_type)==='percent'?Math.min(base.food,Math.round(base.food*Number(coupon.discount_value||0))/100):Math.min(base.food,moneyField(coupon.discount_value))
  return{coupon,code,discount}
}
async function releaseReservedCoupons(table:string,rowId:string,exceptCouponId=''){
  const resourceColumn=table==='booking_drafts'?'draft_id':'booking_id'
  let q=service.from('coupon_redemptions').update({status:'released',released_at:new Date().toISOString()}).eq(resourceColumn,rowId).eq('status','reserved')
  if(exceptCouponId)q=q.neq('coupon_id',exceptCouponId)
  const{error}=await q
  if(error)throw new Error(error.message)
}
async function reserveCoupon(row:Row,table:string,candidate:{coupon:Row,code:string,discount:number}){
  await releaseReservedCoupons(table,row.id,text(candidate.coupon.id))
  const{data,error}=await service.rpc('phx_reserve_coupon_redemption',{
    p_coupon_id:candidate.coupon.id,
    p_booking_id:table==='bookings'?row.id:null,
    p_draft_id:table==='booking_drafts'?row.id:null,
    p_customer_id:row.customer_id||null,
    p_customer_email:lower(row.customer_email)||null,
    p_code:candidate.code,
    p_discount:candidate.discount,
  })
  if(error)throw new Error(error.message)
  return text(data)
}
async function updateCompat(table:string,id:string,patch:Row){let payload={...patch};let result=await service.from(table).update(payload).eq('id',id);for(let i=0;result.error&&i<20;i++){const msg=text(result.error.message),col=(msg.match(/Could not find the '([^']+)' column/i)||msg.match(/column "([^"]+)" .* does not exist/i))?.[1];if(!col||!(col in payload))break;delete payload[col];result=await service.from(table).update(payload).eq('id',id)}if(result.error)throw new Error(result.error.message)}
function requiredDepositCents(pricing:PricingConfig,row:Row={}){const base=Math.max(20000,Math.round((Number(pricing.moneyRules.depositRequired??200)||200)*100)),guests=Math.max(0,Number(row.guest_count||0),Number(row.adults||0)+Number(row.kids||0));return guests>=31?Math.max(base,30000):base}
function paymentAmount(row:Row,paymentType:string,customAmountCents:number){const balance=Math.max(0,Number(row.balance_due_cents??row.order_total_cents??0));if(paymentType==='full_balance')return balance;if(paymentType==='custom')return customAmountCents;const depositDue=Math.max(0,Number(row.deposit_due_cents??row.deposit_required_cents??20000));return Math.min(depositDue,balance||depositDue)}
function alreadyCovered(row:Row,paymentType:string){if(paymentType==='full_balance')return Number(row.balance_due_cents||0)<=0||lower(row.payment_status).includes('paid in full');if(paymentType==='custom')return Number(row.balance_due_cents||0)<=0;return['paid','paid_by_benefits'].includes(lower(row.deposit_status))||Number(row.deposit_due_cents||0)<=0}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  let pendingReservationId=''
  let pendingSessionId=''
  try{
    if(!secretKey||!supabaseUrl||!serviceRoleKey)throw new Error('Secure payment server is not fully configured')
    const pricingConfig=await loadPricing()
    const{bookingNumber,customerEmail,paymentAccessToken,paymentType='deposit',customAmountCents=0,couponCode=''}=await req.json()
    const type=lower(paymentType||'deposit')
    if(!['deposit','full_balance','custom'].includes(type))throw new Error('Choose the required deposit, full balance, or a custom amount')
    const number=normalizeNumber(bookingNumber),supplied=lower(customerEmail)
    if(!number||!supplied)throw new Error('Booking number and customer email are required')

    // Active orders always win over any stale or malicious same-number draft.
    let table='bookings',row=await byNumber(table,number),resolvedBy='booking_number'
    if(!row){table='booking_drafts';row=await byNumber(table,number);resolvedBy='draft_number'}
    if(!row){const recent=await sandboxRecent(supplied);if(recent){row=recent.row;table=recent.table;resolvedBy='sandbox_company_email'}}
    if(!row)throw new Error(`Booking request ${number} was not found. Submit a new booking and pay from its final-step screen.`)
    if(lower(row.customer_email)!==supplied)throw new Error('Booking email could not be verified')
    if(secretKey.startsWith('sk_test_')&&(!companyEmail||supplied!==companyEmail))throw new Error('Stripe Sandbox is restricted to the Phoenix Hibachi company test email')
    const userEmail=await authenticatedEmail(req),tokenOkay=await existingTokenValid(row,text(paymentAccessToken))
    if(!tokenOkay&&userEmail!==supplied)throw new Error('Secure booking token is missing or expired. Start a new booking and pay from the same browser window.')

    if(table==='booking_drafts'){
      if(row.checkout_expires_at&&new Date(row.checkout_expires_at).getTime()<Date.now())throw new Error('This provisional booking expired. Please start a new booking.')
      if(/abandon|expired|cancel/i.test(text(row.request_status)))throw new Error('This provisional booking is no longer eligible for payment')
      if(type!=='deposit')throw new Error('Before manager confirmation, card payment is limited to the required deposit. Full balance can be paid after Phoenix confirms the order.')
    }else if(/cancel|declin|expired/i.test(text(row.request_status))){throw new Error('This booking is no longer eligible for payment')}

    const requestedCode=text(couponCode)||text(row.applied_coupon_code)
    const requestedCoupon=requestedCode?await validateCoupon(row,requestedCode,table,pricingConfig):null
    if(requestedCoupon)pendingReservationId=await reserveCoupon(row,table,requestedCoupon)
    else await releaseReservedCoupons(table,row.id)
    const couponDiscount=requestedCoupon?.discount??0
    const pricing=securePricing(row,pricingConfig,table,couponDiscount)
    const depositRequired=requiredDepositCents(pricingConfig,row)
    const paidCents=Math.round(moneyField(row.paid_amount,row.deposit_amount)*100)
    const securePatch:Row={
      food_subtotal:Number(pricing.food.toFixed(2)),food_subtotal_cents:Math.round(pricing.food*100),
      travel_fee:Number(pricing.travel.toFixed(2)),sales_tax:Number(pricing.tax.toFixed(2)),sales_tax_cents:Math.round(pricing.tax*100),
      manager_discount:Number(pricing.manager.toFixed(2)),coupon_discount:Number(pricing.coupon.toFixed(2)),
      applied_coupon_id:requestedCoupon?.coupon?.id||null,applied_coupon_code:requestedCoupon?.code||null,
      final_total:Number(pricing.total.toFixed(2)),order_total_cents:Math.round(pricing.total*100),
      balance_due:Number(pricing.balance.toFixed(2)),balance_due_cents:Math.round(pricing.balance*100),
      deposit_required_cents:depositRequired,deposit_due_cents:Math.max(0,depositRequired-paidCents),
    }
    await updateCompat(table,row.id,securePatch)
    row={...row,...securePatch}

    if(alreadyCovered(row,type))return json(req,{alreadyPaid:true,paidInFull:type==='full_balance'||Number(row.balance_due_cents||0)<=0,amountDue:0,paymentType:type,resolvedBookingNumber:row.booking_number,resolvedBy})
    const requestedCustom=Math.round(Number(customAmountCents||0))
    const amountDue=paymentAmount(row,type,requestedCustom)
    if(!Number.isInteger(amountDue)||amountDue<=0||amountDue>5_000_000)throw new Error('The selected card-payment amount needs staff review')
    if(type==='custom'){
      if(table!=='bookings')throw new Error('Custom card payments are available only after manager confirmation.')
      if(!Number.isInteger(requestedCustom)||requestedCustom<10000)throw new Error('Custom card payment must be at least $100')
      if(requestedCustom>Number(row.balance_due_cents||0))throw new Error('Custom card payment cannot exceed the remaining balance')
    }

    let prior:Stripe.Checkout.Session|null=null
    if(row.stripe_checkout_session_id){try{prior=await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id)}catch{}}
    const priorType=text(prior?.metadata?.payment_type),priorExpected=Number(prior?.metadata?.expected_amount_cents||prior?.amount_total||0)
    const couponKey=requestedCoupon?.code||'none'
    if(prior?.payment_status==='paid'&&lower(row.payment_verification_status)!=='verified'){
      return json(req,{alreadyPaid:true,pendingVerification:true,paidInFull:false,amountDue:0,paymentType:type,resolvedBookingNumber:row.booking_number,resolvedBy,message:'Stripe received this payment and Phoenix is waiting for secure webhook verification. Please do not pay again.'})
    }
    if(prior?.status==='open'&&prior.client_secret&&priorType===type&&priorExpected===amountDue&&text(prior.metadata?.coupon_code||'none')===couponKey){
      pendingSessionId=prior.id
      if(pendingReservationId)await service.from('coupon_redemptions').update({checkout_session_id:prior.id}).eq('id',pendingReservationId).eq('status','reserved')
      return json(req,{clientSecret:prior.client_secret,sessionId:prior.id,amountDue,paymentType:type,reused:true,resolvedBookingNumber:row.booking_number,resolvedBy,couponCode:requestedCoupon?.code||'',couponDiscountCents:Math.round(couponDiscount*100)})
    }

    const retry=(priorType===type&&priorExpected===amountDue&&text(prior?.metadata?.coupon_code||'none')===couponKey)?(prior?.id||'initial'):'new'
    const idempotencyKey=`phoenix:${table}:${row.id}:${type}:${amountDue}:${couponKey}:${retry}`
    const productName=type==='full_balance'?'Phoenix Hibachi Full Booking Balance':type==='custom'?'Phoenix Hibachi Custom Booking Payment':'Phoenix Hibachi Booking Deposit'
    const description=type==='full_balance'?`Full remaining balance for ${row.booking_number}`:type==='custom'?`Custom payment for ${row.booking_number}`:`Required booking deposit for ${row.booking_number}`
    const session=await stripe.checkout.sessions.create({
      ui_mode:'embedded_page',mode:'payment',customer_email:row.customer_email||undefined,client_reference_id:row.booking_number,
      metadata:{draft_id:table==='booking_drafts'?row.id:'',booking_id:table==='bookings'?row.id:'',booking_number:row.booking_number,payment_type:type,expected_amount_cents:String(amountDue),coupon_id:text(requestedCoupon?.coupon?.id),coupon_code:text(requestedCoupon?.code),coupon_discount_cents:String(Math.round(couponDiscount*100)),coupon_reservation_id:pendingReservationId},
      line_items:[{price_data:{currency:'usd',product_data:{name:productName,description},unit_amount:amountDue},quantity:1}],
      redirect_on_completion:'if_required',return_url:`${configuredOrigin}/?${secretKey.startsWith('sk_test_')?'stripe_test=1&':''}stripe_return={CHECKOUT_SESSION_ID}`,
    },{idempotencyKey})
    pendingSessionId=session.id
    if(pendingReservationId){
      const{error:reservationSessionError}=await service.from('coupon_redemptions').update({checkout_session_id:session.id}).eq('id',pendingReservationId).eq('status','reserved')
      if(reservationSessionError)throw new Error(reservationSessionError.message)
    }
    const pendingStatus=type==='full_balance'?'full_payment_pending':type==='custom'?'custom_payment_pending':'awaiting_webhook'
    const{error:updateError}=await service.from(table).update({stripe_checkout_session_id:session.id,payment_preference:'stripe',deposit_status:type==='deposit'?'pending':row.deposit_status,deposit_deferred:type==='deposit'?true:row.deposit_deferred,payment_verification_status:pendingStatus}).eq('id',row.id)
    if(updateError)throw new Error(updateError.message)
    return json(req,{clientSecret:session.client_secret,sessionId:session.id,amountDue,paymentType:type,resolvedBookingNumber:row.booking_number,resolvedBy,couponCode:requestedCoupon?.code||'',couponDiscountCents:Math.round(couponDiscount*100)})
  }catch(error){
    if(pendingReservationId&&!pendingSessionId){
      try{await service.from('coupon_redemptions').update({status:'released',released_at:new Date().toISOString()}).eq('id',pendingReservationId).eq('status','reserved').is('checkout_session_id',null)}catch{}
    }
    console.error(error)
    return json(req,{error:error instanceof Error?error.message:'Unable to create payment session'},400)
  }
})
