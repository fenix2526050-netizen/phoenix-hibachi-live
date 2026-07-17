-- Phoenix Hibachi V2.3.5
-- Make.com customer notifications, optional transactional SMS consent,
-- reschedule/cancellation tracking, and 72-hour reminder state.
-- Idempotent: safe to run more than once after V2.3.4.

begin;

create extension if not exists pgcrypto;

-- Consent and lifecycle fields on active bookings.
alter table public.bookings add column if not exists sms_opt_in boolean not null default false;
alter table public.bookings add column if not exists sms_opt_in_at timestamptz;
alter table public.bookings add column if not exists sms_opt_in_source text;
alter table public.bookings add column if not exists sms_opt_in_text_version text;
alter table public.bookings add column if not exists reminder_72h_sent_at timestamptz;
alter table public.bookings add column if not exists reminder_42h_sent_at timestamptz;
alter table public.bookings add column if not exists rescheduled_at timestamptz;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists cancellation_reason text;

-- booking_drafts is created by V2.3.4, but guard the migration for partial installs.
create table if not exists public.booking_drafts
  (like public.bookings including defaults including constraints including indexes);
alter table public.booking_drafts add column if not exists sms_opt_in boolean not null default false;
alter table public.booking_drafts add column if not exists sms_opt_in_at timestamptz;
alter table public.booking_drafts add column if not exists sms_opt_in_source text;
alter table public.booking_drafts add column if not exists sms_opt_in_text_version text;
alter table public.booking_drafts add column if not exists reminder_72h_sent_at timestamptz;
alter table public.booking_drafts add column if not exists reminder_42h_sent_at timestamptz;
alter table public.booking_drafts add column if not exists rescheduled_at timestamptz;
alter table public.booking_drafts add column if not exists cancelled_at timestamptz;
alter table public.booking_drafts add column if not exists cancellation_reason text;

-- A server-only delivery ledger. Create it when an older/partial database does not have it.
create table if not exists public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  notification_type text not null,
  recipient_type text not null default 'customer',
  recipient_email text,
  recipient_phone text,
  channel text not null default 'make',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  sent_at timestamptz,
  last_error text,
  provider_message_id text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_notifications add column if not exists booking_id uuid references public.bookings(id) on delete cascade;
alter table public.booking_notifications add column if not exists notification_type text;
alter table public.booking_notifications add column if not exists recipient_type text not null default 'customer';
alter table public.booking_notifications add column if not exists recipient_email text;
alter table public.booking_notifications add column if not exists recipient_phone text;
alter table public.booking_notifications add column if not exists channel text not null default 'make';
alter table public.booking_notifications add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.booking_notifications add column if not exists status text not null default 'pending';
alter table public.booking_notifications add column if not exists attempts integer not null default 0;
alter table public.booking_notifications add column if not exists sent_at timestamptz;
alter table public.booking_notifications add column if not exists last_error text;
alter table public.booking_notifications add column if not exists provider_message_id text;
alter table public.booking_notifications add column if not exists dedupe_key text;
alter table public.booking_notifications add column if not exists created_at timestamptz not null default now();
alter table public.booking_notifications add column if not exists updated_at timestamptz not null default now();

alter table public.booking_notifications alter column recipient_email drop not null;
alter table public.booking_notifications drop constraint if exists booking_notifications_channel_check;
alter table public.booking_notifications add constraint booking_notifications_channel_check
  check (channel in ('email','sms','make'));

create unique index if not exists booking_notifications_dedupe_unique
  on public.booking_notifications(dedupe_key)
  where dedupe_key is not null;
create index if not exists booking_notifications_booking_status_idx
  on public.booking_notifications(booking_id, status, created_at desc);
create index if not exists bookings_reminder_72h_idx
  on public.bookings(reminder_72h_sent_at, event_date, request_status);
create index if not exists bookings_reminder_42h_idx
  on public.bookings(reminder_42h_sent_at, event_date, request_status);
create index if not exists bookings_sms_consent_idx
  on public.bookings(sms_opt_in, event_date);

-- Server-only access. The browser may store consent in booking_drafts only through the
-- existing constrained insert policy from V2.3.4; it cannot read the notification ledger.
alter table public.booking_notifications enable row level security;
revoke all on public.booking_notifications from anon, authenticated;
grant select, insert, update on public.booking_notifications to service_role;
grant select, update on public.bookings to service_role;
grant select, insert, update, delete on public.booking_drafts to service_role;

notify pgrst, 'reload schema';
commit;

-- Verification: every row should say OK.
with checks(object_type, object_name, is_ok) as (
  values
    ('bookings column','sms_opt_in',exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='sms_opt_in')),
    ('bookings column','sms_opt_in_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='sms_opt_in_at')),
    ('bookings column','reminder_72h_sent_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='reminder_72h_sent_at')),
    ('bookings column','reminder_42h_sent_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='reminder_42h_sent_at')),
    ('bookings column','cancelled_at',exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='cancelled_at')),
    ('draft column','sms_opt_in',exists(select 1 from information_schema.columns where table_schema='public' and table_name='booking_drafts' and column_name='sms_opt_in')),
    ('notification column','dedupe_key',exists(select 1 from information_schema.columns where table_schema='public' and table_name='booking_notifications' and column_name='dedupe_key')),
    ('notification channel','make',exists(
      select 1 from pg_constraint c
      join pg_class t on t.oid=c.conrelid
      join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public' and t.relname='booking_notifications'
        and c.conname='booking_notifications_channel_check'
        and pg_get_constraintdef(c.oid) like '%make%'
    )),
    ('index','booking_notifications_dedupe_unique',to_regclass('public.booking_notifications_dedupe_unique') is not null)
)
select object_type, object_name, case when is_ok then 'OK' else 'MISSING' end as status
from checks order by object_type, object_name;
