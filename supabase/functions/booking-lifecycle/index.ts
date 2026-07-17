import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
const configuredOrigin = (Deno.env.get('PUBLIC_SITE_ORIGIN') || 'https://phoenix-hibachi.com').replace(/\/$/, '')
const allowedOrigins = new Set([configuredOrigin, 'https://www.phoenix-hibachi.com'])
const makeWebhookUrl = Deno.env.get('MAKE_CUSTOMER_NOTIFICATIONS_WEBHOOK_URL') || ''
const makeApiKey = Deno.env.get('MAKE_CUSTOMER_NOTIFICATIONS_API_KEY') || ''
const companyEmail = Deno.env.get('BOOKING_COMPANY_EMAIL') || 'booking@phoenix-hibachi.com'
const sitePhone = Deno.env.get('SITE_PHONE') || '(516) 518-3325'
const websiteUrl = Deno.env.get('PUBLIC_SITE_ORIGIN') || 'https://phoenix-hibachi.com'
const logoUrl = (Deno.env.get('SITE_LOGO_URL') || '').trim()

type Row = Record<string, any>
type EventType = 'booking_request_received' | 'booking_confirmed' | 'deposit_paid' | 'paid_in_full' | 'booking_rescheduled' | 'booking_cancelled' | 'event_reminder_72h'

