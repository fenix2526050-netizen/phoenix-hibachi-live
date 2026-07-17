# Phoenix Hibachi — Current Deployment Status

## Current baseline

- Website baseline: **V2.3.5 launch-ready**
- Notification and branded email update: **V2.3.7**
- Live stack: GitHub Pages + Supabase + Make + Gmail + Quo + Stripe

This repository is the current Phoenix Hibachi website. Older version numbers that appear inside
historical migration files or archived notes are retained only as implementation history and are
not instructions to downgrade the live site.

## V2.3.7 notification update

The current customer notification flow supports:

- Booking request received
- Manager confirmation
- Deposit received
- Paid in full
- Rescheduled booking
- Cancelled booking
- 72-hour event reminder
- Customer email through Gmail
- Transactional SMS through Quo when the customer opted in
- Internal owner SMS alerts
- Internal company email alerts

The branded customer email can display:

- Phoenix Hibachi logo
- Customer name
- Booking number
- Event date and time
- Event address
- Adult, child, and total guest counts
- Package name
- Protein/menu selections
- Payment method and payment status
- Amount paid and balance due
- Special requests

## Active Make mapping

Customer Gmail route:

- To: `customer_email`
- Subject: `email_subject`
- Body type: `Raw HTML`
- Content: `email_html`
- Reply-To: `booking@phoenix-hibachi.com`

Customer Quo route:

- Content: `sms_content`
- To: `customer_phone`
- Filter: `sms_opt_in = true` and phone is not empty

## Supabase deployment

The active Edge Function is:

`supabase/functions/booking-lifecycle/index.ts`

The deployed Supabase function must match the current V2.3.7 version in this repository.

Required custom secrets include:

- `MAKE_CUSTOMER_NOTIFICATIONS_WEBHOOK_URL`
- `MAKE_CUSTOMER_NOTIFICATIONS_API_KEY`
- `BOOKING_COMPANY_EMAIL`
- `SITE_PHONE`
- `PUBLIC_SITE_ORIGIN`
- `SITE_LOGO_URL`

Current logo URL:

`https://phoenix-hibachi.com/assets/phoenix-logo-transparent.png`

## Important note about older files

Do **not** run an old migration merely because its filename contains V163, V164, or another older
version number. Migration files are retained as database history. Only run a migration when the
current deployment instructions explicitly require it.

The old “V163 — Make Email Field Cleanup” README has been replaced by this current status file.
