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
type EventType = 'booking_request_received' | 'booking_confirmed' | 'deposit_paid' | 'paid_in_full' | 'booking_rescheduled' | 'booking_cancelled' | 'booking_modified' | 'event_reminder_72h'

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
function linkHtml(label: unknown, href: string) {
  const shown = text(label)
  return shown && href ? `<a href="${esc(href)}" style="color:#0645ad;text-decoration:underline;font-weight:700">${esc(shown)}</a>` : esc(shown)
}
function mapHref(v: unknown) {
  const address = text(v)
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : ''
}
function phoneHref(v: unknown) {
  const normalized = normalizePhone(v)
  return normalized ? `tel:${normalized}` : ''
}
function mailHref(v: unknown) {
  const email = lower(v)
  return email ? `mailto:${email}` : ''
}
function linkedAddress(v: unknown) { return linkHtml(v, mapHref(v)) }
function linkedPhone(v: unknown) { return linkHtml(v, phoneHref(v)) }
function linkedEmail(v: unknown) { return linkHtml(v, mailHref(v)) }
function cents(v: unknown) { return Math.max(0, Math.round(Number(v || 0))) }
function dollars(v: unknown) { return Math.max(0, Number(v || 0)) }
function moneyFromCents(v: unknown) { return `$${(cents(v) / 100).toFixed(2)}` }
function moneyFromDollars(v: unknown) { return `$${dollars(v).toFixed(2)}` }
function isSmsOptedIn(b: Row) { return b.sms_opt_in === true || lower(b.sms_opt_in) === 'true' }
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
function balanceDueDollars(b: Row) {
  const centsBalance = centsField(b.balance_due_cents)
  if (centsBalance) return centsBalance
  return moneyField(b.balance_due, b.balanceDue)
}
function finalTotalDollars(b: Row, amountPaid = 0, balanceDue = 0) {
  const direct = moneyField(b.final_total, b.finalTotal, centsField(b.order_total_cents), b.guest_total_before_deposit)
  return direct || Math.max(0, amountPaid + balanceDue)
}
function addOnsText(b: Row) { return displayText(b.add_ons || b.addons) }
function allergiesText(b: Row) { return displayText(b.allergies || b.allergy_notes || b.allergyNotes) }
function noteSummary(b: Row) {
  return text(b.service_notes || b.customer_notes || b.special_requests || b.admin_notes).slice(0, 700)
}
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
    paidAmount: Number(b.paid_amount || b.deposit_amount || 0), paid_amount: Number(b.paid_amount || b.deposit_amount || 0),
    balanceDue: balanceDueDollars(b), balance_due: balanceDueDollars(b),
    name: b.customer_name ? `${text(b.customer_name).slice(0, 1)}***` : 'Guest', phone: b.customer_phone ? `***${digits(b.customer_phone).slice(-4)}` : '',
    email: b.customer_email ? text(b.customer_email).replace(/^(.).+(@.+)$/, '$1***$2') : '',
    address: b.address ? text(b.address).split(',').slice(-2).join(',').trim() : '', package: b.package_name || 'Classic',
    adults: Number(b.adults || 0), kids: Number(b.kids || 0), totalGuests: Number(b.guest_count || 0), travelFee: Number(b.travel_fee || 0), finalTotal: finalTotalDollars(b, Number(b.paid_amount || b.deposit_amount || 0), balanceDueDollars(b)), final_total: finalTotalDollars(b, Number(b.paid_amount || b.deposit_amount || 0), balanceDueDollars(b)), order_total_cents: Number(b.order_total_cents || 0),
  }
}
function editableCustomerOrder(b: Row) {
  return {
    ...publicOrder(b),
    name: b.customer_name || '',
    customer_name: b.customer_name || '',
    phone: b.customer_phone || '',
    customer_phone: b.customer_phone || '',
    email: b.customer_email || '',
    customer_email: b.customer_email || '',
    address: b.address || '',
    event_date: b.event_date || '',
    event_time: b.event_time || '',
    package_name: b.package_name || 'Classic',
    payment_status: b.payment_status || '',
    paid_amount: Number(b.paid_amount || b.deposit_amount || 0),
    paidAmount: Number(b.paid_amount || b.deposit_amount || 0),
    balance_due: balanceDueDollars(b),
    balanceDue: balanceDueDollars(b),
    final_total: finalTotalDollars(b, Number(b.paid_amount || b.deposit_amount || 0), balanceDueDollars(b)),
    finalTotal: finalTotalDollars(b, Number(b.paid_amount || b.deposit_amount || 0), balanceDueDollars(b)),
    add_ons: b.add_ons || b.addons || [],
    addons: b.add_ons || b.addons || [],
    addOns: b.add_ons || b.addons || [],
    addon_summary: b.addon_summary || '',
    side_orders: b.side_orders || b.sideOrders || null,
    sideOrders: b.side_orders || b.sideOrders || null,
    protein_selections: b.protein_selections || b.proteinSelections || null,
    proteinSelections: b.protein_selections || b.proteinSelections || null,
    proteins: b.protein_selections || b.proteinSelections || null,
    selected_proteins: b.selected_proteins || b.selectedProteins || null,
    selectedProteins: b.selected_proteins || b.selectedProteins || null,
    protein_summary: b.protein_summary || '',
    proteinSummary: b.protein_summary || '',
    menu_summary: b.menu_summary || '',
    menu_selections: b.menu_selections || b.menuSelections || '',
    menuSelections: b.menu_selections || b.menuSelections || '',
    admin_notes: b.admin_notes || '',
    service_notes: b.service_notes || '',
    customer_notes: b.customer_notes || '',
    special_requests: b.special_requests || '',
    special_notes: b.special_notes || '',
    specialNotes: b.special_notes || b.admin_notes || b.service_notes || b.customer_notes || b.special_requests || '',
    allergy_notes: b.allergy_notes || b.allergies || '',
    allergyNotes: b.allergy_notes || b.allergies || '',
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
function upsertNote(notes: unknown, label: string, value: unknown) {
  const cleanLabel = text(label)
  const cleanValue = text(value)
  if (!cleanLabel || !cleanValue) return text(notes)
  const base = text(notes)
  const safe = cleanLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const line = `${cleanLabel}: ${cleanValue}`
  const rx = new RegExp(`(^|\\n)${safe}:\\s*[^\\n]*`, 'i')
  return rx.test(base) ? base.replace(rx, `$1${line}`) : [base, line].filter(Boolean).join('\n')
}
function appendNote(notes: unknown, label: string, value: unknown) {
  const cleanValue = text(value)
  return cleanValue ? [text(notes), `${label}: ${cleanValue}`].filter(Boolean).join('\n') : text(notes)
}
function datePart(v: unknown) {
  const raw = text(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}
function timePart(v: unknown) {
  const raw = text(v).split(/\s*[-–]\s*/)[0].replace(/\bat\b/i, '').trim()
  if (!raw) return ''
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (!m) return raw
  let h = Number(m[1])
  const minute = m[2] || '00'
  const ap = (m[3] || '').toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${minute}:00`
}
function eventStartMs(b: Row) {
  const d = datePart(b.event_date)
  if (!d) return null
  const rawTime = text(b.event_time || '16:00:00')
  const t = timePart(rawTime) || '16:00:00'
  const parsed = new Date(`${d}T${t}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}
function customerCanModify(b: Row) {
  const start = eventStartMs(b)
  if (!start) return true
  return (start - Date.now()) > 48 * 60 * 60 * 1000
}
function verifyCustomerForModify(b: Row, body: Row) {
  const verify = text(body.verificationContact || body.customerEmail || body.email || body.customerPhone || body.phone)
  if (!verify) return false
  if (verify.includes('@')) return lower(verify) === lower(b.customer_email)
  const supplied = digits(verify)
  return supplied && supplied === digits(b.customer_phone)
}
function splitLines(v: unknown) {
  if (Array.isArray(v)) return v.map(text).filter(Boolean)
  return text(v).split(/\n+/).map(item => item.trim()).filter(Boolean)
}
function removeMissingColumn(payload: Record<string, any>, message: unknown) {
  const msg = text(message)
  const match = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column "([^"]+)" .* does not exist/i)
  const column = match?.[1]
  if (!column || !(column in payload)) return null
  const next = { ...payload }
  delete next[column]
  return next
}
async function updateBookingCompat(id: string, patch: Record<string, any>) {
  let payload = { ...patch }
  let result = await service.from('bookings').update(payload).eq('id', id).select('*').single()
  for (let attempt = 0; result.error && attempt < 20; attempt += 1) {
    const retry = removeMissingColumn(payload, result.error.message)
    if (!retry) break
    payload = retry
    result = await service.from('bookings').update(payload).eq('id', id).select('*').single()
  }
  if (result.error) throw new Error(result.error.message)
  return result.data as Row
}
function modificationPatch(body: Row, booking: Row, actor: 'customer' | 'admin') {
  const raw = (body.patch && typeof body.patch === 'object') ? body.patch : body
  const patch: Record<string, any> = {}
  const changes: string[] = []
  const setText = (column: string, value: unknown, label: string) => {
    const clean = text(value)
    if (clean) { patch[column] = clean; changes.push(label) }
  }
  const setNumber = (column: string, value: unknown, label: string) => {
    if (value === undefined || value === null || value === '') return
    const clean = Math.max(0, Number(value || 0))
    if (Number.isFinite(clean)) { patch[column] = clean; changes.push(label) }
  }
  const eventDate = datePart(raw.eventDate || raw.event_date)
  if (eventDate) { patch.event_date = eventDate; changes.push('Event date') }
  const eventTime = timePart(raw.eventTime || raw.event_time)
  if (eventTime) { patch.event_time = eventTime; changes.push('Event time') }
  setText('package_name', raw.packageName || raw.package_name || raw.package, 'Package')
  setText('address', raw.address || raw.event_address, 'Address')
  setNumber('adults', raw.adults, 'Adults')
  setNumber('kids', raw.kids, 'Children')
  const adults = patch.adults ?? Number(booking.adults || 0)
  const kids = patch.kids ?? Number(booking.kids || 0)
  if (raw.guest_count !== undefined || raw.totalGuests !== undefined || patch.adults !== undefined || patch.kids !== undefined) {
    patch.guest_count = Math.max(0, Number(raw.guest_count ?? raw.totalGuests ?? (Number(adults || 0) + Number(kids || 0))))
    changes.push('Guest count')
  }
  if (raw.addOns !== undefined || raw.addons !== undefined || raw.add_ons !== undefined) {
    patch.add_ons = splitLines(raw.addOns ?? raw.addons ?? raw.add_ons)
    changes.push('Add-ons')
  }
  if (raw.proteinSelections !== undefined || raw.protein_selections !== undefined || raw.proteins !== undefined) {
    const selections = raw.proteinSelections ?? raw.protein_selections ?? raw.proteins
    patch.protein_selections = selections && typeof selections === 'object' ? selections : null
    changes.push('Protein selections')
  }
  if (raw.allergyNotes !== undefined || raw.allergy_notes !== undefined) {
    patch.allergy_notes = text(raw.allergyNotes ?? raw.allergy_notes) || null
    changes.push('Allergies')
  }
  if (actor === 'admin') setNumber('travel_fee', raw.travelFee ?? raw.travel_fee, 'Travel Fee')
  setNumber('final_total', raw.finalTotal ?? raw.final_total, 'Final Total')
  setNumber('balance_due', raw.balanceDue ?? raw.balance_due, 'Balance Due')
  setNumber('paid_amount', raw.paidAmount ?? raw.paid_amount ?? raw.amount_paid, 'Paid amount')
  setText('payment_status', raw.paymentStatus || raw.payment_status, 'Payment status')
  if (patch.final_total !== undefined) patch.order_total_cents = Math.round(Number(patch.final_total || 0) * 100)
  if (patch.balance_due !== undefined) patch.balance_due_cents = Math.round(Number(patch.balance_due || 0) * 100)
  const source = actor === 'admin' ? 'Admin dashboard' : 'Customer portal'
  let notes = text(booking.admin_notes)
  notes = upsertNote(notes, actor === 'admin' ? 'Admin modified at' : 'Customer modified at', new Date().toISOString())
  notes = upsertNote(notes, 'Last order modification source', source)
  const proteinSummary = text(raw.proteinSummary || raw.protein_summary)
  if (proteinSummary) { patch.protein_summary = proteinSummary; notes = upsertNote(notes, 'Protein summary', proteinSummary); changes.push('Protein selections') }
  const changeNote = text(raw.changeNote || raw.modificationNote || raw.customerNote || raw.adminNote)
  if (changeNote) notes = appendNote(notes, actor === 'admin' ? 'Admin modification note' : 'Customer modification note', changeNote)
  const paymentAdjustmentNote = text(raw.paymentAdjustmentNote || raw.payment_adjustment_note || raw.noRefundNote || raw.no_refund_note)
  if (paymentAdjustmentNote) { notes = appendNote(notes, 'Payment modification rule', paymentAdjustmentNote); changes.push('Payment adjustment rule') }
  patch.admin_notes = notes
  return { patch, changes:Array.from(new Set(changes)).filter(Boolean), source }
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
    case 'booking_modified': {
      const source = text(extra.source || 'order modification')
      const changed = Array.isArray(extra.changes) && extra.changes.length ? ` Updated: ${extra.changes.join(', ')}.` : ''
      return {
        subject:`Phoenix Hibachi order updated - ${ref}`,
        title:'Your Phoenix Hibachi order was updated',
        lead:`Booking ${ref} was updated from ${source}.${changed}`,
        nextStep:'Please review the updated order details below. If anything looks incorrect, contact Phoenix Hibachi right away.',
        sms:`Phoenix Hibachi: ${ref} was updated for ${when}.${changed} Balance ${balance}. Questions? ${sitePhone}. Reply STOP to opt out.`
      }
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
function detailRow(label: string, value: unknown, options: { strong?: boolean, border?: boolean, html?: boolean } = {}) {
  const shown = options.html ? text(value) : displayText(value)
  if (!shown) return ''
  const weight = options.strong ? '700' : '400'
  const border = options.border === false ? '' : 'border-bottom:1px solid #eee7dc;'
  const valueHtml = options.html ? shown : esc(shown)
  return `<tr>
    <td style="padding:11px 10px;${border}color:#6d6258;font-size:13px;vertical-align:top;width:38%">${esc(label)}</td>
    <td style="padding:11px 10px;${border}color:#21160b;font-size:14px;font-weight:${weight};vertical-align:top">${valueHtml}</td>
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
    detailRow('Event address', linkedAddress(address), { html:true }),
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
function smsSafe(v: unknown) {
  return text(v)
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
function smsClip(v: unknown, max = 60) {
  const shown = smsSafe(v)
  if (shown.length <= max) return shown
  return `${shown.slice(0, Math.max(0, max - 3)).trimEnd()}...`
}
function smsMoney(v: unknown) {
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(dollars(v))
}
function smsPhone() {
  const d = digits(sitePhone)
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : smsSafe(sitePhone)
}
function formatSmsDate(v: unknown) {
  const raw = text(v)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return smsClip(raw, 22)
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  return new Intl.DateTimeFormat('en-US', {
    weekday:'short', year:'numeric', month:'short', day:'numeric', timeZone:'UTC'
  }).format(date)
}
function smsWhen(b: Row) {
  return smsClip([formatSmsDate(b.event_date), smsSafe(b.event_time)].filter(Boolean).join(' at '), 48)
}
function smsLocation(b: Row) {
  const address = smsSafe(b.address || b.event_address)
  if (!address) return ''
  const parts = address.split(',').map(part => part.trim()).filter(Boolean)
  const location = parts.length >= 2 ? parts.slice(-2).join(', ') : address
  return smsClip(location, 38)
}
function smsGuests(b: Row) {
  const total = Math.max(0, Number(b.guest_count || Number(b.adults || 0) + Number(b.kids || 0)))
  return total ? String(total) : smsClip(guestSummary(b), 20)
}
function fitCustomerSms(lines: string[]) {
  const footer = [`Questions: ${smsPhone()}`, 'Reply STOP to opt out.']
  let body = lines.map(smsSafe).filter(Boolean)
  const render = () => [...body, ...footer].join('\n')
  if (render().length <= 280) return render()

  for (const prefix of ['Location:', 'Guests:', 'Travel fee:', 'NJ toll:']) {
    const index = body.findIndex(line => line.startsWith(prefix))
    if (index >= 0) body.splice(index, 1)
    if (render().length <= 280) return render()
  }

  const editable = body.findIndex(line => /^(Updated|Reason|Status):/.test(line))
  if (editable >= 0) body[editable] = smsClip(body[editable], 48)
  if (render().length <= 280) return render()

  while (body.length > 4 && render().length > 280) body.splice(body.length - 1, 1)
  if (render().length <= 280) return render()

  const footerText = footer.join('\n')
  const maxBodyLength = Math.max(1, 280 - footerText.length - 1)
  const clippedBody = body.join('\n').slice(0, maxBodyLength).trimEnd()
  return `${clippedBody}\n${footerText}`
}
function detailedSms(eventType: EventType, b: Row, c: ReturnType<typeof copyFor>, amountPaid: number, balanceDue: number) {
  const ref = smsSafe(b.booking_number)
  const when = smsWhen(b)
  const location = smsLocation(b)
  const guests = smsGuests(b)
  const total = smsMoney(finalTotalDollars(b, amountPaid, balanceDue))
  const balance = smsMoney(balanceDue)
  const travel = smsMoney(travelFee(b))
  const toll = njTollFee(b)

  switch (eventType) {
    case 'booking_confirmed':
      return fitCustomerSms([
        'Phoenix Hibachi',
        'BOOKING CONFIRMED',
        `Order: ${ref}`,
        when ? `Event: ${when}` : '',
        guests ? `Guests: ${guests}` : '',
        location ? `Location: ${location}` : '',
        `Balance: ${balance}`,
        'Your date and time are reserved.',
      ])
    case 'deposit_paid':
      return fitCustomerSms([
        'Phoenix Hibachi',
        'DEPOSIT RECEIVED',
        `Order: ${ref}`,
        `Paid: ${smsMoney(amountPaid)}`,
        `Balance: ${balance}`,
        when ? `Event: ${when}` : '',
        'Your payment has been applied.',
      ])
    case 'paid_in_full':
      return fitCustomerSms([
        'Phoenix Hibachi',
        'PAID IN FULL',
        `Order: ${ref}`,
        when ? `Event: ${when}` : '',
        'Balance: $0.00',
        'Thank you. Your payment is complete.',
      ])
    case 'booking_rescheduled':
      return fitCustomerSms([
        'Phoenix Hibachi',
        'SCHEDULE UPDATED',
        `Order: ${ref}`,
        when ? `New event: ${when}` : '',
        location ? `Location: ${location}` : '',
        'Please review the updated date and time.',
      ])
    case 'booking_cancelled':
      return fitCustomerSms([
        'Phoenix Hibachi',
        'BOOKING CANCELLED',
        `Order: ${ref}`,
        `Reason: ${smsClip(c.lead.replace(`Booking ${ref} has been cancelled.`, ''), 72)}`,
        'Contact us with any questions.',
      ])
    case 'booking_modified': {
      const changed = smsClip((c.lead.match(/Updated:\s*(.+)$/)?.[1] || '').replace(/\.$/, ''), 58)
      return fitCustomerSms([
        'Phoenix Hibachi',
        'ORDER UPDATED',
        `Order: ${ref}`,
        when ? `Event: ${when}` : '',
        changed ? `Updated: ${changed}` : '',
        `Total: ${total}`,
        `Balance: ${balance}`,
        'Please review your updated email.',
      ])
    }
    case 'event_reminder_72h':
      return fitCustomerSms([
        'Phoenix Hibachi',
        '72-HOUR REMINDER',
        `Order: ${ref}`,
        when ? `Event: ${when}` : '',
        guests ? `Guests: ${guests}` : '',
        location ? `Location: ${location}` : '',
        'Please confirm access, parking, weather backup, and final guest count.',
      ])
    default:
      return fitCustomerSms([
        'Phoenix Hibachi',
        'REQUEST RECEIVED',
        `Order: ${ref}`,
        when ? `Event: ${when}` : '',
        guests ? `Guests: ${guests}` : '',
        location ? `Location: ${location}` : '',
        `Travel fee: ${travel}`,
        toll > 0 ? `NJ toll: ${smsMoney(toll)}` : '',
        `Estimated total: ${total}`,
        'Status: Pending review - not confirmed yet.',
      ])
  }
}
function detailedEmailText(eventType: EventType, b: Row, c: ReturnType<typeof copyFor>, amountPaid: number, balanceDue: number) {
  const toll = njTollFee(b)
  const rows = [
    c.title,
    '',
    `Hi ${text(b.customer_name) || 'there'},`,
    '',
    c.lead,
    '',
    `Booking number: ${text(b.booking_number)}`,
    `Customer name: ${text(b.customer_name)}`,
    `Phone: ${text(b.customer_phone)}`,
    `Email: ${text(b.customer_email)}`,
    `Event date: ${formatEventDate(b.event_date)}`,
    `Event time: ${text(b.event_time)}`,
    `Full address: ${text(b.address || b.event_address)}`,
    `Guests: ${guestSummary(b)}`,
    `Package: ${text(b.package_name || b.package)}`,
    `Add-ons: ${addOnsText(b) || '-'}`,
    `Protein selections: ${displayText(b.protein_summary || b.protein_selections) || '-'}`,
    `Allergies: ${allergiesText(b) || '-'}`,
    `Travel Fee: ${moneyFromDollars(travelFee(b))}`,
    toll > 0 ? `NJ Toll Fee: ${moneyFromDollars(toll)}` : '',
    `Sales Tax: ${moneyFromDollars(salesTax(b))}`,
    `Final Total: ${moneyFromDollars(finalTotalDollars(b, amountPaid, balanceDue))}`,
    `Paid: ${smsMoney(amountPaid)}`,
    `Balance Due: ${moneyFromDollars(balanceDue)}`,
    `Payment status: ${text(b.payment_status) || 'Pending'}`,
    `Deposit status: ${text(b.deposit_status) || '-'}`,
    `Payment method: ${formatPaymentMethod(b.payment_preference || b.payment_method) || '-'}`,
    `Notes: ${noteSummary(b) || '-'}`,
    '',
    c.nextStep,
    '',
    `Questions or changes? Call or text ${sitePhone}, or reply to this email.`,
    websiteUrl,
  ].filter(line => line !== '')
  return rows.join('\n')
}
function detailedEmailHtml(eventType: EventType, b: Row, c: ReturnType<typeof copyFor>, amountPaid: number, balanceDue: number) {
  const toll = njTollFee(b)
  const paymentStatus = text(b.payment_status) || 'Pending'
  const rows = [
    detailRow('Booking number', text(b.booking_number), { strong:true }),
    detailRow('Customer name', text(b.customer_name)),
    detailRow('Phone', linkedPhone(b.customer_phone), { html:true }),
    detailRow('Email', linkedEmail(b.customer_email), { html:true }),
    detailRow('Event date', formatEventDate(b.event_date), { strong:true }),
    detailRow('Event time', text(b.event_time), { strong:true }),
    detailRow('Full address', linkedAddress(b.address || b.event_address), { strong:true, html:true }),
    detailRow('Guests', guestSummary(b)),
    detailRow('Package', text(b.package_name || b.package)),
    detailRow('Add-ons', addOnsText(b)),
    detailRow('Protein selections', displayText(b.protein_summary || b.protein_selections)),
    detailRow('Allergies', allergiesText(b)),
    detailRow('Travel Fee', moneyFromDollars(travelFee(b))),
    toll > 0 ? detailRow('NJ Toll Fee', moneyFromDollars(toll), { strong:true }) : '',
    detailRow('Sales Tax', moneyFromDollars(salesTax(b))),
    detailRow('Final Total', moneyFromDollars(finalTotalDollars(b, amountPaid, balanceDue)), { strong:true }),
    detailRow('Paid', moneyFromDollars(amountPaid)),
    detailRow('Balance Due', moneyFromDollars(balanceDue), { strong:true }),
    detailRow('Payment status', paymentStatus),
    detailRow('Deposit status', text(b.deposit_status)),
    detailRow('Payment method', formatPaymentMethod(b.payment_preference || b.payment_method)),
    detailRow('Notes', noteSummary(b)),
  ].join('')
  const preheader = `${c.title}. Booking ${text(b.booking_number)}.`
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
        <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;background:#ffffff;border:1px solid #e2d5c3;border-radius:18px;overflow:hidden">
          <tr>
            <td align="center" style="background:#170e05;padding:28px 24px 24px">
              <div style="display:inline-block;border:1px solid #d8a541;border-radius:999px;padding:8px 14px;color:#ffd36b;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">Phoenix Hibachi</div>
              <div style="margin-top:12px;color:#ffd36b;font-size:26px;font-weight:700;letter-spacing:.02em">Phoenix Hibachi</div>
              <div style="margin-top:6px;color:#ffffff;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Japanese Steakhouse at Your Backyard</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 10px">
              <div style="display:inline-block;background:#8a5a12;color:#ffffff;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${esc(eventType.replace(/_/g, ' '))}</div>
              <h1 style="margin:18px 0 8px;color:#21160b;font-size:27px;line-height:1.25">${esc(c.title)}</h1>
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
            <td style="padding:16px 28px 26px">
              <div style="background:#fff4da;border-left:4px solid #d69a28;border-radius:8px;padding:15px 16px;color:#4a3b28;font-size:14px;line-height:1.65">${esc(c.nextStep)}</div>
              <p style="margin:20px 0 0;text-align:center;color:#6d6258;font-size:13px;line-height:1.6">Questions or changes? Call or text <a href="tel:+15165183325" style="color:#9a5d08;font-weight:700;text-decoration:none">${esc(sitePhone)}</a> or reply directly to this email.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#f2ece4;padding:18px 20px;color:#71665c;font-size:11px;line-height:1.6">
              <strong style="color:#40362d">Phoenix Hibachi</strong><br>
              <a href="mailto:${esc(companyEmail)}" style="color:#8a5a12;text-decoration:none">${esc(companyEmail)}</a>
              &nbsp;|&nbsp;
              <a href="${esc(websiteUrl)}" style="color:#8a5a12;text-decoration:none">${esc(websiteUrl.replace(/^https?:\/\//,''))}</a><br>
              This automated email was sent regarding booking ${esc(text(b.booking_number))}.
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
  const balanceDue = balanceDueDollars(b)
  const emailText = detailedEmailText(eventType, b, c, amountPaid, balanceDue)
  const emailHtml = detailedEmailHtml(eventType, b, c, amountPaid, balanceDue)
  const toll = njTollFee(b)
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
    full_address:text(b.address || b.event_address),
    map_url:mapHref(b.address || b.event_address),
    adults:Number(b.adults || 0),
    kids:Number(b.kids || 0),
    guest_count:Number(b.guest_count || Number(b.adults || 0) + Number(b.kids || 0)),
    package_name:text(b.package_name || b.package),
    add_ons:addOnsText(b),
    protein_summary:displayText(b.protein_summary || b.protein_selections),
    allergies:allergiesText(b),
    payment_method:formatPaymentMethod(b.payment_preference || b.payment_method),
    special_requests:text(b.service_notes || b.special_requests || b.customer_notes),
    notes:noteSummary(b),
    travel_fee:Number(travelFee(b).toFixed(2)),
    nj_toll_fee:Number(toll.toFixed(2)),
    sales_tax:Number(salesTax(b).toFixed(2)),
    final_total:Number(finalTotalDollars(b, amountPaid, balanceDue).toFixed(2)),
    payment_status:text(b.payment_status),
    deposit_status:text(b.deposit_status),
    amount_paid:Number(amountPaid.toFixed(2)),
    paid:Number(amountPaid.toFixed(2)),
    balance_due:Number(balanceDue.toFixed(2)),
    currency:'USD',
    sms_opt_in:isSmsOptedIn(b),
    sms_content:detailedSms(eventType, b, c, amountPaid, balanceDue),
    internal_sms_content:detailedSms(eventType, b, c, amountPaid, balanceDue),
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
  if (eventType === 'booking_modified') suffix = `${text(extra.modifiedAt || '')}:${text(extra.source || '')}:${text((extra.changes || []).join ? extra.changes.join(',') : extra.changes || '')}`
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
        const b = await getActive(normalizeNumber(query))
        if (b) {
          const ok = !verify || (verify.includes('@') ? lower(b.customer_email) === lower(verify) : digits(b.customer_phone) === digits(verify))
          if (ok) rows = [b]
        }
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
    if (action === 'customer_edit_order') {
      if (!verifyCustomerForModify(booking, body)) return json(req, { ok:false, error:'Phone or email verification is required to modify this order.' }, 403)
      return json(req, { ok:true, locked:!customerCanModify(booking), booking:editableCustomerOrder(booking) })
    }
    if (action === 'customer_modify_order') {
      if (!verifyCustomerForModify(booking, body)) return json(req, { ok:false, error:'Phone or email verification is required to modify this order.' }, 403)
      if (!customerCanModify(booking)) return json(req, { ok:false, locked:true, error:'This order is within 48 hours of the event and is locked. Please call Phoenix Hibachi support to ask whether a change is still possible.' }, 423)
      const built = modificationPatch(body, booking, 'customer')
      const patch = { ...built.patch, request_status:'modified', status:/cancel|complete/i.test(text(booking.status)) ? booking.status : 'Customer updated - manager review' }
      const data = await updateBookingCompat(booking.id, patch)
      const notification = await dispatchMake(data as Row, 'booking_modified', { source:'Customer portal', changes:built.changes, modifiedAt:new Date().toISOString() })
      return json(req, { ok:true, booking:publicOrder(data as Row), notification })
    }
    if (action === 'admin_modify_order') {
      await requireAdmin(req)
      const built = modificationPatch(body, booking, 'admin')
      const data = await updateBookingCompat(booking.id, built.patch)
      const notification = await dispatchMake(data as Row, 'booking_modified', { source:'Admin dashboard', changes:built.changes, modifiedAt:new Date().toISOString() })
      return json(req, { ok:true, booking:publicOrder(data as Row), notification })
    }
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
