import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@2'

const secretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const stripe = new Stripe(secretKey)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const service = createClient(supabaseUrl, serviceRoleKey)
const configuredOrigin = (Deno.env.get('PUBLIC_SITE_ORIGIN') || 'https://phoenix-hibachi.com').replace(/\/$/, '')
const companyEmail = String(Deno.env.get('BOOKING_COMPANY_EMAIL') || '').trim().toLowerCase()
const allowedOrigins = new Set([configuredOrigin, 'https://www.phoenix-hibachi.com'])
const bookingSelect = 'id,booking_number,customer_email,request_status,deposit_status,deposit_due_cents,stripe_checkout_session_id,created_at'

type BookingRow = {
  id: string
  booking_number: string
  customer_email: string | null
  request_status: string | null
  deposit_status: string | null
  deposit_due_cents: number | null
  stripe_checkout_session_id: string | null
  created_at: string
}

function corsHeaders(req: Request) {
  const requestOrigin = req.headers.get('origin') || configuredOrigin
  const origin = allowedOrigins.has(requestOrigin) ? requestOrigin : configuredOrigin
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

async function sha256(raw: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function authenticatedEmail(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!auth || !anonKey) return ''
  const scoped = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  })
  const { data } = await scoped.auth.getUser()
  return String(data.user?.email || '').trim().toLowerCase()
}

