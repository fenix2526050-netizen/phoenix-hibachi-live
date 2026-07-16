Phoenix Hibachi V2.2.7 UX polish

Upload the CONTENTS of this folder to the GitHub Pages repository root.
Do not upload the parent 02_SUPABASE or 03_DOCS folders to GitHub.

Important:
1. V2.2.7 adds no new database columns. If the V2.2.6 booking fix already returned 13 rows, no new SQL is required for this update.
2. Stripe, Gift Card, Phoenix Credit and points remain disabled until secure Edge Functions, keys and webhooks are deployed and tested.
3. Cloudflare R2 remains the preferred hero-video source. A 9-second, approximately 2.7MB local MP4 is included as an immediate fallback so the hero still moves before the R2 URL is configured.
4. Never put service-role, Stripe secret, webhook secret or Cloudflare API tokens in this folder.
5. Upload the files at this folder's root. Do not upload this folder as an extra nested directory.

V227 changes: readable two-column payment choices; cash/Zelle priority; disclosed eligible credit-card fee wording; restored autoplay video fallback; aligned social QR cards; centered confirmed-payment modal; branded Zelle page; red invoice add-on alert; one preferred-time selector; one-pass terms review.
