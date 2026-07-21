# Phoenix Hibachi V2.3.8 — Payment and booking repair

This patch contains 10 files, below GitHub's 100-file upload limit.

## Fixes

1. Repairs the cash/Zelle/Venmo booking failure caused by missing `bookings.abandoned_at`
   and related lifecycle/payment columns.
2. Changes the required deposit rule:
   - Up to 20 guests: $100
   - 21–30 guests: $200
   - 31+ guests: $300
3. Replaces the small radio dots with three card-style choices:
   - Required deposit
   - Full remaining balance
   - Custom card payment
4. Custom card payment is validated on the server:
   - Minimum $100
   - Cannot exceed the remaining balance
5. Stripe webhook correctly records partial/custom payments.

## Required installation order

### A. Supabase SQL
Run `supabase/migrations/06_V238_SCHEMA_PAYMENT_REPAIR.sql` first.

### B. Supabase Edge Functions
Deploy these four function files:
- create-stripe-checkout-session
- stripe-webhook
- stripe-session-status
- booking-lifecycle

### C. GitHub
Upload the root files and `src` files into the existing repository and overwrite same-name files.

## Important: live Stripe is still disabled until the public live key is added

Open `src/phoenix-payment-config.js` and place the Stripe public live key in:

`const liveStripePublishableKey = 'pk_live_...';`

This is a public browser key, not the Stripe secret key.

The Supabase `STRIPE_SECRET_KEY` and Stripe webhook must also use LIVE mode when the
website uses a `pk_live_...` key. Test mode and live mode keys cannot be mixed.

For sandbox testing, open:
`https://phoenix-hibachi.com/?stripe_test=1`

## Deposit rule interpretation

The requested rule is implemented as:
- 10–20 guests = $100
- 21–30 guests = $200
- 31 or more guests = $300
