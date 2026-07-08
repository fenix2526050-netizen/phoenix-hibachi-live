# Phoenix Hibachi V163 — Make Email Field Cleanup

This version keeps the V162 stable live baseline and improves the booking data sent to Supabase / Make / Gmail.

## What changed

- Adds dedicated booking fields for cleaner Make email notifications:
  - `protein_summary`
  - `protein_selections`
  - `protein_upcharge`
  - `food_subtotal`
  - `sales_tax`
  - `service_notes`
  - `preferred_arrival_window`
- Saves `final_total`, `balance_due`, `travel_fee`, and `paid_amount` into the booking row.
- Stops mixing protein selections into `admin_notes` for new public bookings.
- Updates invoice coupon language where older cache text may still appear.

## Run first in Supabase

Open and run:

`supabase/migrations/phoenix_hibachi_live_v163_booking_email_fields.sql`

Then upload the extracted files to GitHub Pages.

## Make email fields to use

Use the new fields in the Gmail module:

- Total: `record → final_total`
- Balance due: `record → balance_due`
- Travel fee: `record → travel_fee`
- Food subtotal: `record → food_subtotal`
- Sales tax: `record → sales_tax`
- Protein selections: `record → protein_summary`
- Notes: `record → service_notes`
