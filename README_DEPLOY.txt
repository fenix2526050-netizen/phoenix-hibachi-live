Phoenix Hibachi V2.2.8 payment layout polish

Upload the CONTENTS of this folder to the GitHub Pages repository root.
Do not upload the parent 02_SUPABASE or 03_DOCS folders to GitHub.

Important:
1. V2.2.8 adds no new database columns. If the V2.2.6 booking fix already returned 13 rows, no new SQL is required for this visual update.
2. Desktop/tablet/mobile behavior is now explicit: four payment cards on wide desktop, two on tablet, one on phone.
3. Cash and Zelle remain the preferred methods. All four cards use the same dimensions, background treatment and professional SVG icon system.
4. The credit-card preference can now be selected, but actual Stripe checkout is still OFF until secure keys, Edge Functions and the webhook are deployed and tested.
5. Never put the Stripe secret key, webhook secret, Supabase service-role key or Cloudflare API token in this public GitHub folder.
6. Upload the files at this folder's root. Do not upload this folder as an extra nested directory.

V228 changes: wide success/payment window on desktop; four equal payment cards; consistent icon sizing and colors; cash banknote icon; Zelle transfer icon; credit-card icon; Venmo transfer icon; card preference remains selectable while checkout activation is pending; clearer inactive-card messaging.
