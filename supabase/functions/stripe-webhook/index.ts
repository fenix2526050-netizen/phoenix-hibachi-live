import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@2'

const secretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
const stripe = new Stripe(secretKey)
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const db = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')
const makeWebhookUrl = Deno.env.get('MAKE_CUSTOMER_NOTIFICATIONS_WEBHOOK_URL') || ''
const makeApiKey = Deno.env.get('MAKE_CUSTOMER_NOTIFICATIONS_API_KEY') || ''
const companyEmail = Deno.env.get('BOOKING_COMPANY_EMAIL') || 'booking@phoenix-hibachi.com'
const sitePhone = Deno.env.get('SITE_PHONE') || '(516) 518-3325'
const websiteUrl = Deno.env.get('PUBLIC_SITE_ORIGIN') || 'https://phoenix-hibachi.com'

type Row = Record<string, any>
type EventType = 'deposit_paid' | 'paid_in_full'
function text(v: unknown) { return String(v ?? '').trim() }
function lower(v: unknown) { return text(v).toLowerCase() }
function digits(v: unknown) { return text(v).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '') }
function phone(v: unknown) { const d = digits(v); return d.length === 10 ? `+1${d}` : '' }
function esc(v: unknown) { return text(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c)) }
function cents(v: unknown) { return Math.max(0, Math.round(Number(v || 0))) }
function moneyCents(v: unknown) { return `$${(cents(v) / 100).toFixed(2)}` }
function moneyDollars(v: unknown) { return `$${Math.max(0, Number(v || 0)).toFixed(2)}` }
function smsOptIn(b: Row) { return b.sms_opt_in === true || lower(b.sms_opt_in) === 'true' }
function notificationType(paymentType: string, b: Row): EventType { return paymentType === 'full_balance' || Number(b.balance_due_cents || 0) <= 0 ? 'paid_in_full' : 'deposit_paid' }