function cors(req: Request) {
  const requested = req.headers.get('origin') || configuredOrigin
  const origin = allowedOrigins.has(requested) ? requested : configuredOrigin
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })
}
function text(v: unknown) { return String(v ?? '').trim() }
function lower(v: unknown) { return text(v).toLowerCase() }
function digits(v: unknown) { return text(v).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '') }
function normalizePhone(v: unknown) { const d = digits(v); return d.length === 10 ? `+1${d}` : '' }
function normalizeNumber(v: unknown) {
  const raw = text(v).replace(/[\u200B-\u200D\uFEFF]/g, '')
  return raw.toUpperCase().match(/PHX-\d{6}-[A-Z0-9]{4,12}/)?.[0] || raw.toUpperCase()
}
function esc(v: unknown) { return text(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c)) }
function cents(v: unknown) { return Math.max(0, Math.round(Number(v || 0))) }
function dollars(v: unknown) { return Math.max(0, Number(v || 0)) }
function moneyFromCents(v: unknown) { return `$${(cents(v) / 100).toFixed(2)}` }
function moneyFromDollars(v: unknown) { return `$${dollars(v).toFixed(2)}` }
function isSmsOptedIn(b: Row) { return b.sms_opt_in === true || lower(b.sms_opt_in) === 'true' }
function activeBooking(b: Row) {
  const state = `${lower(b.request_status)} ${lower(b.status)}`
  if (/draft|abandon|expired|cancel|deleted|removed|complete/.test(state)) return false
  if (b.event_date && String(b.event_date) < new Date().toISOString().slice(0, 10)) return false
  return true
}
function publicOrder(b: Row) {
  return {
    id: b.booking_number, booking_number: b.booking_number, eventDate: b.event_date, eventTime: b.event_time,
    status: b.status, requestStatus: b.request_status, paymentStatus: b.payment_status, depositStatus: b.deposit_status,
    depositPaid: Number(b.deposit_amount || 0), depositDueCents: Number(b.deposit_due_cents || 0), balanceDueCents: Number(b.balance_due_cents || 0),
    name: b.customer_name ? `${text(b.customer_name).slice(0, 1)}***` : 'Guest', phone: b.customer_phone ? `***${digits(b.customer_phone).slice(-4)}` : '',
    email: b.customer_email ? text(b.customer_email).replace(/^(.).+(@.+)$/, '$1***$2') : '',
    address: b.address ? text(b.address).split(',').slice(-2).join(',').trim() : '', package: b.package_name || 'Classic',
    adults: Number(b.adults || 0), kids: Number(b.kids || 0), totalGuests: Number(b.guest_count || 0), travelFee: Number(b.travel_fee || 0), finalTotal: Number(b.final_total || 0),
  }
}
async function sha256(raw: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('')
}
async function getActive(number: string) {
  const { data, error } = await service.from('bookings').select('*').eq('booking_number', number).order('created_at', { ascending: false }).limit(1)
  if (error) throw new Error(`Booking lookup failed: ${error.message}`)
  return (data?.[0] as Row | undefined) || null
}
async function getDraft(number: string) {
  const { data, error } = await service.from('booking_drafts').select('*').eq('booking_number', number).order('created_at', { ascending: false }).limit(1)
  if (error) throw new Error(`Draft lookup failed: ${error.message}`)
  return (data?.[0] as Row | undefined) || null
}
async function validateDraft(draft: Row, rawToken: string, suppliedEmail: string) {
  const recent = Date.now() - new Date(draft.created_at || 0).getTime() <= 2 * 60 * 60 * 1000
  if (rawToken && draft.payment_access_token_hash && await sha256(rawToken) === draft.payment_access_token_hash) return true
  return recent && suppliedEmail && lower(draft.customer_email) === lower(suppliedEmail)
}
async function expireDrafts() {
  const now = new Date().toISOString()
  const { error } = await service.from('booking_drafts').update({ draft_status:'expired', request_status:'expired', status:'Expired', abandoned_at:now, draft_updated_at:now }).eq('draft_status', 'open').lt('checkout_expires_at', now)
  if (error) console.warn('Draft expiry cleanup skipped', error.message)
}
async function promoteDraft(draft: Row, patch: Record<string, any>) {
  const existing = await getActive(text(draft.booking_number)); if (existing) return existing
  const { draft_status, draft_updated_at, finalized_at, ...payload } = draft
  Object.assign(payload, patch, { activated_at:patch.activated_at || new Date().toISOString(), checkout_expires_at:null, abandoned_at:null })
  const { data, error } = await service.from('bookings').insert(payload).select('*').single()
  if (error) { const again = await getActive(text(draft.booking_number)); if (again) return again; throw new Error(`Active booking creation failed: ${error.message}`) }
  await service.from('booking_drafts').delete().eq('id', draft.id)
  return data as Row
}
async function adminRole(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim(); if (!token) return ''
  const { data, error } = await service.auth.getUser(token); if (error || !data.user) return ''
  const { data: profile } = await service.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  return lower(profile?.role || data.user.user_metadata?.role)
}
async function requireAdmin(req: Request) {
  const role = await adminRole(req)
  if (!['admin','manager','customer_service','customer service'].includes(role)) throw new Error('Admin or manager login is required.')
}

