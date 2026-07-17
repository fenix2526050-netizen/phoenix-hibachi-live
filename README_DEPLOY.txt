Phoenix Hibachi — Current Deployment Notes
============================================

Current website baseline: V2.3.5 launch-ready
Current notification/email module: V2.3.7

GitHub upload:
1. Upload update files into the existing repository root.
2. Overwrite files with the same names.
3. Do not delete assets, CNAME, _headers, .nojekyll, or unrelated existing files.

Supabase:
- If booking-lifecycle V2.3.7 has already been deployed successfully, do not deploy it again.
- Confirm SITE_LOGO_URL exists and points to:
  https://phoenix-hibachi.com/assets/phoenix-logo-transparent.png

Make:
- Customer email Subject = email_subject
- Customer email Content = email_html
- Body type = Raw HTML
- Customer SMS Content = sms_content
- Customer SMS filter requires sms_opt_in = true

Do not run the old V163 migration based only on the old README.
Historical migration files may remain in the repository for audit/history.