function makePayload(b: Row, eventType: EventType, amountCents: number, sessionId: string) {
  const full = eventType === 'paid_in_full'
  const partial = !full && String(b.deposit_status || '').toLowerCase() === 'partially_paid'
  const amountPaid = Number(b.paid_amount ?? b.deposit_amount ?? (amountCents / 100))
  const balanceDue = Number(b.balance_due_cents || 0) / 100
  const subject = full
    ? `Phoenix Hibachi paid in full – ${b.booking_number}`
    : partial
      ? `Phoenix Hibachi payment received – ${b.booking_number}`
      : `Phoenix Hibachi deposit received – ${b.booking_number}`
  const title = full ? 'Payment in full received' : partial ? 'Your payment was received' : 'Your deposit was received'
  const lead = full
    ? `Booking ${b.booking_number} now has a $0.00 balance.`
    : partial
      ? `We recorded ${moneyCents(amountCents)} toward booking ${b.booking_number}. The required deposit is not yet fully covered.`
      : `We recorded ${moneyCents(amountCents)} toward booking ${b.booking_number}.`
  const sms = full
    ? `Phoenix Hibachi: ${b.booking_number} is paid in full. Balance $0.00. Thank you! ${sitePhone}. Reply STOP to opt out.`
    : partial
      ? `Phoenix Hibachi: Payment received for ${b.booking_number}. Paid ${moneyCents(amountCents)}; balance ${moneyDollars(balanceDue)}. The required deposit is not fully covered yet. ${sitePhone}. Reply STOP to opt out.`
      : `Phoenix Hibachi: Deposit received for ${b.booking_number}. Paid ${moneyCents(amountCents)}; balance ${moneyDollars(balanceDue)}. ${sitePhone}. Reply STOP to opt out.`
  const emailText = `${title}\n\n${lead}\n\nBooking: ${text(b.booking_number)}\nDate: ${text(b.event_date)}\nTime: ${text(b.event_time)}\nPayment status: ${text(b.payment_status)}\nAmount paid: ${moneyDollars(amountPaid)}\nBalance due: ${moneyDollars(balanceDue)}\n\nQuestions? Call or text ${sitePhone}.\n${websiteUrl}`
  const emailHtml = `<div style="font-family:Arial,sans-serif;color:#21160b;line-height:1.55;max-width:620px;margin:auto"><div style="border:1px solid #d69a28;border-radius:16px;overflow:hidden"><div style="background:#170e05;color:#ffd36b;padding:20px 24px"><strong style="font-size:21px">Phoenix Hibachi</strong><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase">Private Backyard Catering</div></div><div style="padding:24px"><h2 style="color:#9a5d08;margin-top:0">${esc(title)}</h2><p>${esc(lead)}</p><table cellpadding="8" style="border-collapse:collapse;width:100%;background:#fffaf1"><tr><td><b>Booking</b></td><td>${esc(b.booking_number)}</td></tr><tr><td><b>Date</b></td><td>${esc(b.event_date)}</td></tr><tr><td><b>Time</b></td><td>${esc(b.event_time)}</td></tr><tr><td><b>Payment status</b></td><td>${esc(b.payment_status)}</td></tr><tr><td><b>Amount paid</b></td><td>${esc(moneyDollars(amountPaid))}</td></tr><tr><td><b>Balance due</b></td><td>${esc(moneyDollars(balanceDue))}</td></tr></table><p style="margin-bottom:0">Questions? Call or text <a href="tel:+15165183325">${esc(sitePhone)}</a> or reply to this email.</p></div></div><p style="font-size:12px;color:#6c6258;text-align:center">${esc(companyEmail)} · <a href="${esc(websiteUrl)}">${esc(websiteUrl.replace(/^https?:\/\//,''))}</a></p></div>`
  return {
    event_type:eventType,
    notification_type:eventType,
    booking_number:text(b.booking_number),
    customer_name:text(b.customer_name),
    customer_phone:phone(b.customer_phone),
    customer_email:lower(b.customer_email),
    event_date:text(b.event_date),
    event_time:text(b.event_time),
    payment_status:text(b.payment_status),
    deposit_status:text(b.deposit_status),
    amount_paid:Number(amountPaid.toFixed(2)),
    balance_due:Number(balanceDue.toFixed(2)),
    currency:'USD',
    sms_opt_in:smsOptIn(b),
    sms_content:sms,
    email_subject:subject,
    email_html:emailHtml,
    email_text:emailText,
    source:'stripe_webhook',
    stripe_session_id:sessionId,
    occurred_at:new Date().toISOString(),
  }
}
async function dispatchMake(b: Row, eventType: EventType, amountCents: number, sessionId: string) {
  const payload = makePayload(b, eventType, amountCents, sessionId)
  const key = `${b.id}:${eventType}:make:${sessionId || `${amountCents}:${b.balance_due_cents}`}`
  try {
    const { data: prior } = await db.from('booking_notifications').select('status').eq('dedupe_key', key).maybeSingle()
    if (prior?.status === 'sent') return { sentAny:true, queued:true, duplicate:true }
  } catch {}
  const base = { booking_id:b.id, notification_type:eventType, recipient_type:'customer', recipient_email:payload.customer_email || null, recipient_phone:payload.customer_phone || null, channel:'make', payload, dedupe_key:key, updated_at:new Date().toISOString() }
  if (!makeWebhookUrl || !makeApiKey) {
    try { await db.from('booking_notifications').upsert({ ...base, status:'failed', attempts:1, last_error:'Make notification secrets are not configured.' }, { onConflict:'dedupe_key' }) } catch {}
    return { sentAny:false, queued:false, error:'Make notification secrets are not configured.' }
  }
  try {
    await db.from('booking_notifications').upsert({ ...base, status:'pending', attempts:1, last_error:null }, { onConflict:'dedupe_key' })
    const response = await fetch(makeWebhookUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-make-apikey':makeApiKey }, body:JSON.stringify(payload) })
    const raw = await response.text()
    if (!response.ok) throw new Error(`Make webhook ${response.status}: ${raw.slice(0, 500)}`)
    await db.from('booking_notifications').update({ status:'sent', sent_at:new Date().toISOString(), last_error:null, provider_message_id:raw.slice(0,250) || null, updated_at:new Date().toISOString() }).eq('dedupe_key', key)
    return { sentAny:true, queued:true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try { await db.from('booking_notifications').update({ status:'failed', last_error:message, updated_at:new Date().toISOString() }).eq('dedupe_key', key) } catch {}
    console.error('Make payment notification failed', message)
    return { sentAny:false, queued:false, error:message }
  }
}
async function activeById(id: string) { if (!id) return null; const { data, error } = await db.from('bookings').select('*').eq('id', id).maybeSingle(); if (error) throw new Error(error.message); return data as Row | null }
async function activeByNumber(number: string) { if (!number) return null; const { data, error } = await db.from('bookings').select('*').eq('booking_number', number).maybeSingle(); if (error) throw new Error(error.message); return data as Row | null }
async function draftById(id: string) { if (!id) return null; const { data, error } = await db.from('booking_drafts').select('*').eq('id', id).maybeSingle(); if (error) throw new Error(error.message); return data as Row | null }
function paymentPatch(row: Row, session: Stripe.Checkout.Session, amountCents: number, paymentType: string) {
  const currentPaidCents = Math.max(0, Math.round(Math.max(Number(row.paid_amount || 0), Number(row.deposit_amount || 0)) * 100))
  const currentDepositCents = Math.max(0, Math.round(Number(row.deposit_amount || 0) * 100))
  const requiredDepositCents = Math.max(10000, Number(row.deposit_required_cents || 10000))
  const currentBalance = Math.max(0, Number(row.balance_due_cents || 0))
  const newBalance = paymentType === 'full_balance' ? 0 : Math.max(0, currentBalance - amountCents)
  const paidAmountCents = currentPaidCents + amountCents
  const depositAmountCents = Math.min(requiredDepositCents, Math.max(currentDepositCents, paidAmountCents))
  const depositDueCents = Math.max(0, requiredDepositCents - depositAmountCents)
  const full = newBalance <= 0
  const depositCovered = depositDueCents <= 0
  return {
    request_status:'submitted',
    status:full ? 'New request - paid in full' : depositCovered ? 'New request - deposit paid' : 'New request - partial payment received',
    activated_at:new Date().toISOString(),
    checkout_expires_at:null,
    abandoned_at:null,
    deposit_status:depositCovered ? 'paid' : 'partially_paid',
    deposit_amount:depositAmountCents / 100,
    paid_amount:paidAmountCents / 100,
    deposit_due_cents:depositDueCents,
    balance_due_cents:newBalance,
    deposit_deferred:!depositCovered,
    deposit_paid_at:depositCovered ? (row.deposit_paid_at || new Date().toISOString()) : row.deposit_paid_at,
    stripe_checkout_session_id:session.id,
    stripe_payment_intent_id:String(session.payment_intent || ''),
    payment_preference:'stripe',
    payment_verification_status:'verified',
    payment_status:full ? 'paid in full' : depositCovered ? 'deposit received' : 'partial payment received'
  }
}
async function promotePaidDraft(draft: Row, session: Stripe.Checkout.Session, amountCents: number, paymentType: string) {
  const existing = await activeByNumber(text(draft.booking_number)); if (existing) return existing
  const { draft_status, draft_updated_at, finalized_at, ...payload } = draft
  Object.assign(payload, paymentPatch(draft, session, amountCents, paymentType))
  const { data, error } = await db.from('bookings').insert(payload).select('*').single()
  if (error) { const retry = await activeByNumber(text(draft.booking_number)); if (retry) return retry; throw new Error(error.message) }
  await db.from('booking_drafts').delete().eq('id', draft.id)
  return data as Row
}
async function updateActive(booking: Row, session: Stripe.Checkout.Session, amountCents: number, paymentType: string) {
  const sameVerifiedSession = String(booking.stripe_checkout_session_id || '') === session.id && String(booking.payment_verification_status || '') === 'verified'
  if (sameVerifiedSession) return booking
  const alreadyFull = Number(booking.balance_due_cents || 0) <= 0 && String(booking.payment_verification_status || '') === 'verified'
  const alreadyDeposit = paymentType === 'deposit' && ['paid','paid_by_benefits'].includes(String(booking.deposit_status || '')) && String(booking.payment_verification_status || '') === 'verified'
  if (alreadyFull || alreadyDeposit) return booking
  const { data, error } = await db.from('bookings').update(paymentPatch(booking, session, amountCents, paymentType)).eq('id', booking.id).select('*').single()
  if (error) throw new Error(error.message); return data as Row
}
async function logEvent(event: Stripe.Event, session: Stripe.Checkout.Session, bookingId: string | null, paymentType: string, amountCents: number, extra: Record<string, any> = {}) {
  const { error } = await db.from('payment_events').upsert({ booking_id:bookingId, provider:'stripe', provider_event_id:event.id, event_type:event.type, amount:amountCents/100, currency:session.currency || 'usd', payment_status:session.payment_status || session.status || null, raw_summary:{ object_id:session.id, payment_intent:session.payment_intent, payment_type:paymentType, expected_amount_cents:session.metadata?.expected_amount_cents || null, ...extra } }, { onConflict:'provider_event_id', ignoreDuplicates:true })
  if (error) throw new Error(`Payment event log failed: ${error.message}`)
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status:405 })
  if (!secretKey || !webhookSecret) return new Response('Webhook server is not configured', { status:500 })
  const sig = req.headers.get('stripe-signature'); if (!sig) return new Response('Missing Stripe signature', { status:400 })
  const raw = await req.text(); let event: Stripe.Event
  try { event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret, undefined, cryptoProvider) }
  catch (error) { return new Response(`Invalid signature: ${error instanceof Error ? error.message : 'unknown'}`, { status:400 }) }
  if (!['checkout.session.completed','checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)) return new Response('ignored', { status:200 })
  const session = event.data.object as Stripe.Checkout.Session
  const meta = session.metadata || {}, paymentType = meta.payment_type || 'deposit', draftId = meta.draft_id || '', bookingId = meta.booking_id || '', bookingNumber = meta.booking_number || session.client_reference_id || '', amountCents = Number(session.amount_total || 0)
  try {
    if (event.type === 'checkout.session.completed' && session.payment_status === 'paid' && ['deposit','full_balance','custom'].includes(paymentType)) {
      const expected = Number(meta.expected_amount_cents || 0)
      if (expected <= 0 || expected !== amountCents) return new Response('Amount mismatch', { status:400 })
      let booking: Row | null = null
      if (draftId) {
        const draft = await draftById(draftId)
        if (draft) booking = await promotePaidDraft(draft, session, amountCents, paymentType)
        else booking = await activeById(draftId) || await activeByNumber(bookingNumber)
      } else if (bookingId) booking = await activeById(bookingId)
      if (!booking) booking = await activeByNumber(bookingNumber)
      if (!booking) return new Response('Booking reference missing', { status:400 })
      booking = await updateActive(booking, session, amountCents, paymentType)
      await logEvent(event, session, booking.id, paymentType, amountCents, { draft_id:draftId || null })
      const eventType = notificationType(paymentType, booking)
      await dispatchMake(booking, eventType, amountCents, session.id)
      return new Response('ok', { status:200 })
    }
    if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const patch = { payment_verification_status:event.type === 'checkout.session.expired' ? 'session_expired' : 'payment_failed', stripe_checkout_session_id:null }
      if (draftId) { const draftPatch: any = { ...patch }; if (paymentType !== 'full_balance') Object.assign(draftPatch, { deposit_status:'unpaid', deposit_deferred:true }); await db.from('booking_drafts').update(draftPatch).eq('id', draftId) }
      if (bookingId) await db.from('bookings').update(patch).eq('id', bookingId)
      const active = bookingId ? await activeById(bookingId) : await activeByNumber(bookingNumber)
      await logEvent(event, session, active?.id || null, paymentType, amountCents, { draft_id:draftId || null })
    }
    return new Response('ok', { status:200 })
  } catch (error) {
    console.error(error)
    return new Response(error instanceof Error ? error.message : String(error), { status:500 })
  }
})
