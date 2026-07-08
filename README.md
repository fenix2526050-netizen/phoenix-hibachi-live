# Phoenix Hibachi V156B — Live Clean Supabase URL Corrected

This package is prepared for the new clean Supabase project:

`https://kyjiwwsqeyhllmzhncap.supabase.co`

## What changed

- Connected the frontend to the new `phoenix-hibachi-live` Supabase project.
- Uses only the browser-safe publishable key in `script.js`.
- Keeps the direct REST fallback from the previous repair version, so booking and admin calls can still work if the Supabase JS client has trouble loading.
- Includes the clean install SQL used for the new database in `supabase/migrations/phoenix_hibachi_live_clean_install_v155.sql`.

## Upload rule

Upload the extracted files and folders directly to the GitHub repository root. Do **not** upload this ZIP file itself.

## After upload

1. Wait for GitHub Pages deployment to turn green.
2. Open the new GitHub Pages URL in Chrome incognito.
3. Test Admin login with the newly created confirmed Supabase Auth user.
4. Submit one test booking and confirm it appears in Supabase `bookings`.
5. Change one small admin setting and confirm it syncs on the public site.

## Security

Do not put any `secret`, `service_role`, database password, or JWT secret into frontend files.
