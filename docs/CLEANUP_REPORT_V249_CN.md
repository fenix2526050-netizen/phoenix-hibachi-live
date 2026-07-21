# Phoenix Hibachi V249 Safe Cleanup Report

Date: 2026-07-21

## Goal

Keep the current working Phoenix Hibachi website behavior unchanged while reducing root/src clutter before GitHub upload.

## Baseline Passed Before Cleanup

- V240 travel fee / notification checks: 74/74 passed.
- V241 order modification checks: 77/77 passed.
- V243 SMS checks: passed.
- Active JavaScript syntax checks: passed.
- `index.html` duplicate ID check: passed.
- `index.html` local resource check: passed.

`npm run build` could not be confirmed because local Vite is not installed in `node_modules`; this is a dependency installation issue, not a source-code test failure.

## What Was Archived

Unloaded legacy source files were moved out of the active `src/` folder:

- `src/phoenix-os-master-v164.*`
- `src/phoenix-os-v1641-ui-finish.*`
- `src/phoenix-os-v1642-auth-profile-finish.*`
- `src/phoenix-os-v1643-order-print-polish.*`
- `src/phoenix-os-v1644-mobile-auth-confirm-fix.*`
- `src/phoenix-os-v1645-print-contact-confirm-polish.*`
- `src/phoenix-os-v1646-login-assistant-finalize.*`
- `src/phoenix-v140-admin-content.js`

They are now under:

- `archive/legacy-src-v164/`

Old release-note files were moved out of the root/docs active view and archived under:

- `docs/archive/legacy-release-notes/`

An unused root-level duplicate Stripe helper was also archived:

- `phoenix-v224-stripe.js`

The active runtime Stripe helper remains unchanged at:

- `src/phoenix-v224-stripe.js`

## What Was Not Changed

- No Supabase schema files were deleted.
- No Edge Functions were removed.
- No current runtime files loaded by `index.html` were removed.
- No Booking, Admin, Stripe, notification, invoice, or pricing behavior was intentionally changed.
- No Git commit, push, deploy, or Supabase write was performed.

## Active Runtime Files Kept

All files currently loaded by `index.html` remain in place, including:

- `script.js`
- `style.css`
- `src/orders-dispatch-v120.js`
- `src/admin-content.js`
- `src/phoenix-clean-v1652.*`
- `src/phoenix-v166-targeted-fixes.*`
- `src/phoenix-v167-commercial-details.*`
- `src/phoenix-v168-quote-navigation-polish.*`
- `src/phoenix-v22-launch.*`
- `src/phoenix-v222-social-payment.css`
- `src/phoenix-v223-preconfirm-payment.css`
- `src/phoenix-v224-stripe.*`
- `src/phoenix-v225-cash-benefits.*`
- `src/phoenix-v226-video-media.*`
- `src/phoenix-stability-v239.*`
- `src/phoenix-v2382-admin-lifecycle-bridge.js`
- `src/phoenix-v240-travel-fee-notifications.js`
- `src/phoenix-v241-order-modification.js`

## Notes

`src/phoenix-v2382-admin-lifecycle-bridge.js` contains fallback loaders for V240/V241. Those are guarded and do not create duplicate execution when `index.html` already loads the scripts. They were kept because they protect against cache/loading issues.
