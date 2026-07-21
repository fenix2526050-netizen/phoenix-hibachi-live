# Phoenix Hibachi V164.4 — Mobile/Auth Confirmation Fix

No SQL is required for the website UI changes. Use the companion V164.4 SQL only if a confirmed customer still cannot log in because a `profiles` row is missing or blocked.

## Fixes
- Mobile menu is raised above floating Light / Assistant / Contact buttons.
- The confusing mixed Chinese/English login explainer box is hidden.
- The always-visible resend confirmation block is removed from the login entrance.
- Signup / unconfirmed-login now opens a centered confirmation dialog with email input and resend countdown.
- Login submit is intercepted before older handlers so customers see the exact Auth error instead of the vague local-staff fallback message.
- If login succeeds but the profile row is missing, the browser attempts to create the customer profile row using the authenticated user session.

## Test
1. Open mobile menu and verify floating buttons do not cover options.
2. Register a new member account and verify confirmation dialog appears.
3. Confirm email, then login with the same password.
4. If login says profile missing, run the V164.4 repair SQL and retry.