function normalizeBookingNumber(value: unknown) {
  const raw = String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
  const match = raw.toUpperCase().match(/PHX-\d{6}-[A-Z0-9]{4,12}/)
  return match?.[0] || raw
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function bookingById(id: string): Promise<BookingRow | null> {
  const { data, error } = await service.from('bookings').select(bookingSelect).eq('id', id).limit(1)
  if (error) throw new Error(`Booking database lookup failed: ${error.message}`)
  return (data?.[0] as BookingRow | undefined) || null
}

async function bookingByNumber(bookingNumber: string): Promise<BookingRow | null> {
  if (!bookingNumber) return null
  const { data, error } = await service.from('bookings').select(bookingSelect).eq('booking_number', bookingNumber).order('created_at', { ascending: false }).limit(1)
  if (error) throw new Error(`Booking database lookup failed: ${error.message}`)
  if (data?.[0]) return data[0] as BookingRow

  // Handles accidental case or invisible-character differences without widening access.
  const { data: fuzzy, error: fuzzyError } = await service.from('bookings').select(bookingSelect).ilike('booking_number', bookingNumber).order('created_at', { ascending: false }).limit(1)
  if (fuzzyError) throw new Error(`Booking database lookup failed: ${fuzzyError.message}`)
  return (fuzzy?.[0] as BookingRow | undefined) || null
}

async function bookingByPaymentToken(paymentAccessToken: string) {
  if (!paymentAccessToken) return { booking: null as BookingRow | null, access: null as { token_hash: string; revoked_at: string | null } | null }
  const tokenHash = await sha256(paymentAccessToken)
  const { data: access, error } = await service
    .from('booking_payment_access')
    .select('booking_id,token_hash,revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .limit(1)
  if (error) throw new Error(`Secure booking token lookup failed: ${error.message}`)
  const row = access?.[0]
  if (!row?.booking_id) return { booking: null, access: null }
  return {
    booking: await bookingById(String(row.booking_id)),
    access: { token_hash: String(row.token_hash), revoked_at: row.revoked_at ? String(row.revoked_at) : null },
  }
}

async function recentSandboxBookingByEmail(email: string): Promise<BookingRow | null> {
  if (!secretKey.startsWith('sk_test_') || !companyEmail || email !== companyEmail) return null
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const { data, error } = await service
    .from('bookings')
    .select(bookingSelect)
    .eq('customer_email', email)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`Sandbox booking lookup failed: ${error.message}`)
  return (data?.[0] as BookingRow | undefined) || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    if (!secretKey || !supabaseUrl || !serviceRoleKey) {
      throw new Error('Secure payment server is not fully configured')
    }

    const { bookingNumber, customerEmail, paymentAccessToken, paymentType = 'deposit' } = await req.json()
    const normalizedBookingNumber = normalizeBookingNumber(bookingNumber)
    const suppliedEmail = String(customerEmail || '').trim().toLowerCase()
    if (!normalizedBookingNumber || !suppliedEmail) throw new Error('Booking number and customer email are required')
    if (paymentType !== 'deposit') throw new Error('Only the booking deposit is enabled in Phase 1')

    // The private one-time token is the most reliable identifier. It also prevents a
    // stale browser reference from opening another customer's booking.
    const tokenLookup = await bookingByPaymentToken(String(paymentAccessToken || ''))
    let booking = tokenLookup.booking
    let resolvedBy = booking ? 'payment_token' : ''

    if (!booking) {
      booking = isUuid(normalizedBookingNumber)
        ? await bookingById(normalizedBookingNumber)
        : await bookingByNumber(normalizedBookingNumber)
      if (booking) resolvedBy = isUuid(normalizedBookingNumber) ? 'database_id' : 'booking_number'
    }

    // Test-only recovery for a fresh company test booking when an older front-end
    // passed a stale reference. This path can never run with a live Stripe key.
    if (!booking) {
      booking = await recentSandboxBookingByEmail(suppliedEmail)
      if (booking) resolvedBy = 'sandbox_company_email'
    }

    if (!booking) {
      console.error('Booking lookup returned no row', { normalizedBookingNumber, suppliedEmail, hasPaymentAccessToken: Boolean(paymentAccessToken) })
      throw new Error(`Booking request ${normalizedBookingNumber} was not found in Supabase. Submit a new test booking and open card payment from its confirmation window.`)
    }

    const { data: accessRows, error: accessError } = await service
      .from('booking_payment_access')
      .select('token_hash,revoked_at')
      .eq('booking_id', booking.id)
      .limit(1)
    if (accessError) throw new Error(`Secure booking access lookup failed: ${accessError.message}`)
    const access = accessRows?.[0] || tokenLookup.access

    const bookingEmail = String(booking.customer_email || '').trim().toLowerCase()
    if (!bookingEmail || suppliedEmail !== bookingEmail) throw new Error('Booking access could not be verified')

    // Sandbox keys must never mark a real customer's production booking as paid.
    if (secretKey.startsWith('sk_test_') && (!companyEmail || bookingEmail !== companyEmail)) {
      throw new Error('Stripe Sandbox is restricted to the Phoenix Hibachi company test email')
    }

    const userEmail = await authenticatedEmail(req)
    const tokenOkay = Boolean(
      paymentAccessToken &&
      access?.token_hash &&
      !access.revoked_at &&
      await sha256(String(paymentAccessToken)) === access.token_hash
    )

    if (!tokenOkay && userEmail !== bookingEmail) {
      throw new Error('Secure booking access token is missing or expired. Submit a new booking request, then pay from that same confirmation window.')
    }

    if (['cancelled', 'declined', 'expired'].includes(String(booking.request_status || '').toLowerCase())) {
      throw new Error('This booking request is no longer eligible for payment')
    }

    if (['paid', 'paid_by_benefits'].includes(String(booking.deposit_status || '').toLowerCase())) {
      return json(req, { alreadyPaid: true, amountDue: 0, resolvedBookingNumber: booking.booking_number, resolvedBy })
    }

    const amountDue = Number(booking.deposit_due_cents ?? 20000)
    if (!Number.isInteger(amountDue) || amountDue <= 0 || amountDue > 20000) {
      throw new Error('The deposit amount needs staff review before card payment')
    }

    let prior: Stripe.Checkout.Session | null = null
    if (booking.stripe_checkout_session_id) {
      try {
        prior = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_session_id)
      } catch {
        prior = null
      }
      if (prior?.payment_status === 'paid') return json(req, { alreadyPaid: true, amountDue: 0, resolvedBookingNumber: booking.booking_number, resolvedBy })
      if (prior?.status === 'open' && prior.client_secret) {
        return json(req, { clientSecret: prior.client_secret, amountDue, reused: true, resolvedBookingNumber: booking.booking_number, resolvedBy })
      }
    }

    const retryMarker = prior?.id || 'initial'
    const idempotencyKey = `phoenix:${booking.id}:deposit:${amountDue}:${retryMarker}`

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      mode: 'payment',
      customer_email: booking.customer_email || undefined,
      client_reference_id: booking.booking_number,
      metadata: {
        booking_id: booking.id,
        booking_number: booking.booking_number,
        payment_type: 'deposit',
        expected_amount_cents: String(amountDue),
      },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Phoenix Hibachi Booking Deposit',
            description: `Booking ${booking.booking_number}`,
          },
          unit_amount: amountDue,
        },
        quantity: 1,
      }],
      return_url: `${configuredOrigin}/?stripe_return={CHECKOUT_SESSION_ID}`,
    }, { idempotencyKey })

    const { error: updateError } = await service.from('bookings').update({
      stripe_checkout_session_id: session.id,
      payment_preference: 'stripe',
      deposit_status: 'pending',
      deposit_deferred: true,
      payment_verification_status: 'awaiting_webhook',
    }).eq('id', booking.id)

    if (updateError) throw updateError
    return json(req, { clientSecret: session.client_secret, amountDue, resolvedBookingNumber: booking.booking_number, resolvedBy })
  } catch (error) {
    console.error(error)
    return json(req, { error: error instanceof Error ? error.message : 'Unable to create payment session' }, 400)
  }
})
