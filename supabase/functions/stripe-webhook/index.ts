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
function linkHtml(label: unknown, href: string) {
  const shown = text(label)
  return shown && href ? `<a href="${esc(href)}" style="color:#0645ad;text-decoration:underline;font-weight:700">${esc(shown)}</a>` : esc(shown)
}
function mapHref(v: unknown) {
  const address = text(v)
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : ''
}
function phoneHref(v: unknown) {
  const normalized = phone(v)
  return normalized ? `tel:${normalized}` : ''
}
function mailHref(v: unknown) {
  const email = lower(v)
  return email ? `mailto:${email}` : ''
}
function detailValueHtml(label: unknown, value: unknown) {
  const key = lower(label)
  if (key === 'address' || key === 'full address' || key === 'event address') return linkHtml(value, mapHref(value))
  if (key === 'phone') return linkHtml(value, phoneHref(value))
  if (key === 'email') return linkHtml(value, mailHref(value))
  return esc(value)
}
function cents(v: unknown) { return Math.max(0, Math.round(Number(v || 0))) }
function moneyCents(v: unknown) { return `$${(cents(v) / 100).toFixed(2)}` }
function moneyDollars(v: unknown) { return `$${Math.max(0, Number(v || 0)).toFixed(2)}` }
function smsOptIn(b: Row) { return b.sms_opt_in === true || lower(b.sms_opt_in) === 'true' }
function displayText(v: unknown) {
  if (Array.isArray(v)) return v.map(item => typeof item === 'string' ? item : text((item as Row)?.name || (item as Row)?.title || JSON.stringify(item))).filter(Boolean).join(', ')
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${text(value)}`)
      .filter(part => !part.endsWith(': '))
      .join(', ')
  }
  return text(v)
}
function noteValue(b: Row, label: string) {
  const safe = text(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const notes = [b.service_notes, b.admin_notes, b.customer_notes, b.special_requests].map(text).filter(Boolean).join('\n')
  const match = notes.match(new RegExp(`(?:^|\\n)${safe}:\\s*([^\\n]+)`, 'i'))
  return match ? match[1].trim() : ''
}
function moneyField(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const num = Number(String(value).replace(/[$,]/g, ''))
    if (Number.isFinite(num)) return Math.max(0, num)
  }
  return 0
}
function centsField(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const num = Number(String(value).replace(/[$,]/g, ''))
    if (Number.isFinite(num)) return Math.max(0, num / 100)
  }
  return 0
}
function njTollFee(b: Row) {
  return moneyField(b.nj_toll_fee, b.njTollFee, b.toll_fee, b.tollFee, noteValue(b, 'NJ Toll Fee'), noteValue(b, 'New Jersey Toll Fee'))
}
function travelFee(b: Row) { return moneyField(b.travel_fee, b.travelFee) }
function salesTax(b: Row) { return moneyField(b.sales_tax, centsField(b.sales_tax_cents)) }
function paidAmount(b: Row, fallback = 0) { return moneyField(b.paid_amount, b.deposit_amount, b.amount_paid, fallback) }
function balanceDueDollars(b: Row) {
  if (b.balance_due_cents !== null && b.balance_due_cents !== undefined && b.balance_due_cents !== '') return centsField(b.balance_due_cents)
  if (b.balance_due !== null && b.balance_due !== undefined && b.balance_due !== '') return moneyField(b.balance_due)
  return moneyField(b.balanceDue)
}
function finalTotalDollars(b: Row, paid = 0, balance = 0) {
  if (b.final_total !== null && b.final_total !== undefined && b.final_total !== '') return moneyField(b.final_total)
  if (b.finalTotal !== null && b.finalTotal !== undefined && b.finalTotal !== '') return moneyField(b.finalTotal)
  if (b.order_total_cents !== null && b.order_total_cents !== undefined && b.order_total_cents !== '') return centsField(b.order_total_cents)
  if (b.guest_total_before_deposit !== null && b.guest_total_before_deposit !== undefined && b.guest_total_before_deposit !== '') return moneyField(b.guest_total_before_deposit)
  return Math.max(0, paid + balance)
}
function notesSummary(b: Row) { return text(b.service_notes || b.customer_notes || b.special_requests || b.admin_notes).slice(0, 700) }
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
  const address = text(b.address || b.event_address)
  const adults = Number(b.adults || 0)
  const kids = Number(b.kids || 0)
  const guestCount = Number(b.guest_count || adults + kids || 0)
  const packageName = text(b.package_name || b.package || '')
  const addOns = displayText(b.add_ons || b.addons)
  const proteins = displayText(b.protein_summary || b.protein_selections)
  const allergies = displayText(b.allergies || b.allergy_notes || b.allergyNotes)
  const notes = notesSummary(b)
  const travel = travelFee(b)
  const toll = njTollFee(b)
  const tax = salesTax(b)
  const paid = paidAmount(b, amountPaid)
  const finalTotal = finalTotalDollars(b, paid, balanceDue)
  const managerDiscount = moneyField(b.manager_discount)
  const couponDiscount = moneyField(b.coupon_discount)
  const couponCode = text(b.applied_coupon_code)
  const feeLines = [`Travel Fee ${moneyDollars(travel)}`]
  if (toll > 0) feeLines.push(`NJ Toll Fee ${moneyDollars(toll)}`)
  if (managerDiscount > 0) feeLines.push(`Manager Discount -${moneyDollars(managerDiscount)}`)
  if (couponDiscount > 0) feeLines.push(`Coupon ${couponCode || ''} -${moneyDollars(couponDiscount)}`.trim())
  feeLines.push(`Final Total ${moneyDollars(finalTotal)}`, `Balance Due ${moneyDollars(balanceDue)}`)
  const detailedSmsContent = `Phoenix Hibachi ${text(b.booking_number)} ${title}. ${text(b.customer_name)} ${text(b.event_date)} ${text(b.event_time)}. Address: ${address || '-'}. ${feeLines.join('; ')}. ${sitePhone}. Reply STOP to opt out.`
  const detailRows = [
    ['Booking', b.booking_number],
    ['Customer', b.customer_name],
    ['Phone', b.customer_phone],
    ['Email', b.customer_email],
    ['Date', b.event_date],
    ['Time', b.event_time],
    ['Address', address],
    ['Guests', `${adults} adults / ${kids} kids${guestCount ? ` / ${guestCount} total` : ''}`],
    ['Package', packageName],
    ['Add-ons', addOns],
    ['Protein selections', proteins],
    ['Allergies', allergies],
    ['Travel Fee', moneyDollars(travel)],
    ...(toll > 0 ? [['NJ Toll Fee', moneyDollars(toll)] as [string, unknown]] : []),
    ['Sales Tax', moneyDollars(tax)],
    ...(managerDiscount > 0 ? [['Manager Discount', `-${moneyDollars(managerDiscount)}`] as [string, unknown]] : []),
    ...(couponDiscount > 0 ? [[`Coupon ${couponCode}`, `-${moneyDollars(couponDiscount)}`] as [string, unknown]] : []),
    ['Final Total', moneyDollars(finalTotal)],
    ['Paid', moneyDollars(paid)],
    ['Balance Due', moneyDollars(balanceDue)],
    ['Payment status', b.payment_status],
    ['Notes', notes]
  ].filter(([, value]) => text(value))
  const detailedEmailTextContent = `${title}\n\n${lead}\n\n${detailRows.map(([label, value]) => `${label}: ${text(value)}`).join('\n')}\n\nQuestions? Call or text ${sitePhone}.\n${websiteUrl}`
  const detailedEmailHtmlContent = `<div style="font-family:Arial,sans-serif;color:#21160b;line-height:1.55;max-width:720px;margin:auto"><div style="border:1px solid #d69a28;border-radius:16px;overflow:hidden"><div style="background:#170e05;color:#ffd36b;padding:20px 24px"><strong style="font-size:21px">Phoenix Hibachi</strong><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase">Private Backyard Catering</div></div><div style="padding:24px"><h2 style="color:#9a5d08;margin-top:0">${esc(title)}</h2><p>${esc(lead)}</p><table cellpadding="8" style="border-collapse:collapse;width:100%;background:#fffaf1">${detailRows.map(([label, value]) => `<tr><td style="border-bottom:1px solid #eadbc0"><b>${esc(label)}</b></td><td style="border-bottom:1px solid #eadbc0">${detailValueHtml(label, value)}</td></tr>`).join('')}</table><p style="margin-bottom:0">Questions? Call or text <a href="${esc(phoneHref(sitePhone) || 'tel:+15165183325')}" style="color:#0645ad;text-decoration:underline;font-weight:700">${esc(sitePhone)}</a> or reply to this email.</p></div></div><p style="font-size:12px;color:#6c6258;text-align:center"><a href="${esc(mailHref(companyEmail))}" style="color:#0645ad;text-decoration:underline">${esc(companyEmail)}</a> &middot; <a href="${esc(websiteUrl)}" style="color:#0645ad;text-decoration:underline">${esc(websiteUrl.replace(/^https?:\/\//,''))}</a></p></div>`
  return {
    event_type:eventType,
    notification_type:eventType,
    booking_number:text(b.booking_number),
    customer_name:text(b.customer_name),
    customer_phone:phone(b.customer_phone),
    customer_email:lower(b.customer_email),
    event_date:text(b.event_date),
    event_time:text(b.event_time),
    event_address:address,
    full_address:address,
    map_url:mapHref(address),
    adults,
    kids,
    guest_count:guestCount,
    package_name:packageName,
    add_ons:addOns,
    protein_summary:proteins,
    allergies,
    notes,
    travel_fee:Number(travel.toFixed(2)),
    nj_toll_fee:Number(toll.toFixed(2)),
    sales_tax:Number(tax.toFixed(2)),
    manager_discount:Number(managerDiscount.toFixed(2)),
    coupon_discount:Number(couponDiscount.toFixed(2)),
    applied_coupon_code:couponCode,
    final_total:Number(finalTotal.toFixed(2)),
    payment_status:text(b.payment_status),
    deposit_status:text(b.deposit_status),
    amount_paid:Number(paid.toFixed(2)),
    paid:Number(paid.toFixed(2)),
    balance_due:Number(balanceDue.toFixed(2)),
    currency:'USD',
    sms_opt_in:smsOptIn(b),
    sms_content:detailedSmsContent,
    internal_sms_content:detailedSmsContent,
    email_subject:subject,
    email_html:detailedEmailHtmlContent,
    email_text:detailedEmailTextContent,
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
async function redeemCouponForSession(booking: Row, session: Stripe.Checkout.Session, draftId: string) {
  const meta = session.metadata || {}
  const couponId = text(meta.coupon_id)
  const couponCode = text(meta.coupon_code).toUpperCase()
  const discount = Math.max(0, Number(meta.coupon_discount_cents || 0)) / 100
  if (!couponId || !couponCode || discount <= 0) return booking
  const currentCode = text(booking.applied_coupon_code).toUpperCase()
  const currentDiscount = moneyField(booking.coupon_discount)
  const managerDiscount = moneyField(booking.manager_discount)
  if (managerDiscount > 0 || currentCode !== couponCode || Math.abs(currentDiscount - discount) > 0.005) {
    await releaseCouponForSession(session.id)
    return booking
  }

  const reservationId = text(meta.coupon_reservation_id)
  let reservation: Row | null = null
  if (reservationId) {
    const { data, error } = await db.from('coupon_redemptions').select('*').eq('id', reservationId).maybeSingle()
    if (error) throw new Error(error.message)
    reservation = data as Row | null
  }
  if (!reservation) {
    const { data, error } = await db.from('coupon_redemptions').select('*').eq('checkout_session_id', session.id).maybeSingle()
    if (error) throw new Error(error.message)
    reservation = data as Row | null
  }
  if (!reservation) {
    const { data, error } = await db.rpc('phx_reserve_coupon_redemption', {
      p_coupon_id:couponId,
      p_booking_id:booking.id,
      p_draft_id:null,
      p_customer_id:booking.customer_id || null,
      p_customer_email:lower(booking.customer_email) || null,
      p_code:couponCode,
      p_discount:discount,
    })
    if (error) throw new Error(error.message)
    const { data: created, error: createdError } = await db.from('coupon_redemptions').select('*').eq('id', data).single()
    if (createdError) throw new Error(createdError.message)
    reservation = created as Row
  }

  if (lower(reservation.status) !== 'redeemed') {
    await db.from('coupon_redemptions').update({
      status:'released',
      released_at:new Date().toISOString(),
    }).eq('booking_id', booking.id).eq('status', 'reserved').neq('id', reservation.id)

    const { error: redeemError } = await db.from('coupon_redemptions').update({
      booking_id:booking.id,
      draft_id:null,
      customer_id:booking.customer_id || null,
      customer_email:lower(booking.customer_email) || null,
      code:couponCode,
      discount_amount:discount,
      status:'redeemed',
      redeemed_at:new Date().toISOString(),
      released_at:null,
      checkout_session_id:session.id,
    }).eq('id', reservation.id)
    if (redeemError) throw new Error(redeemError.message)
  }

  const couponPatch = {
    applied_coupon_id:couponId,
    applied_coupon_code:couponCode,
    coupon_discount:discount,
  }
  const { data: updated, error: bookingError } = await db.from('bookings').update(couponPatch).eq('id', booking.id).select('*').single()
  if (bookingError) throw new Error(bookingError.message)
  return updated as Row
}
async function releaseCouponForSession(sessionId: string) {
  if (!sessionId) return
  const { error } = await db.from('coupon_redemptions').update({
    status:'released',
    released_at:new Date().toISOString(),
  }).eq('checkout_session_id', sessionId).eq('status', 'reserved')
  if (error) throw new Error(error.message)
}
async function promotePaidDraft(draft: Row) {
  const patch = {
    request_status:'submitted',
    status:'New request - payment verification pending',
    activated_at:new Date().toISOString(),
    checkout_expires_at:null,
    abandoned_at:null,
  }
  const { data, error } = await db.rpc('phx_promote_booking_draft', { p_draft_id:draft.id, p_patch:patch })
  if (error) throw new Error(`Paid draft promotion failed: ${error.message}`)
  if (!data?.id) throw new Error('Paid draft promotion did not return the booking.')
  return data as Row
}
async function applyStripePayment(event: Stripe.Event, booking: Row, session: Stripe.Checkout.Session, amountCents: number, paymentType: string) {
  const { data, error } = await db.rpc('phx_apply_stripe_checkout_payment', {
    p_event_id:event.id,
    p_booking_id:booking.id,
    p_session_id:session.id,
    p_payment_intent_id:String(session.payment_intent || ''),
    p_amount_cents:amountCents,
    p_payment_type:paymentType,
    p_currency:session.currency || 'usd',
    p_event_type:event.type,
    p_raw_summary:{
      object_id:session.id,
      payment_intent:session.payment_intent || null,
      payment_type:paymentType,
      expected_amount_cents:session.metadata?.expected_amount_cents || null,
      draft_id:session.metadata?.draft_id || null,
      coupon_code:session.metadata?.coupon_code || null,
      coupon_discount_cents:session.metadata?.coupon_discount_cents || null,
    },
  })
  if (error) throw new Error(`Atomic Stripe payment update failed: ${error.message}`)
  const updated = data?.booking as Row | undefined
  if (!updated?.id) throw new Error('Atomic Stripe payment update did not return the booking.')
  return { booking:updated, applied:data?.applied === true }
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
        if (draft) booking = await promotePaidDraft(draft)
        else booking = await activeById(draftId) || await activeByNumber(bookingNumber)
      } else if (bookingId) booking = await activeById(bookingId)
      if (!booking) booking = await activeByNumber(bookingNumber)
      if (!booking) return new Response('Booking reference missing', { status:400 })
      const appliedPayment = await applyStripePayment(event, booking, session, amountCents, paymentType)
      booking = await redeemCouponForSession(appliedPayment.booking, session, draftId)
      const eventType = notificationType(paymentType, booking)
      await dispatchMake(booking, eventType, amountCents, session.id)
      return new Response('ok', { status:200 })
    }
    if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      await releaseCouponForSession(session.id)
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
