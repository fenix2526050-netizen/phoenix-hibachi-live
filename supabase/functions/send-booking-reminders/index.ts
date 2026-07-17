import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')
const makeWebhookUrl = Deno.env.get('MAKE_CUSTOMER_NOTIFICATIONS_WEBHOOK_URL') || ''
const makeApiKey = Deno.env.get('MAKE_CUSTOMER_NOTIFICATIONS_API_KEY') || ''
const cronSecret = Deno.env.get('REMINDER_CRON_SECRET') || ''
const sitePhone = Deno.env.get('SITE_PHONE') || '(516) 518-3325'
const companyEmail = Deno.env.get('BOOKING_COMPANY_EMAIL') || 'booking@phoenix-hibachi.com'
const websiteUrl = Deno.env.get('PUBLIC_SITE_ORIGIN') || 'https://phoenix-hibachi.com'
const timeZone = Deno.env.get('BOOKING_TIME_ZONE') || 'America/New_York'
type Row = Record<string, any>
type ReminderType = 'event_reminder_72h' | 'event_reminder_42h'
function text(v: unknown) { return String(v ?? '').trim() }
function lower(v: unknown) { return text(v).toLowerCase() }
function digits(v: unknown) { return text(v).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '') }
function phone(v: unknown) { const d = digits(v); return d.length === 10 ? `+1${d}` : '' }
function esc(v: unknown) { return text(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c)) }
function smsOptIn(b: Row) { return b.sms_opt_in === true || lower(b.sms_opt_in) === 'true' }
function parseClock(raw: unknown) {
  const value = text(raw)
  const twelve = value.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
  if (twelve) { let h = Number(twelve[1]) % 12; if (twelve[3].toUpperCase() === 'PM') h += 12; return { h, m:Number(twelve[2] || 0) } }
  const twentyFour = value.match(/\b(\d{1,2}):(\d{2})/)
  return twentyFour ? { h:Number(twentyFour[1]), m:Number(twentyFour[2]) } : { h:16, m:0 }
}
function offsetAt(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(date)
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return Date.UTC(Number(map.year), Number(map.month)-1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second)) - date.getTime()
}
function eventUtc(b: Row) {
  const date = text(b.event_date); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const { h, m } = parseClock(b.event_time)
  const [y, mo, d] = date.split('-').map(Number)
  const guess = new Date(Date.UTC(y, mo-1, d, h, m, 0))
  const first = new Date(guess.getTime() - offsetAt(guess, timeZone))
  return new Date(guess.getTime() - offsetAt(first, timeZone))
}
function payloadFor(b: Row, eventType: ReminderType) {
  const balanceDue = Number(b.balance_due_cents || 0) / 100
  const when = `${text(b.event_date)} at ${text(b.event_time)}`
  const isFinalCount = eventType === 'event_reminder_42h'
  const subject = isFinalCount ? `Phoenix Hibachi final-count reminder – ${b.booking_number}` : `Phoenix Hibachi 72-hour reminder – ${b.booking_number}`
  const title = isFinalCount ? 'Final guest count and menu deadline' : 'Your Phoenix Hibachi event is coming up'
  const lead = isFinalCount ? `Booking ${b.booking_number} is about 42 hours away. Final guest count and food selections now need confirmation.` : `Reminder: booking ${b.booking_number} is scheduled for ${when}.`
  const detail = isFinalCount
    ? 'Please reply with any final guest-count, protein, allergy, address, or access corrections. Fewer attendees after the deadline do not reduce the confirmed balance.'
    : 'Please confirm the event address, parking/unloading access, weather backup, allergies, and a safe level cooking area.'
  const sms = isFinalCount
    ? `Phoenix Hibachi: Final-count reminder for ${b.booking_number} (${when}). Confirm guests, proteins, allergies, address, and access now. ${sitePhone}. Reply STOP to opt out.`
    : `Phoenix Hibachi reminder: ${b.booking_number} is scheduled for ${when}. Please confirm access, parking, weather backup, and final guest details. ${sitePhone}. Reply STOP to opt out.`
  const emailText = `${title}\n\n${lead}\n\n${detail}\n\nBalance due: $${balanceDue.toFixed(2)}\nQuestions? ${sitePhone}\n${websiteUrl}`
  const emailHtml = `<div style="font-family:Arial,sans-serif;color:#21160b;line-height:1.55;max-width:620px;margin:auto"><div style="border:1px solid #d69a28;border-radius:16px;overflow:hidden"><div style="background:#170e05;color:#ffd36b;padding:20px 24px"><strong style="font-size:21px">Phoenix Hibachi</strong></div><div style="padding:24px"><h2 style="color:#9a5d08;margin-top:0">${esc(title)}</h2><p>${esc(lead)}</p><p>${esc(detail)}</p><p><b>Event:</b> ${esc(when)}<br><b>Balance due:</b> $${balanceDue.toFixed(2)}</p><p>Questions? Call or text <a href="tel:+15165183325">${esc(sitePhone)}</a>.</p></div></div><p style="font-size:12px;color:#6c6258;text-align:center">${esc(companyEmail)} · <a href="${esc(websiteUrl)}">${esc(websiteUrl.replace(/^https?:\/\//,''))}</a></p></div>`
  return { event_type:eventType, notification_type:eventType, booking_number:text(b.booking_number), customer_name:text(b.customer_name), customer_phone:phone(b.customer_phone), customer_email:lower(b.customer_email), event_date:text(b.event_date), event_time:text(b.event_time), payment_status:text(b.payment_status), deposit_status:text(b.deposit_status), amount_paid:Number(b.paid_amount || b.deposit_amount || 0), balance_due:Number(balanceDue.toFixed(2)), currency:'USD', sms_opt_in:smsOptIn(b), sms_content:sms, email_subject:subject, email_html:emailHtml, email_text:emailText, source:'supabase_booking_reminder_cron', occurred_at:new Date().toISOString() }
}
async function dispatch(b: Row, eventType: ReminderType) {
  const payload = payloadFor(b, eventType), key = `${b.id}:${eventType}:make:${b.event_date}`
  const { data: prior } = await db.from('booking_notifications').select('status').eq('dedupe_key', key).maybeSingle()
  if (prior?.status === 'sent') return { sent:true, duplicate:true }
  const base = { booking_id:b.id, notification_type:eventType, recipient_type:'customer', recipient_email:payload.customer_email || null, recipient_phone:payload.customer_phone || null, channel:'make', payload, dedupe_key:key, updated_at:new Date().toISOString() }
  if (!makeWebhookUrl || !makeApiKey) throw new Error('Make notification secrets are not configured.')
  await db.from('booking_notifications').upsert({ ...base, status:'pending', attempts:1, last_error:null }, { onConflict:'dedupe_key' })
  try {
    const response = await fetch(makeWebhookUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-make-apikey':makeApiKey }, body:JSON.stringify(payload) })
    const raw = await response.text(); if (!response.ok) throw new Error(`Make webhook ${response.status}: ${raw.slice(0, 500)}`)
    await db.from('booking_notifications').update({ status:'sent', sent_at:new Date().toISOString(), last_error:null, provider_message_id:raw.slice(0,250) || null, updated_at:new Date().toISOString() }).eq('dedupe_key', key)
    const column = eventType === 'event_reminder_42h' ? 'reminder_42h_sent_at' : 'reminder_72h_sent_at'
    await db.from('bookings').update({ [column]:new Date().toISOString() }).eq('id', b.id)
    return { sent:true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db.from('booking_notifications').update({ status:'failed', last_error:message, updated_at:new Date().toISOString() }).eq('dedupe_key', key)
    return { sent:false, error:message }
  }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok:false, error:'Method not allowed' }), { status:405, headers:{'Content-Type':'application/json'} })
  const supplied = req.headers.get('x-cron-secret') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!cronSecret || supplied !== cronSecret) return new Response(JSON.stringify({ ok:false, error:'Unauthorized' }), { status:401, headers:{'Content-Type':'application/json'} })
  const today = new Date().toISOString().slice(0,10)
  const max = new Date(Date.now() + 5*24*60*60*1000).toISOString().slice(0,10)
  const { data, error } = await db.from('bookings').select('*').gte('event_date', today).lte('event_date', max).limit(200)
  if (error) return new Response(JSON.stringify({ ok:false, error:error.message }), { status:500, headers:{'Content-Type':'application/json'} })
  const now = Date.now(), results: any[] = []
  for (const b of (data || []) as Row[]) {
    const state = `${lower(b.request_status)} ${lower(b.status)}`
    if (/draft|abandon|expired|cancel|deleted|removed|complete/.test(state)) continue
    if (!/(confirm|accept)/.test(state)) continue
    const event = eventUtc(b); if (!event) continue
    const hours = (event.getTime() - now) / 3600000
    if (!b.reminder_72h_sent_at && hours >= 71 && hours <= 73) results.push({ booking_number:b.booking_number, type:'72h', hours:Number(hours.toFixed(2)), ...(await dispatch(b, 'event_reminder_72h')) })
    if (!b.reminder_42h_sent_at && hours >= 41 && hours <= 43) results.push({ booking_number:b.booking_number, type:'42h', hours:Number(hours.toFixed(2)), ...(await dispatch(b, 'event_reminder_42h')) })
  }
  return new Response(JSON.stringify({ ok:true, checked:(data || []).length, processed:results.length, results }), { status:200, headers:{'Content-Type':'application/json'} })
})
