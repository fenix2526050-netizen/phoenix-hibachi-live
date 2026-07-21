Phoenix Hibachi V241 order lookup / modify-order fix

Target repository:
fenix2526050-netizen/phoenix-hibachi-live

This package is still local only. It has not been pushed to GitHub, and it has not modified the live Supabase project.

What changed in this fix:

0. V241 loading
   - index.html now directly loads src/phoenix-v241-order-modification.js.
   - The older bridge loader remains as backup.
   - This fixes cases where Travel Fee V240 loaded but the Modify order button did not appear.

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

3.1 Clear fallback when Supabase is still old
   - If the live Supabase Edge Function has not been deployed yet, the website no longer shows the confusing "Edge Function returned a non-2xx status code" message.
   - It now explains that the latest booking-lifecycle Edge Function must be deployed.
   - Order-number-only search also has a read-only fallback attempt, but this can work only if the live Supabase RLS allows public read by booking number.
   - The permanent fix is still to deploy supabase/functions/booking-lifecycle/index.ts.

4. Admin dashboard
   - Admin / Manager / Customer Service order cards continue to get Modify order.
   - Staff can modify orders anytime.
   - If the order card is rendered by the V120 calendar/dispatch view and the order object is not available in the global cache, the button still appears.
   - When staff clicks Modify order, the site fetches the full order from Supabase by booking number before opening the edit form.

5. Modal / mobile usability
   - Modify order modal now stays inside the browser viewport.
   - The form body scrolls, while Cancel / Save changes stay visible at the bottom.
   - Public order lookup results now scroll inside the lookup dialog, so customers do not need to zoom out to reach the bottom buttons.

6. Customer payment entry
   - Public/customer order cards now show Pay deposit / balance.
   - The payment dialog now presents four payment choices:
     - Zelle
     - Venmo
     - Secure card payment, when enabled
     - Cash at event
   - The payment button passes the booking number into the existing payment modal.

7. 48-hour lock display
   - More than 48 hours before event: customer sees Modify order.
   - Within 48 hours: the button becomes a disabled gray Modify locked button, with a locked notice telling the customer to call Phoenix.
   - Customer changes still save through booking-lifecycle and trigger booking_modified notification delivery through Make/SMS when configured.

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
- If customers can search by phone/email but not by order number, the live website is probably using the old booking-lifecycle function.
- If Modify order opens a system notice about the online service not being updated, deploy booking-lifecycle.

No new Supabase table or column is required.

Tests completed locally:

- node --check src/phoenix-v241-order-modification.js
- node --check scripts/verify-phoenix-v241.js
- node --check supabase/functions/booking-lifecycle/index.ts
- npm run test:v240: 74/74 passed
- npm run test:v241: 50/50 passed

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
