# Phoenix OS Master Build V164

## What this release is
This is a foundation/stability build for Phoenix Hibachi. It is not a random patch stack. It adds a single final override layer for current public-facing issues while preserving existing booking, admin, Supabase, and dashboard behavior.

## Core fixes included

### Public contact / privacy
- Public phone updated to Quo business number: **(516) 518-3325**.
- Public website updated to **https://phoenix-hibachi.com**.
- Public booking email: **booking@phoenix-hibachi.com**.
- Public support email: **support@phoenix-hibachi.com**.
- Internal Gmail stays separate: **phoenixhibachi.team@gmail.com**.
- Private owner number should remain internal only.

### Invoice branding
- Restores Phoenix logo on customer invoice.
- Restores invoice watermark.
- Updates invoice phone/domain/email to official Phoenix Hibachi values.
- Adds settlement-ready invoice sections for coupon, manager discount, points, gift card, wallet/party credit, deposits, confirmed payments, and balance due.
- Adds clear rule copy: coupons cannot stack; Zelle requires manual confirmation; gift card/wallet are payment methods.

### Login / dashboard routing
- Public UI shows one neutral login入口.
- Role routing after login:
  - `customer/member` → Member Dashboard
  - `chef` → Chef Dashboard
  - `customer_service/staff` → Customer Service Dashboard
  - `manager` → Manager Dashboard
  - `admin/owner` → Admin Dashboard
- Customer-facing UI no longer needs visible Admin/Staff login choices.
- Local temporary staff login fallback now resolves by account role rather than selected tab.

### Admin Contact Settings
- Save Contact Settings button now has a final delegated handler.
- Saves locally first and attempts Supabase `app_settings` upsert when logged in.
- Shows success/failure feedback.
- Uses official contact settings as the source of truth.

### Mobile UI
- Fixes modal/dropdown scrolling by restoring `overflow-y: auto` to modal cards.
- Mobile nav can scroll on small screens.
- Replaces text `×` close buttons with clean SVG close icon.
- Removes ugly mobile blue focus ring while preserving accessible `focus-visible`.

## Database foundation added
Run `supabase/migrations/phoenix_hibachi_master_build_v164.sql` after backing up Supabase data.

It is additive only. It creates/prepares:
- customers
- customer_contacts
- marketing_consents
- leads
- message_logs
- follow_up_tasks
- payments
- payment_methods_settings
- coupons
- coupon_redemptions
- gift_cards
- gift_card_transactions
- customer_wallets
- wallet_transactions
- loyalty_points_ledger
- campaigns
- campaign_recipients
- audit_logs

It also adds booking fields for:
- customer_id
- protein_selections / protein_summary / protein_upcharge
- food_subtotal / sales_tax
- applied coupon fields
- coupon/manager/points/gift card/wallet amounts
- zelle/stripe placeholders
- UTM/ad source fields

## Modules intentionally not publicly opened yet
These are prepared but should not be made customer-live until tested:
- Customer coupon redemption
- Gift card/PIN redemption
- Wallet/party credit checkout
- Stripe checkout
- Zelle QR confirmation workflow
- SMS marketing
- Birthday campaign automation
- Ads tracking conversion automation

## Required post-upload steps
1. Upload this full package to GitHub.
2. Confirm GitHub Pages still has custom domain `phoenix-hibachi.com` and Enforce HTTPS enabled.
3. Run the V164 SQL patch in Supabase SQL Editor.
4. In Make, change internal order alert recipient to `orders@phoenix-hibachi.com` if not already done.
5. Do not change Google Business phone until Google verification is stable; once stable, switch to Quo number `(516) 518-3325`.

## Smoke test checklist
- Home page loads on `https://phoenix-hibachi.com`.
- Contact card shows `(516) 518-3325` and `booking@phoenix-hibachi.com`.
- Booking form submits successfully to Supabase.
- Supabase booking row contains protein fields, food subtotal, sales tax, final total, balance due, service notes.
- Customer invoice shows logo and watermark.
- Customer invoice shows official domain/email/phone.
- Login modal shows one neutral login入口.
- Admin account opens Admin Dashboard.
- Customer Service temporary/local account opens Customer Service Dashboard.
- Chef pending account shows pending approval or does not enter dispatch.
- Contact Settings save button gives visible feedback.
- Mobile chef application/modal can scroll to bottom.
- Modal close button has clean SVG icon and no ugly blue ring.
