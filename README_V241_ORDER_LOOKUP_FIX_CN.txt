Phoenix Hibachi V241 order lookup / modify-order fix

Target repository:
fenix2526050-netizen/phoenix-hibachi-live

This package is still local only. It has not been pushed to GitHub, and it has not modified the live Supabase project.

What changed in this fix:

1. Public order lookup
   - Customers can search by order number alone, for example PHX-260720-A52P.
   - The public result remains masked / customer-safe.
   - Phone or email verification is no longer required just to view the public order card.

2. Modify order button on customer lookup
   - The public lookup result card now receives a Modify order button.
   - Customers can modify the order only more than 48 hours before the event.
   - Within 48 hours, the order is locked and the customer is told to call Phoenix Hibachi.

3. Safe customer verification before editing
   - Searching by order number alone only shows the public masked order.
   - When the customer clicks Modify order, the website asks for the booking phone or email.
   - After verification, the booking-lifecycle function returns the full editable order details.
   - This prevents masked public data, such as city-only address, from overwriting the real order.

4. Admin dashboard
   - Admin / Manager / Customer Service order cards continue to get Modify order.
   - Staff can modify orders anytime.

Files that must be uploaded to GitHub:

- script.js
- src/phoenix-v2382-admin-lifecycle-bridge.js
- src/phoenix-v240-travel-fee-notifications.js
- src/phoenix-v241-order-modification.js
- supabase/functions/booking-lifecycle/index.ts
- supabase/functions/booking-created/index.ts
- supabase/functions/stripe-webhook/index.ts
- package.json
- scripts/verify-phoenix-v240.js
- scripts/verify-phoenix-v241.js

Important Supabase note:

- There is no separate "modify order" function folder.
- The modify-order actions are inside:
  supabase/functions/booking-lifecycle/index.ts
- After uploading files to GitHub, GitHub Pages updates the website code, but it does not automatically update Supabase Edge Functions unless your repo has an Edge Function deployment workflow.
- For the customer Modify order save to work on the live site, deploy the updated booking-lifecycle Edge Function to Supabase.

No new Supabase table or column is required.

Tests completed locally:

- node --check src/phoenix-v241-order-modification.js
- node --check scripts/verify-phoenix-v241.js
- node --check supabase/functions/booking-lifecycle/index.ts
- npm run test:v240: 74/74 passed
- npm run test:v241: 37/37 passed

Manual checks after upload:

1. Open the live site in an incognito/private window.
2. Search order number only, for example PHX-260720-A52P.
3. Confirm the public order card appears.
4. Confirm Modify order appears on the customer result.
5. Click Modify order.
6. Enter the phone or email used on the booking.
7. Confirm the full editable order form appears.
8. Try a test change more than 48 hours before the event.
9. Confirm Admin dashboard shows the updated order.
10. Confirm orders within 48 hours show locked / call support.