function copyFor(eventType: EventType, b: Row, extra: Record<string, any> = {}) {
  const ref = text(b.booking_number)
  const when = [formatEventDate(b.event_date), text(b.event_time)].filter(Boolean).join(' at ')
  const balance = moneyFromCents(b.balance_due_cents)
  const amountCents = cents(extra.amountCents || 0)
  const reason = text(extra.reason || b.cancellation_reason || 'Please contact Phoenix Hibachi for details.')
  switch (eventType) {
    case 'booking_confirmed': return {
      subject:`Phoenix Hibachi booking confirmed – ${ref}`,
      title:'Your Phoenix Hibachi booking is confirmed',
      lead:`Great news — booking ${ref} is confirmed for ${when}.`,
      nextStep:'Your date and time are reserved. Please review the event details below and reply if anything needs to be corrected.',
      sms:`Phoenix Hibachi: ${ref} is confirmed for ${when}. Balance ${balance}. Questions? ${sitePhone}. Reply STOP to opt out.`
    }
    case 'deposit_paid': return {
      subject:`Phoenix Hibachi deposit received – ${ref}`,
      title:'Your deposit was received',
      lead:`We recorded ${moneyFromCents(amountCents || Number(b.deposit_amount || 0) * 100)} toward booking ${ref}.`,
      nextStep:'Your payment has been applied to the booking. The remaining balance is shown below.',
      sms:`Phoenix Hibachi: Deposit received for ${ref}. Paid ${moneyFromCents(amountCents || Number(b.deposit_amount || 0) * 100)}; balance ${balance}. ${sitePhone}. Reply STOP to opt out.`
    }
    case 'paid_in_full': return {
      subject:`Phoenix Hibachi paid in full – ${ref}`,
      title:'Payment in full received',
      lead:`Booking ${ref} now has a $0.00 balance.`,
      nextStep:'Your booking is fully paid. Keep this email for your records and review the event details below.',
      sms:`Phoenix Hibachi: ${ref} is paid in full. Balance $0.00. Thank you! ${sitePhone}. Reply STOP to opt out.`
    }
    case 'booking_rescheduled': return {
      subject:`Phoenix Hibachi schedule updated – ${ref}`,
      title:'Your event schedule was updated',
      lead:`Booking ${ref} is now scheduled for ${when}.`,
      nextStep:'Please review the updated date and time below and reply immediately if anything is incorrect.',
      sms:`Phoenix Hibachi: Schedule updated for ${ref}: ${when}. Please reply or call ${sitePhone} with questions. Reply STOP to opt out.`
    }
    case 'booking_cancelled': return {
      subject:`Phoenix Hibachi booking cancelled – ${ref}`,
      title:'Your booking was cancelled',
      lead:`Booking ${ref} has been cancelled. ${reason}`,
      nextStep:'Questions about this cancellation? Reply to this email or contact our team directly.',
      sms:`Phoenix Hibachi: ${ref} was cancelled. ${reason} Questions? ${sitePhone}. Reply STOP to opt out.`
    }
    case 'event_reminder_72h': return {
      subject:`Phoenix Hibachi 72-hour reminder – ${ref}`,
      title:'Your Phoenix Hibachi event is coming up',
      lead:`Reminder: booking ${ref} is scheduled for ${when}.`,
      nextStep:'Please confirm access, parking, weather backup, and final guest details before the event.',
      sms:`Phoenix Hibachi reminder: ${ref} is scheduled for ${when}. Please confirm access, parking, weather backup, and final guest details. ${sitePhone}. Reply STOP to opt out.`
    }
    default: return {
      subject:`Phoenix Hibachi booking request received – ${ref}`,
      title:'Your booking request was received',
      lead:`Booking ${ref} for ${when} is pending Phoenix Hibachi manager review.`,
      nextStep:'This is a request receipt, not the final confirmation. Our team will review availability and contact you with the next step.',
      sms:`Phoenix Hibachi: We received booking ${ref} for ${when}. It is pending manager confirmation. Save this number. ${sitePhone}. Reply STOP to opt out.`
    }
  }
}

