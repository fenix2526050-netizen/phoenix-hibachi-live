-- Phoenix Hibachi V2.3.8
-- Complete lifecycle/payment schema repair and party-size deposit foundation.
-- Safe to run more than once.

begin;

create extension if not exists pgcrypto;

-- Active bookings must accept every field copied from booking_drafts by booking-lifecycle.
alter table public.bookings
  add column if not exists request_status text default 'submitted',
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists abandoned_at timestamptz,
  add column if not exists payment_access_token_hash text,
  add column if not exists payment_preference text default 'cash',
  add column if not exists deposit_status text default 'unpaid',
  add column if not exists deposit_required_cents bigint not null default 10000,
  add column if not exists deposit_due_cents bigint not null default 10000,
  add column if not exists deposit_deferred boolean not null default true,
  add column if not exists payment_verification_status text default 'not_verified',
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists paid_amount numeric not null default 0,
  add column if not exists balance_due_cents bigint not null default 0,
  add column if not exists order_total_cents bigint not null default 0,
  add column if not exists food_subtotal_cents bigint not null default 0,
  add column if not exists sales_tax_cents bigint not null default 0,
  add column if not exists tip_cents bigint not null default 0,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

-- Draft table may have been created before the active table received newer fields.
create table if not exists public.booking_drafts
  (like public.bookings including defaults including constraints including indexes);

alter table public.booking_drafts
  add column if not exists draft_status text not null default 'open',
  add column if not exists draft_updated_at timestamptz not null default now(),
  add column if not exists finalized_at timestamptz,
  add column if not exists request_status text default 'draft_checkout',
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists abandoned_at timestamptz,
  add column if not exists payment_access_token_hash text,
  add column if not exists payment_preference text default 'cash',
  add column if not exists deposit_status text default 'unpaid',
  add column if not exists deposit_required_cents bigint not null default 10000,
  add column if not exists deposit_due_cents bigint not null default 10000,
  add column if not exists deposit_deferred boolean not null default true,
  add column if not exists payment_verification_status text default 'not_verified',
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists paid_amount numeric not null default 0,
  add column if not exists balance_due_cents bigint not null default 0,
  add column if not exists order_total_cents bigint not null default 0,
  add column if not exists food_subtotal_cents bigint not null default 0,
  add column if not exists sales_tax_cents bigint not null default 0,
  add column if not exists tip_cents bigint not null default 0,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

alter table public.bookings alter column request_status set default 'submitted';
alter table public.booking_drafts alter column request_status set default 'draft_checkout';

create unique index if not exists booking_drafts_booking_number_unique
  on public.booking_drafts (booking_number);
create index if not exists booking_drafts_expiry_idx
  on public.booking_drafts (draft_status, checkout_expires_at);

alter table public.booking_drafts enable row level security;
revoke all on public.booking_drafts from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant insert on public.booking_drafts to anon, authenticated;
grant select, insert, update, delete on public.booking_drafts to service_role;
grant select, insert, update, delete on public.bookings to service_role;

drop policy if exists booking_drafts_public_insert on public.booking_drafts;
create policy booking_drafts_public_insert
on public.booking_drafts
for insert
to anon, authenticated
with check (
  request_status = 'draft_checkout'
  and lower(coalesce(status, '')) like 'draft%'
  and checkout_expires_at is not null
);

-- Normalize missing deposit defaults without overwriting real paid amounts.
update public.bookings
set deposit_required_cents = case
      when coalesce(guest_count, adults + kids, 0) >= 31 then 30000
      when coalesce(guest_count, adults + kids, 0) >= 21 then 20000
      else 10000
    end,
    deposit_due_cents = greatest(
      0,
      case
        when coalesce(guest_count, adults + kids, 0) >= 31 then 30000
        when coalesce(guest_count, adults + kids, 0) >= 21 then 20000
        else 10000
      end - round(coalesce(deposit_amount, 0) * 100)::bigint
    )
where coalesce(deposit_required_cents, 0) <= 0;

update public.booking_drafts
set deposit_required_cents = case
      when coalesce(guest_count, adults + kids, 0) >= 31 then 30000
      when coalesce(guest_count, adults + kids, 0) >= 21 then 20000
      else 10000
    end,
    deposit_due_cents = greatest(
      0,
      case
        when coalesce(guest_count, adults + kids, 0) >= 31 then 30000
        when coalesce(guest_count, adults + kids, 0) >= 21 then 20000
        else 10000
      end - round(coalesce(deposit_amount, 0) * 100)::bigint
    )
where coalesce(deposit_required_cents, 0) <= 0;

notify pgrst, 'reload schema';

commit;

-- Verification: all values should be true.
select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='abandoned_at') as bookings_abandoned_at,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='payment_access_token_hash') as bookings_payment_token,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='booking_drafts' and column_name='abandoned_at') as drafts_abandoned_at,
  has_table_privilege('anon','public.booking_drafts','INSERT') as anon_can_insert_drafts,
  exists(select 1 from pg_policies where schemaname='public' and tablename='booking_drafts' and policyname='booking_drafts_public_insert') as draft_insert_policy;
