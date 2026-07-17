import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@2'

const secretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const stripe = new Stripe(secretKey)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const service = createClient(supabaseUrl, serviceRoleKey)
const configuredOrigin = (Deno.env.get('PUBLIC_SITE_ORIGIN') || 'https://phoenix-hibachi.com').replace(/\/$/,'')
const companyEmail = String(Deno.env.get('BOOKING_COMPANY_EMAIL') || '').trim().toLowerCase()
const allowedOrigins = new Set([configuredOrigin, 'https://www.phoenix-hibachi.com'])
const selectFields = [
  'id','booking_number','customer_email','request_status','checkout_expires_at','deposit_status',
  'deposit_required_cents','deposit_due_cents','balance_due_cents','order_total_cents','deposit_amount',
  'paid_amount','payment_status','stripe_checkout_session_id','created_at','payment_access_token_hash'
].join(',')

type Row = Record<string,any>
function cors(req:Request){ const requested=req.headers.get('origin')||configuredOrigin; const origin=allowedOrigins.has(requested)?requested:configuredOrigin; return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'} }
function json(req:Request,body:unknown,status=200){ return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json'}}) }
async function sha256(raw:string){ const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)); return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('') }
function normalizeNumber(v:unknown){ const raw=String(v||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim(); return raw.toUpperCase().match(/PHX-\d{6}-[A-Z0-9]{4,12}/)?.[0]||raw.toUpperCase() }
async function authenticatedEmail(req:Request){ const auth=req.headers.get('Authorization'); if(!auth||!anonKey)return''; const scoped=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}}); const {data}=await scoped.auth.getUser(); return String(data.user?.email||'').trim().toLowerCase() }
async function byNumber(table:string,number:string){ const {data,error}=await service.from(table).select(selectFields).eq('booking_number',number).order('created_at',{ascending:false}).limit(1); if(error)throw new Error(`${table} lookup failed: ${error.message}`); return (data?.[0] as Row|undefined)||null }
async function existingTokenValid(row:Row,raw:string){ if(!raw)return false; const hash=await sha256(raw); if(row.payment_access_token_hash && row.payment_access_token_hash===hash)return true; const {data,error}=await service.from('booking_payment_access').select('token_hash,revoked_at').eq('booking_id',row.id).maybeSingle(); if(error)throw new Error(`Secure token lookup failed: ${error.message}`); return !!data&&!data.revoked_at&&data.token_hash===hash }
async function sandboxRecent(email:string){ if(!secretKey.startsWith('sk_test_')||!companyEmail||email!==companyEmail)return null; const since=new Date(Date.now()-4*60*60*1000).toISOString(); for(const table of ['booking_drafts','bookings']){ const {data,error}=await service.from(table).select(selectFields).eq('customer_email',email).gte('created_at',since).order('created_at',{ascending:false}).limit(1); if(error)throw new Error(`Sandbox ${table} lookup failed: ${error.message}`); if(data?.[0])return {row:data[0] as Row,table}; } return null }
function paymentAmount(row:Row,paymentType:string,customAmountCents:number){
  const balance=Math.max(0,Number(row.balance_due_cents ?? row.order_total_cents ?? 0))
  if(paymentType==='full_balance') return balance
  if(paymentType==='custom') return customAmountCents
  const depositDue=Math.max(0,Number(row.deposit_due_cents ?? row.deposit_required_cents ?? 10000))
  return Math.min(depositDue,balance||depositDue)
}
function alreadyCovered(row:Row,paymentType:string){
  if(paymentType==='full_balance') return Number(row.balance_due_cents||0)<=0 || String(row.payment_status||'').toLowerCase().includes('paid in full')
  if(paymentType==='custom') return Number(row.balance_due_cents||0)<=0
  return ['paid','paid_by_benefits'].includes(String(row.deposit_status||'').toLowerCase()) || Number(row.deposit_due_cents||0)<=0
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  try{
    if(!secretKey||!supabaseUrl||!serviceRoleKey)throw new Error('Secure payment server is not fully configured')
    const {bookingNumber,customerEmail,paymentAccessToken,paymentType='deposit',customAmountCents=0}=await req.json()
    const type=String(paymentType||'deposit').trim().toLowerCase()
    if(!['deposit','full_balance','custom'].includes(type))throw new Error('Choose the required deposit, full balance, or a custom amount')
    const number=normalizeNumber(bookingNumber); const supplied=String(customerEmail||'').trim().toLowerCase()
    if(!number||!supplied)throw new Error('Booking number and customer email are required')

    let table='booking_drafts'; let row=await byNumber(table,number); let resolvedBy='draft_number'
    if(!row){ table='bookings'; row=await byNumber(table,number); resolvedBy='booking_number' }
    if(!row){ const recent=await sandboxRecent(supplied); if(recent){row=recent.row;table=recent.table;resolvedBy='sandbox_company_email'} }
    if(!row)throw new Error(`Booking request ${number} was not found. Submit a new booking and pay from its final-step screen.`)

    const rowEmail=String(row.customer_email||'').trim().toLowerCase()
    if(!rowEmail||rowEmail!==supplied)throw new Error('Booking email could not be verified')
    if(secretKey.startsWith('sk_test_')&&(!companyEmail||rowEmail!==companyEmail))throw new Error('Stripe Sandbox is restricted to the Phoenix Hibachi company test email')
    const userEmail=await authenticatedEmail(req); const tokenOkay=await existingTokenValid(row,String(paymentAccessToken||''))
    if(!tokenOkay&&userEmail!==rowEmail)throw new Error('Secure booking token is missing or expired. Start a new booking and pay from the same browser window.')

    if(table==='booking_drafts'){
      if(row.checkout_expires_at&&new Date(row.checkout_expires_at).getTime()<Date.now())throw new Error('This provisional booking expired. Please start a new booking.')
      if(/abandon|expired|cancel/i.test(String(row.request_status||'')))throw new Error('This provisional booking is no longer eligible for payment')
    }else if(/cancel|declin|expired/i.test(String(row.request_status||''))){ throw new Error('This booking is no longer eligible for payment') }

    if(alreadyCovered(row,type))return json(req,{alreadyPaid:true,paidInFull:type==='full_balance'||Number(row.balance_due_cents||0)<=0,amountDue:0,paymentType:type,resolvedBookingNumber:row.booking_number,resolvedBy})
    const requestedCustom=Math.round(Number(customAmountCents||0))
    const amountDue=paymentAmount(row,type,requestedCustom)
    const maxAmount=5_000_000
    if(!Number.isInteger(amountDue)||amountDue<=0||amountDue>maxAmount)throw new Error('The selected card-payment amount needs staff review')
    if(type==='custom'){
      if(!Number.isInteger(requestedCustom)||requestedCustom<10000)throw new Error('Custom card payment must be at least $100')
      const balance=Math.max(0,Number(row.balance_due_cents ?? row.order_total_cents ?? 0))
      if(balance>0&&requestedCustom>balance)throw new Error('Custom card payment cannot exceed the remaining balance')
    }

    let prior:Stripe.Checkout.Session|null=null
    if(row.stripe_checkout_session_id){ try{prior=await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id)}catch{} }
    const priorType=String(prior?.metadata?.payment_type||'')
    const priorExpected=Number(prior?.metadata?.expected_amount_cents||prior?.amount_total||0)
    if(prior?.payment_status==='paid'&&priorType===type)return json(req,{alreadyPaid:true,paidInFull:type==='full_balance',amountDue:0,paymentType:type,resolvedBookingNumber:row.booking_number,resolvedBy})
    if(prior?.status==='open'&&prior.client_secret&&priorType===type&&priorExpected===amountDue)return json(req,{clientSecret:prior.client_secret,sessionId:prior.id,amountDue,paymentType:type,reused:true,resolvedBookingNumber:row.booking_number,resolvedBy})

    const retry=(priorType===type&&priorExpected===amountDue)?(prior?.id||'initial'):'new'
    const idempotencyKey=`phoenix:${table}:${row.id}:${type}:${amountDue}:${retry}`
    const productName=type==='full_balance'?'Phoenix Hibachi Full Booking Balance':type==='custom'?'Phoenix Hibachi Custom Booking Payment':'Phoenix Hibachi Booking Deposit'
    const description=type==='full_balance'?`Full remaining balance for ${row.booking_number}`:type==='custom'?`Custom payment for ${row.booking_number}`:`Required party-size deposit for ${row.booking_number}`
    const session=await stripe.checkout.sessions.create({
      ui_mode:'embedded_page',mode:'payment',customer_email:row.customer_email||undefined,client_reference_id:row.booking_number,
      metadata:{draft_id:table==='booking_drafts'?row.id:'',booking_id:table==='bookings'?row.id:'',booking_number:row.booking_number,payment_type:type,expected_amount_cents:String(amountDue)},
      line_items:[{price_data:{currency:'usd',product_data:{name:productName,description},unit_amount:amountDue},quantity:1}],
      redirect_on_completion:'if_required',return_url:`${configuredOrigin}/?${secretKey.startsWith('sk_test_')?'stripe_test=1&':''}stripe_return={CHECKOUT_SESSION_ID}`,
    },{idempotencyKey})
    const pendingStatus=type==='full_balance'?'full_payment_pending':type==='custom'?'custom_payment_pending':'awaiting_webhook'
    const {error:updateError}=await service.from(table).update({stripe_checkout_session_id:session.id,payment_preference:'stripe',deposit_status:type==='deposit'?'pending':row.deposit_status,deposit_deferred:type==='deposit'?true:row.deposit_deferred,payment_verification_status:pendingStatus}).eq('id',row.id)
    if(updateError)throw new Error(updateError.message)
    return json(req,{clientSecret:session.client_secret,sessionId:session.id,amountDue,paymentType:type,resolvedBookingNumber:row.booking_number,resolvedBy})
  }catch(error){ console.error(error); return json(req,{error:error instanceof Error?error.message:'Unable to create payment session'},400) }
})
