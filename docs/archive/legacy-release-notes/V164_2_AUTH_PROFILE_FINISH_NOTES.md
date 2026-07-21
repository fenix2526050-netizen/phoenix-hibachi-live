# Phoenix Hibachi V164.2 Auth/Profile Finish

This is a safe front-end polish patch on top of V164.1.

## Fixed
- Logout now clears Supabase auth session, Phoenix portal session metadata, stale account UI, dashboard modals, and returns the site to a logged-out homepage state.
- Login/email-confirmation errors now show a centered Phoenix system notice instead of unclear browser-style alerts.
- Login modal now includes a Resend confirmation email helper.
- All alert() messages are routed into one centered Phoenix-style top-layer system notice.
- Member profile avatar now uploads to Supabase Storage bucket `profile-avatars` and saves URL to `profiles.avatar_url` when the companion SQL is installed.
- Existing local avatar preview remains as a fallback, but persistent storage is now the preferred path.

## Requires SQL
Run `phoenix_hibachi_v1642_auth_profile_finish.sql` before uploading this package if you want persistent avatars.

## Does not include
- Website AI assistant
- AI knowledge base
- Quo/Twilio/OpenAI API integration
