import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@2'

const secretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const stripe = new Stripe(secretKey)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const service = createClient(supabaseUrl, serviceRoleKey)
const configuredOrigin = (Deno.env.get('PUBLIC_SITE_ORIGIN') || 'https://phoenix-hibachi.com').replace(/\/$/, '')
const allowedOrigins = new Set([configuredOrigin, 'https://www.phoenix-hibachi.com'])
const fields='id,booking_number,request_status,status,deposit_status,payment_status,payment_verification_status,deposit_paid_at,deposit_amount,paid_amount,balance_due_cents'

type Row=Record<string,any>
function corsHeaders(req: Request) { const requestOrigin=req.headers.get('origin')||configuredOrigin; const origin=allowedOrigins.has(requestOrigin)?requestOrigin:configuredOrigin; return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'} }
function json(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), {status,headers:{...corsHeaders(req),'Content-Type':'application/json'}}) }
function validSessionId(value: unknown) { return /^cs_(test|live)_[A-Za-z0-9_]+$/.test(String(value || '').trim()) }
async function fromBookings(column:string,value:string){ if(!value)return null; const {data,error}=await service.from('bookings').select(fields).eq(column,value).maybeSingle(); if(error)throw new Error(`Booking verification failed: ${error.message}`); return data as Row|null }
async function fromDrafts(column:string,value:string){ if(!value)return null; const {data,error}=await service.from('booking_drafts').select(fields).eq(column,value).maybeSingle(); if(error)throw new Error(`Draft verification failed: ${error.message}`); return data as Row|null }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  if (!secretKey) return json(req, { error: 'Stripe server is not configured' }, 500)
  try {
    const body=await req.json().catch(()=>({})); const sessionId=String(body?.sessionId||body?.session_id||'').trim()
    if(!validSessionId(sessionId))return json(req,{error:'Invalid Checkout Session ID'},400)
    const session=await stripe.checkout.sessions.retrieve(sessionId)
    const bookingId=String(session.metadata?.booking_id||'').trim()
    const draftId=String(session.metadata?.draft_id||'').trim()
    const bookingNumber=String(session.metadata?.booking_number||session.client_reference_id||'').trim()
    const paymentType=String(session.metadata?.payment_type||'deposit').trim()

    let booking:Row|null=null
    if(bookingId)booking=await fromBookings('id',bookingId)
    if(!booking&&draftId)booking=await fromBookings('id',draftId)
    if(!booking&&bookingNumber)booking=await fromBookings('booking_number',bookingNumber)
    let draft:Row|null=null
    if(!booking&&draftId)draft=await fromDrafts('id',draftId)
    if(!booking&&!draft&&bookingNumber)draft=await fromDrafts('booking_number',bookingNumber)
    const row=booking||draft||{}
    const depositStatus=String(row.deposit_status||'')
    const paymentStatus=String(row.payment_status||'')
    const verificationStatus=String(row.payment_verification_status||'')
    const paidInFull=Number(row.balance_due_cents||0)<=0&&verificationStatus==='verified'
    const depositVerified=['paid','paid_by_benefits'].includes(depositStatus)&&verificationStatus==='verified'
    const bookingVerified=paymentType==='full_balance'?paidInFull:depositVerified

    return json(req,{
      status:session.status,paymentStatus:session.payment_status,amountTotal:Number(session.amount_total||0),currency:session.currency||'usd',
      paymentType,bookingNumber:String(row.booking_number||bookingNumber||''),requestStatus:String(row.request_status||''),bookingStatus:String(row.status||''),
      depositStatus,paymentRecordStatus:paymentStatus,paymentVerificationStatus:verificationStatus,depositPaidAt:row.deposit_paid_at||null,
      depositAmount:Number(row.deposit_amount||0),paidAmount:Number(row.paid_amount||row.deposit_amount||0),balanceDueCents:Number(row.balance_due_cents||0),
      bookingVerified,paidInFull,activeBooking:!!booking,livemode:session.livemode,
    })
  } catch (error) { console.error(error); return json(req,{error:error instanceof Error?error.message:'Unable to retrieve payment status'},400) }
})
