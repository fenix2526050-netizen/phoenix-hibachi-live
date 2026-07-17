-- Phoenix Hibachi V2.3.5 — OPTIONAL TEMPLATE
-- Schedule the send-booking-reminders Edge Function hourly.
-- DO NOT run until you replace both CHANGE_ME values below.
-- The same random REMINDER_CRON_SECRET value must also be saved in
-- Supabase Dashboard → Edge Functions → Secrets.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- Replace the URL with your deployed project/function URL if the project changes.
select vault.create_secret(
  'https://kyjiwwsqeyhllmzhncap.supabase.co/functions/v1/send-booking-reminders',
  'phoenix_reminder_function_url',
  'Phoenix Hibachi 72-hour reminder function URL'
);

-- CHANGE_ME: use a new strong random value; do not use the Make API key.
select vault.create_secret(
  'CHANGE_ME_REMINDER_CRON_SECRET',
  'phoenix_reminder_cron_secret',
  'Phoenix Hibachi reminder cron authentication'
);

-- Remove an older job with the same name before recreating it.
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='phoenix-booking-reminders-hourly' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule(
  'phoenix-booking-reminders-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='phoenix_reminder_function_url' limit 1),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='phoenix_reminder_cron_secret' limit 1)
    ),
    body := '{"source":"supabase_cron"}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname='phoenix-booking-reminders-hourly';