function formatEventDate(v: unknown) {
  const raw = text(v)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return raw
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  return new Intl.DateTimeFormat('en-US', {
    weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'UTC'
  }).format(date)
}
function displayText(v: unknown) {
  if (Array.isArray(v)) return v.map(item => text(item)).filter(Boolean).join(', ')
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${text(value)}`)
      .filter(part => !part.endsWith(': '))
      .join(', ')
  }
  return text(v)
}
function formatPaymentMethod(v: unknown) {
  const raw = lower(v)
  if (!raw) return ''
  const known: Record<string, string> = {
    cash: 'Cash',
    card: 'Credit / debit card',
    credit_card: 'Credit / debit card',
    debit_card: 'Credit / debit card',
    stripe: 'Credit / debit card',
    zelle: 'Zelle',
    venmo: 'Venmo',
    cashapp: 'Cash App',
    cash_app: 'Cash App',
    paypal: 'PayPal',
    apple_pay: 'Apple Pay',
    google_pay: 'Google Pay',
    manual: 'Manual confirmation',
  }
  return known[raw] || raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}
function guestSummary(b: Row) {
  const adults = Math.max(0, Number(b.adults || 0))
  const kids = Math.max(0, Number(b.kids || 0))
  const total = Math.max(0, Number(b.guest_count || adults + kids || 0))
  const parts: string[] = []
  if (adults) parts.push(`${adults} adult${adults === 1 ? '' : 's'}`)
  if (kids) parts.push(`${kids} child${kids === 1 ? '' : 'ren'}`)
  if (parts.length) return `${parts.join(' + ')}${total ? ` (${total} total)` : ''}`
  return total ? `${total} guest${total === 1 ? '' : 's'}` : ''
}
function detailRow(label: string, value: unknown, options: { strong?: boolean, border?: boolean } = {}) {
  const shown = displayText(value)
  if (!shown) return ''
  const weight = options.strong ? '700' : '400'
  const border = options.border === false ? '' : 'border-bottom:1px solid #eee7dc;'
  return `<tr>
    <td style="padding:11px 10px;${border}color:#6d6258;font-size:13px;vertical-align:top;width:38%">${esc(label)}</td>
    <td style="padding:11px 10px;${border}color:#21160b;font-size:14px;font-weight:${weight};vertical-align:top">${esc(shown)}</td>
  </tr>`
}
function buildEmailText(eventType: EventType, b: Row, c: ReturnType<typeof copyFor>, amountPaid: number, balanceDue: number) {
  const lines = [
    c.title,
    '',
    `Hi ${text(b.customer_name) || 'there'},`,
    '',
    c.lead,
    '',
    `Booking number: ${text(b.booking_number)}`,
    `Event date: ${formatEventDate(b.event_date)}`,
    `Event time: ${text(b.event_time)}`,
  ]
  const address = text(b.address || b.event_address)
  const guests = guestSummary(b)
  const packageName = text(b.package_name || b.package)
  const proteinSummary = displayText(b.protein_summary || b.protein_selections)
  const paymentMethod = formatPaymentMethod(b.payment_preference || b.payment_method)
  if (address) lines.push(`Event address: ${address}`)
  if (guests) lines.push(`Guests: ${guests}`)
  if (packageName) lines.push(`Package: ${packageName}`)
  if (proteinSummary) lines.push(`Menu selections: ${proteinSummary}`)
  if (paymentMethod) lines.push(`Payment method: ${paymentMethod}`)
  lines.push(
    `Payment status: ${text(b.payment_status) || 'Pending'}`,
    `Amount paid: ${moneyFromDollars(amountPaid)}`,
    `Balance due: ${moneyFromDollars(balanceDue)}`,
    '',
    c.nextStep,
    '',
    `Questions or changes? Call or text ${sitePhone}, or reply to this email.`,
    websiteUrl,
  )
  return lines.join('\n')
}
function buildEmailHtml(eventType: EventType, b: Row, c: ReturnType<typeof copyFor>, amountPaid: number, balanceDue: number) {
  const customerName = text(b.customer_name) || 'there'
  const bookingNumber = text(b.booking_number)
  const formattedDate = formatEventDate(b.event_date)
  const eventTime = text(b.event_time)
  const address = text(b.address || b.event_address)
  const guests = guestSummary(b)
  const packageName = text(b.package_name || b.package)
  const proteinSummary = displayText(b.protein_summary || b.protein_selections)
  const paymentMethod = formatPaymentMethod(b.payment_preference || b.payment_method)
  const serviceNotes = text(b.service_notes || b.special_requests || b.customer_notes)
  const phoneHref = normalizePhone(sitePhone) || '+15165183325'
  const logoBlock = logoUrl
    ? `<img src="${esc(logoUrl)}" width="108" alt="Phoenix Hibachi" style="display:block;width:108px;max-width:108px;height:auto;margin:0 auto 12px;border:0;outline:none;text-decoration:none">`
    : `<div style="display:inline-block;border:1px solid #d8a541;border-radius:999px;padding:8px 14px;color:#ffd36b;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">Phoenix Hibachi</div>`

  const statusColor = eventType === 'booking_cancelled' ? '#a11b1b'
    : eventType === 'booking_request_received' ? '#8a5a12'
    : '#257044'
  const paymentStatus = text(b.payment_status) || 'Pending'
  const rows = [
    detailRow('Booking number', bookingNumber, { strong:true }),
    detailRow('Event date', formattedDate, { strong:true }),
    detailRow('Event time', eventTime, { strong:true }),
    detailRow('Event address', address),
    detailRow('Guests', guests),
    detailRow('Package', packageName),
    detailRow('Menu selections', proteinSummary),
    detailRow('Payment method', paymentMethod),
    detailRow('Special requests', serviceNotes),
  ].join('')

  const preheader = `${c.title}. Booking ${bookingNumber}.`
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;color:#21160b">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f1ec">
    <tr>
      <td align="center" style="padding:24px 12px">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e2d5c3;border-radius:18px;overflow:hidden">
          <tr>
            <td align="center" style="background:#170e05;padding:28px 24px 24px">
              ${logoBlock}
              <div style="margin-top:12px;color:#ffd36b;font-size:26px;font-weight:700;letter-spacing:.02em">Phoenix Hibachi</div>
              <div style="margin-top:6px;color:#ffffff;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Japanese Steakhouse at Your Backyard</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 10px">
              <div style="display:inline-block;background:${statusColor};color:#ffffff;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${esc(eventType.replace(/_/g, ' '))}</div>
              <h1 style="margin:18px 0 8px;color:#21160b;font-size:27px;line-height:1.25">${esc(c.title)}</h1>
              <p style="margin:0 0 18px;color:#5c5147;font-size:15px;line-height:1.65">Hi <strong>${esc(customerName)}</strong>,</p>
              <p style="margin:0;color:#3f352c;font-size:15px;line-height:1.7">${esc(c.lead)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 8px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#fffaf3;border:1px solid #eee0cc;border-radius:12px;overflow:hidden">
                ${rows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 8px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#17110c;border-radius:12px">
                <tr>
                  <td style="padding:16px 18px;color:#f6e7ca;font-size:13px">Payment status</td>
                  <td align="right" style="padding:16px 18px;color:#ffffff;font-size:14px;font-weight:700">${esc(paymentStatus)}</td>
                </tr>
                <tr>
                  <td style="padding:0 18px 16px;color:#f6e7ca;font-size:13px">Amount paid</td>
                  <td align="right" style="padding:0 18px 16px;color:#ffffff;font-size:14px;font-weight:700">${esc(moneyFromDollars(amountPaid))}</td>
                </tr>
                <tr>
                  <td style="padding:0 18px 16px;color:#ffd36b;font-size:14px;font-weight:700">Balance due</td>
                  <td align="right" style="padding:0 18px 16px;color:#ffd36b;font-size:18px;font-weight:700">${esc(moneyFromDollars(balanceDue))}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 26px">
              <div style="background:#fff4da;border-left:4px solid #d69a28;border-radius:8px;padding:15px 16px;color:#4a3b28;font-size:14px;line-height:1.65">${esc(c.nextStep)}</div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto 4px">
                <tr>
                  <td align="center" style="background:#b87912;border-radius:8px">
                    <a href="${esc(websiteUrl)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">Visit Phoenix Hibachi</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;text-align:center;color:#6d6258;font-size:13px;line-height:1.6">
                Questions or changes? Call or text
                <a href="tel:${esc(phoneHref)}" style="color:#9a5d08;font-weight:700;text-decoration:none">${esc(sitePhone)}</a>
                or reply directly to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#f2ece4;padding:18px 20px;color:#71665c;font-size:11px;line-height:1.6">
              <strong style="color:#40362d">Phoenix Hibachi</strong><br>
              <a href="mailto:${esc(companyEmail)}" style="color:#8a5a12;text-decoration:none">${esc(companyEmail)}</a>
              &nbsp;·&nbsp;
              <a href="${esc(websiteUrl)}" style="color:#8a5a12;text-decoration:none">${esc(websiteUrl.replace(/^https?:\/\//,''))}</a><br>
              This automated email was sent regarding booking ${esc(bookingNumber)}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
function notificationPayload(eventType: EventType, b: Row, extra: Record<string, any> = {}) {
  const c = copyFor(eventType, b, extra)
  const amountPaid = Number(extra.amountPaid ?? b.paid_amount ?? b.deposit_amount ?? 0)
  const balanceDue = Number(b.balance_due_cents || 0) / 100
  const emailText = buildEmailText(eventType, b, c, amountPaid, balanceDue)
  const emailHtml = buildEmailHtml(eventType, b, c, amountPaid, balanceDue)
  return {
    event_type:eventType,
    notification_type:eventType,
    booking_number:text(b.booking_number),
    customer_name:text(b.customer_name),
    customer_phone:normalizePhone(b.customer_phone),
    customer_email:lower(b.customer_email),
    event_date:text(b.event_date),
    event_time:text(b.event_time),
    event_address:text(b.address || b.event_address),
    adults:Number(b.adults || 0),
    kids:Number(b.kids || 0),
    guest_count:Number(b.guest_count || Number(b.adults || 0) + Number(b.kids || 0)),
    package_name:text(b.package_name || b.package),
    protein_summary:displayText(b.protein_summary || b.protein_selections),
    payment_method:formatPaymentMethod(b.payment_preference || b.payment_method),
    special_requests:text(b.service_notes || b.special_requests || b.customer_notes),
    payment_status:text(b.payment_status),
    deposit_status:text(b.deposit_status),
    amount_paid:Number(amountPaid.toFixed(2)),
    balance_due:Number(balanceDue.toFixed(2)),
    currency:'USD',
    sms_opt_in:isSmsOptedIn(b),
    sms_content:c.sms,
    email_subject:c.subject,
    email_html:emailHtml,
    email_text:emailText,
    source:text(extra.source || 'supabase_booking_lifecycle'),
    occurred_at:new Date().toISOString(),
  }
}
function dedupeKey(eventType: EventType, b: Row, extra: Record<string, any>) {
  let suffix = 'once'
  if (eventType === 'booking_rescheduled') suffix = `${text(b.event_date)}:${text(b.event_time)}`
  if (eventType === 'deposit_paid') suffix = `${text(extra.providerReference || '')}:${text(extra.amountCents || b.paid_amount || b.deposit_amount)}:${text(b.balance_due_cents)}`
  if (eventType === 'event_reminder_72h') suffix = text(b.event_date)
  return `${b.id}:${eventType}:make:${suffix}`
}
async function dispatchMake(b: Row, eventType: EventType, extra: Record<string, any> = {}) {
  const payload = notificationPayload(eventType, b, extra)
  const key = dedupeKey(eventType, b, extra)
  try {
    const { data: prior } = await service.from('booking_notifications').select('status,sent_at').eq('dedupe_key', key).maybeSingle()
    if (prior?.status === 'sent') return { sentAny:true, queued:true, duplicate:true, smsEligible:payload.sms_opt_in }
  } catch (error) { console.warn('Notification dedupe lookup skipped', error) }

  const baseLog = {
    booking_id:b.id, notification_type:eventType, recipient_type:'customer', recipient_email:payload.customer_email || null,
    recipient_phone:payload.customer_phone || null, channel:'make', payload, dedupe_key:key, updated_at:new Date().toISOString(),
  }
  if (!makeWebhookUrl || !makeApiKey) {
    const error = 'Make notification secrets are not configured.'
    try { await service.from('booking_notifications').upsert({ ...baseLog, status:'failed', attempts:1, last_error:error }, { onConflict:'dedupe_key' }) } catch {}
    return { sentAny:false, queued:false, error, smsEligible:payload.sms_opt_in }
  }
  try {
    await service.from('booking_notifications').upsert({ ...baseLog, status:'pending', attempts:1, last_error:null }, { onConflict:'dedupe_key' })
    const response = await fetch(makeWebhookUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-make-apikey':makeApiKey }, body:JSON.stringify(payload) })
    const raw = await response.text()
    if (!response.ok) throw new Error(`Make webhook ${response.status}: ${raw.slice(0, 500)}`)
    await service.from('booking_notifications').update({ status:'sent', sent_at:new Date().toISOString(), last_error:null, provider_message_id:raw.slice(0, 250) || null, updated_at:new Date().toISOString() }).eq('dedupe_key', key)
    return { sentAny:true, queued:true, makeStatus:response.status, smsEligible:payload.sms_opt_in }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try { await service.from('booking_notifications').update({ status:'failed', last_error:message, updated_at:new Date().toISOString() }).eq('dedupe_key', key) } catch {}
    console.error('Make notification failed', message)
    return { sentAny:false, queued:false, error:message, smsEligible:payload.sms_opt_in }
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers:cors(req) })
  if (req.method !== 'POST') return json(req, { ok:false, error:'Method not allowed' }, 405)
  try {
    const body = await req.json().catch(() => ({})); const action = lower(body.action); await expireDrafts()
    if (action === 'lookup') {
      const query = text(body.query), verify = text(body.verificationContact); if (!query) return json(req, { ok:true, orders:[] })
      let rows: Row[] = []
      if (/^PHX-/i.test(query)) {
        if (!verify) return json(req, { ok:false, error:'Phone or email verification is required for an order-number search.' }, 400)
        const b = await getActive(normalizeNumber(query))
        if (b) { const ok = verify.includes('@') ? lower(b.customer_email) === lower(verify) : digits(b.customer_phone) === digits(verify); if (ok) rows = [b] }
      } else if (query.includes('@')) {
        const { data, error } = await service.from('bookings').select('*').ilike('customer_email', lower(query)).order('event_date', { ascending:true }).limit(10)
        if (error) throw new Error(error.message); rows = (data || []) as Row[]
      } else {
        const q = digits(query), today = new Date().toISOString().slice(0, 10)
        const { data, error } = await service.from('bookings').select('*').gte('event_date', today).order('event_date', { ascending:true }).limit(200)
        if (error) throw new Error(error.message); rows = ((data || []) as Row[]).filter(b => digits(b.customer_phone) === q)
      }
      return json(req, { ok:true, orders:rows.filter(activeBooking).slice(0, 5).map(publicOrder) })
    }

    const number = normalizeNumber(body.bookingNumber)
    if (action === 'finalize' || action === 'abandon') {
      const draft = await getDraft(number)
      if (!draft) { const active = await getActive(number); if (active) return json(req, { ok:true, alreadyActive:true, booking:publicOrder(active) }); return json(req, { ok:false, error:'Provisional booking was not found.' }, 404) }
      const allowed = await validateDraft(draft, text(body.paymentAccessToken), text(body.customerEmail)); if (!allowed) return json(req, { ok:false, error:'Secure draft verification failed.' }, 403)
      if (action === 'abandon') {
        await service.from('booking_drafts').update({ draft_status:'abandoned', request_status:'abandoned', status:'Abandoned', abandoned_at:new Date().toISOString(), draft_updated_at:new Date().toISOString() }).eq('id', draft.id)
        return json(req, { ok:true })
      }
      if (draft.checkout_expires_at && new Date(draft.checkout_expires_at).getTime() < Date.now()) return json(req, { ok:false, error:'This provisional booking expired. Please start a new booking.' }, 410)
      const pref = lower(body.paymentPreference) || 'cash', manual = body.manualPaymentClaimed === true
      const active = await promoteDraft(draft, { request_status:'submitted', status:'New request', payment_preference:pref, deposit_deferred:true, payment_verification_status:manual?'pending_manual_verification':'not_verified', deposit_status:manual?'pending_manual_verification':'unpaid' })
      const notification = await dispatchMake(active, 'booking_request_received')
      return json(req, { ok:true, booking:publicOrder(active), notification })
    }

    const booking = await getActive(number); if (!booking) return json(req, { ok:false, error:'Active booking was not found.' }, 404)
    if (action === 'admin_confirm') {
      await requireAdmin(req)
      const { data, error } = await service.from('bookings').update({ request_status:'confirmed', status:'Confirmed', activated_at:booking.activated_at || new Date().toISOString() }).eq('id', booking.id).select('*').single()
      if (error) throw new Error(error.message)
      const notification = await dispatchMake(data as Row, 'booking_confirmed')
      return json(req, { ok:true, notification })
    }
    if (action === 'admin_reschedule') {
      await requireAdmin(req)
      const patch: Record<string, any> = { rescheduled_at:new Date().toISOString(), status:/confirm/i.test(text(booking.status)) ? 'Confirmed - exact time updated' : 'Time updated' }
      if (body.eventDate) patch.event_date = text(body.eventDate)
      if (body.eventTime) patch.event_time = text(body.eventTime)
      const { data, error } = await service.from('bookings').update(patch).eq('id', booking.id).select('*').single()
      if (error) throw new Error(error.message)
      const notification = await dispatchMake(data as Row, 'booking_rescheduled')
      return json(req, { ok:true, notification })
    }
    if (action === 'admin_cancel') {
      await requireAdmin(req)
      const reason = text(body.reason) || 'Cancelled by Phoenix Hibachi after manager review.'
      const { data, error } = await service.from('bookings').update({ request_status:'cancelled', status:'Cancelled', cancelled_at:new Date().toISOString(), cancellation_reason:reason }).eq('id', booking.id).select('*').single()
      if (error) throw new Error(error.message)
      const notification = await dispatchMake(data as Row, 'booking_cancelled', { reason })
      return json(req, { ok:true, notification })
    }
    if (action === 'admin_payment_update') {
      await requireAdmin(req)
      const amount = Math.max(0, Number(body.amountReceived || 0)), paidInFull = body.paidInFull === true
      const depositRequired = Math.max(0, Number(booking.deposit_required_cents || 10000)) / 100
      const depositAmount = amount > 0 ? Math.min(amount, depositRequired) : Number(booking.deposit_amount || 0)
      const orderTotal = Math.max(0, Number(booking.order_total_cents || 0)) / 100
      const remainingCents = paidInFull ? 0 : Math.max(0, Math.round((orderTotal - amount) * 100))
      const patch: any = { payment_status:text(body.paymentStatus) || booking.payment_status, payment_preference:lower(body.paymentMethod) || booking.payment_preference, paid_amount:amount, deposit_amount:depositAmount, balance_due_cents:remainingCents }
      if (amount > 0) Object.assign(patch, { deposit_status:'paid', deposit_due_cents:0, deposit_deferred:false, deposit_paid_at:booking.deposit_paid_at || new Date().toISOString(), payment_verification_status:'verified' })
      if (paidInFull) Object.assign(patch, { balance_due_cents:0, payment_status:'paid in full', payment_verification_status:'verified' })
      const { data, error } = await service.from('bookings').update(patch).eq('id', booking.id).select('*').single(); if (error) throw new Error(error.message)
      const eventType: EventType = paidInFull ? 'paid_in_full' : 'deposit_paid'
      const notification = await dispatchMake(data as Row, eventType, { amountCents:Math.round(amount * 100), amountPaid:amount, source:'admin_payment_update' })
      return json(req, { ok:true, notification })
    }
    return json(req, { ok:false, error:'Unsupported booking action.' }, 400)
  } catch (error) {
    console.error(error)
    return json(req, { ok:false, error:error instanceof Error ? error.message : String(error) }, 400)
  }
})