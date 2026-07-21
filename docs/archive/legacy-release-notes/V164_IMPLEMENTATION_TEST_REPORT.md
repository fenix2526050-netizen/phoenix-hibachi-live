# V164 Implementation Test Report

## Automated checks completed in container
- `node --check script.js` passed.
- `node --check src/orders-dispatch-v120.js` passed.
- `node --check src/phoenix-v140-admin-content.js` passed.
- `node --check src/phoenix-os-master-v164.js` passed.
- `index.html` parsed through Python `HTMLParser` without parser failure.
- Confirmed new V164 CSS and JS files are present and referenced by `index.html`.
- Confirmed logo asset `assets/phoenix-logo-transparent.png` exists for invoice branding.
- Confirmed CNAME remains `phoenix-hibachi.com`.

## Search checks completed
- Main customer-facing static HTML now uses `(516) 518-3325` and `booking@phoenix-hibachi.com`.
- V164 final layer rewrites older generated links/text that still contain legacy phone/email/domain values.
- Edge Function defaults now use `orders@phoenix-hibachi.com`, `(516) 518-3325`, `https://phoenix-hibachi.com`, and `booking@phoenix-hibachi.com`.

## Not tested in live environment
- Real Supabase insert/update, because this container is not connected to your Supabase project.
- Real Supabase Edge Function deploy/execution.
- Real Make webhook and Gmail delivery.
- Real Quo call/SMS forwarding.
- Real Google Business Profile display.

## Required live smoke tests after upload
1. Submit a test booking from the live domain.
2. Confirm the booking row appears in Supabase.
3. Confirm `orders@phoenix-hibachi.com` receives the internal notification after Make is updated.
4. Print customer invoice and confirm logo/watermark/contact details appear.
5. Log in as admin and verify Admin Dashboard.
6. Log in with a customer service temporary account and verify Customer Service Dashboard.
7. Test Contact Settings save while logged in as Admin.
8. Test mobile modal scrolling and close icon.
