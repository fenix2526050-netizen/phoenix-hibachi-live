-- Phoenix Hibachi Master Build V164 — additive upgrade patch
-- Safe goal: add CRM/payment/coupon/wallet foundations without dropping existing data.
-- Run in Supabase SQL Editor after backing up current data.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Official public contact settings / one source of truth
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, public_read)
values (
  'contact_settings',
  '{
    "business_name":"Phoenix Hibachi",
    "business_phone":"5165183325",
    "text_phone":"5165183325",
    "booking_email":"booking@phoenix-hibachi.com",
    "support_email":"support@phoenix-hibachi.com",
    "orders_email":"orders@phoenix-hibachi.com",
    "info_email":"info@phoenix-hibachi.com",
    "internal_gmail":"phoenixhibachi.team@gmail.com",
    "website_url":"https://phoenix-hibachi.com",
    "service_area_text":"NY, NJ, CT, Long Island",
    "cancellation_policy_title":"72-Hour Policy",
    "cancellation_policy_text":"Deposits are applied toward your final balance. Cancellations within 72 hours of the event may be non-refundable. Rescheduling is subject to availability and must be confirmed by Phoenix Hibachi.",
    "public_phone_provider":"Quo",
    "private_phone_policy":"Private owner number is internal only and should not be displayed on customer-facing pages."
  }'::jsonb,
  true
)
on conflict (key) do update set
  value = excluded.value,
  public_read = true,
  updated_at = now();

insert into public.app_settings (key, value, public_read)
values (
  'phoenix_os_modules_v164',
  '{
    "core_booking":true,
    "invoice_branding":true,
    "unified_role_login":true,
    "crm_foundation":true,
    "coupon_foundation":true,
    "gift_card_wallet_foundation":true,
    "payment_foundation":true,
    "google_integration_reserved":true,
    "quo_phone_reserved":true,
    "ads_tracking_reserved":true,
    "customer_visible_coupon_use":false,
    "customer_visible_gift_card_use":false,
    "stripe_checkout_live":false,
    "zelle_qr_live":false,
    "sms_marketing_live":false
  }'::jsonb,
  true
)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- -----------------------------------------------------------------------------
-- Bookings: additive finance/CRM fields. Do not remove or rename existing fields.
-- -----------------------------------------------------------------------------
alter table public.bookings add column if not exists customer_id uuid;
alter table public.bookings add column if not exists lead_source text;
alter table public.bookings add column if not exists utm_source text;
alter table public.bookings add column if not exists utm_medium text;
alter table public.bookings add column if not exists utm_campaign text;
alter table public.bookings add column if not exists protein_selections jsonb not null default '{}'::jsonb;
alter table public.bookings add column if not exists protein_summary text;
alter table public.bookings add column if not exists protein_upcharge numeric(10,2) not null default 0;
alter table public.bookings add column if not exists food_subtotal numeric(10,2) not null default 0;
alter table public.bookings add column if not exists sales_tax numeric(10,2) not null default 0;
alter table public.bookings add column if not exists service_notes text;
alter table public.bookings add column if not exists preferred_arrival_window text;
alter table public.bookings add column if not exists applied_coupon_id uuid;
alter table public.bookings add column if not exists applied_coupon_code text;
alter table public.bookings add column if not exists coupon_discount numeric(10,2) not null default 0;
alter table public.bookings add column if not exists manager_discount numeric(10,2) not null default 0;
alter table public.bookings add column if not exists points_discount numeric(10,2) not null default 0;
alter table public.bookings add column if not exists gift_card_used numeric(10,2) not null default 0;
alter table public.bookings add column if not exists wallet_credit_used numeric(10,2) not null default 0;
alter table public.bookings add column if not exists zelle_status text not null default 'not_requested';
alter table public.bookings add column if not exists zelle_reference text;
alter table public.bookings add column if not exists stripe_checkout_session_id text;
alter table public.bookings add column if not exists stripe_payment_intent_id text;

create index if not exists bookings_customer_id_idx on public.bookings(customer_id);
create index if not exists bookings_lead_source_idx on public.bookings(lower(coalesce(lead_source,'')));
create index if not exists bookings_coupon_code_idx on public.bookings(lower(coalesce(applied_coupon_code,'')));

-- -----------------------------------------------------------------------------
-- Customers / contacts / consent
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references public.profiles(id) on delete set null,
  full_name text,
  normalized_email text,
  normalized_phone text,
  primary_email text,
  primary_phone text,
  city text,
  state text,
  zip text,
  birthday date,
  child_birthday date,
  customer_tier text not null default 'member',
  vip_status text not null default 'regular',
  lifecycle_stage text not null default 'lead',
  total_spent numeric(12,2) not null default 0,
  total_bookings integer not null default 0,
  points_balance integer not null default 0,
  wallet_balance numeric(12,2) not null default 0,
  first_source text,
  last_source text,
  notes text,
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_tier_check check (customer_tier in ('member','vip','gold_vip','phoenix_family_vip')),
  constraint customers_vip_status_check check (vip_status in ('regular','vip','gold','family','manual'))
);

create unique index if not exists customers_email_unique_idx on public.customers(normalized_email) where normalized_email is not null and normalized_email <> '';
create unique index if not exists customers_phone_unique_idx on public.customers(normalized_phone) where normalized_phone is not null and normalized_phone <> '';
create index if not exists customers_tier_idx on public.customers(customer_tier, vip_status);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  contact_type text not null check (contact_type in ('email','phone','address','social','other')),
  contact_value text not null,
  normalized_value text,
  is_primary boolean not null default false,
  source text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists customer_contacts_customer_idx on public.customer_contacts(customer_id);
create index if not exists customer_contacts_norm_idx on public.customer_contacts(contact_type, normalized_value);

create table if not exists public.marketing_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  channel text not null check (channel in ('sms','email','phone','mail')),
  consent_status text not null default 'unknown' check (consent_status in ('unknown','opted_in','opted_out','transactional_only')),
  source text,
  source_detail text,
  consented_at timestamptz,
  opted_out_at timestamptz,
  proof jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_consents_customer_idx on public.marketing_consents(customer_id, channel, consent_status);

-- -----------------------------------------------------------------------------
-- Leads / messages / follow-up tasks
-- -----------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  source text,
  source_detail text,
  status text not null default 'new' check (status in ('new','contacted','quoted','booked','lost','spam','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  event_date date,
  preferred_time text,
  city text,
  zip text,
  adults integer,
  kids integer,
  event_type text,
  message text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads(status, priority, created_at desc);
create index if not exists leads_customer_idx on public.leads(customer_id);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  channel text not null check (channel in ('email','sms','phone','quo','google','website','other')),
  direction text not null check (direction in ('inbound','outbound','internal')),
  provider text,
  provider_message_id text,
  from_value text,
  to_value text,
  subject text,
  body text,
  status text not null default 'logged',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists message_logs_customer_idx on public.message_logs(customer_id, created_at desc);
create index if not exists message_logs_booking_idx on public.message_logs(booking_id, created_at desc);

create table if not exists public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  task_type text not null,
  title text not null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','done','snoozed','cancelled')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists follow_up_tasks_due_idx on public.follow_up_tasks(status, due_at);

-- -----------------------------------------------------------------------------
-- Payment ledger / Zelle / Stripe / settlement-ready records
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  method text not null check (method in ('stripe','zelle','cash','gift_card','wallet','points','manual','other')),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','voided','manual_review')),
  provider_reference text,
  provider_payload jsonb not null default '{}'::jsonb,
  proof_image_url text,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_booking_idx on public.payments(booking_id, status, created_at desc);
create index if not exists payments_customer_idx on public.payments(customer_id, created_at desc);

create table if not exists public.payment_methods_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.payment_methods_settings(key, value, enabled)
values
('zelle', '{"display_name":"Phoenix Hibachi","qr_url":"","phone_or_email":"","memo_instruction":"Please include your Phoenix invoice/order number in the Zelle memo.","manual_confirmation_required":true}'::jsonb, false),
('stripe', '{"publishable_key":"","webhook_status":"not_configured","deposit_checkout_enabled":false,"balance_checkout_enabled":false}'::jsonb, false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Coupons: one code per order; one-time codes and date/month windows supported.
-- -----------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text,
  discount_type text not null default 'fixed' check (discount_type in ('fixed','percent')),
  discount_value numeric(10,2) not null check (discount_value >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  applicable_event_date_start date,
  applicable_event_date_end date,
  applicable_month integer check (applicable_month between 1 and 12),
  minimum_order_amount numeric(12,2) not null default 0,
  first_time_customer_only boolean not null default false,
  max_redemptions integer not null default 1,
  max_redemptions_per_customer integer not null default 1,
  random_generated boolean not null default false,
  stackable boolean not null default false,
  status text not null default 'active' check (status in ('active','expired','disabled','used')),
  created_by uuid references public.profiles(id) on delete set null,
  assigned_customer_id uuid references public.customers(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coupons_active_idx on public.coupons(status, starts_at, expires_at);
create index if not exists coupons_assigned_customer_idx on public.coupons(assigned_customer_id);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  code text not null,
  discount_amount numeric(10,2) not null default 0,
  status text not null default 'reserved' check (status in ('reserved','redeemed','released','voided','expired')),
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id, status);
create index if not exists coupon_redemptions_customer_idx on public.coupon_redemptions(customer_id, code);
create unique index if not exists one_active_coupon_per_booking_idx
  on public.coupon_redemptions(booking_id)
  where status in ('reserved','redeemed') and booking_id is not null;


-- -----------------------------------------------------------------------------
-- Coupon helper functions. These support random one-time coupon generation and
-- automatic expiration checks. The website should still validate coupons through
-- server-side logic before redemption is opened publicly.
-- -----------------------------------------------------------------------------
create or replace function public.phx_generate_coupon_code(prefix text default 'PHX')
returns text
language sql
volatile
as $$
  select upper(coalesce(nullif(prefix,''),'PHX') || '-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
$$;

create or replace function public.phx_expire_old_coupons()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  update public.coupons
     set status = 'expired', updated_at = now()
   where status = 'active'
     and expires_at is not null
     and expires_at < now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gift card / wallet / points ledgers. Ledger is the source of truth.
-- -----------------------------------------------------------------------------
create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  card_number text unique not null,
  pin_hash text,
  customer_id uuid references public.customers(id) on delete set null,
  initial_amount numeric(12,2) not null default 0,
  bonus_amount numeric(12,2) not null default 0,
  current_balance numeric(12,2) not null default 0,
  status text not null default 'created' check (status in ('created','active','frozen','depleted','voided','lost_replaced')),
  issued_at timestamptz,
  activated_at timestamptz,
  shipped_at timestamptz,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gift_cards_customer_idx on public.gift_cards(customer_id, status);

create table if not exists public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  transaction_type text not null check (transaction_type in ('purchase','bonus','redeem','refund','adjustment','void')),
  amount numeric(12,2) not null,
  balance_after numeric(12,2),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gift_card_transactions_card_idx on public.gift_card_transactions(gift_card_id, created_at desc);

create table if not exists public.customer_wallets (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  current_balance numeric(12,2) not null default 0,
  total_purchased numeric(12,2) not null default 0,
  total_bonus numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  transaction_type text not null check (transaction_type in ('purchase','bonus','redeem','refund','adjustment','void')),
  amount numeric(12,2) not null,
  balance_after numeric(12,2),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_customer_idx on public.wallet_transactions(customer_id, created_at desc);

create table if not exists public.loyalty_points_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  reason text not null,
  points integer not null,
  balance_after integer,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_points_customer_idx on public.loyalty_points_ledger(customer_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Campaigns / one-click promotions foundation. Do not send unless consent is valid.
-- -----------------------------------------------------------------------------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_type text not null default 'promotion' check (campaign_type in ('promotion','birthday','review_request','rebooking','announcement','coupon')),
  channel text not null default 'email' check (channel in ('email','sms','both')),
  audience_filter jsonb not null default '{}'::jsonb,
  subject text,
  body text,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','cancelled')),
  scheduled_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  channel text not null check (channel in ('email','sms')),
  destination text,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped','opted_out')),
  provider_message_id text,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create unique index if not exists campaign_recipient_unique_idx on public.campaign_recipients(campaign_id, customer_id, channel);

-- -----------------------------------------------------------------------------
-- Audit logs for admin actions.
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Updated-at triggers for new tables.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    execute 'drop trigger if exists customers_set_updated_at on public.customers';
    execute 'create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at()';
    execute 'drop trigger if exists leads_set_updated_at on public.leads';
    execute 'create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at()';
    execute 'drop trigger if exists payments_set_updated_at on public.payments';
    execute 'create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at()';
    execute 'drop trigger if exists coupons_set_updated_at on public.coupons';
    execute 'create trigger coupons_set_updated_at before update on public.coupons for each row execute function public.set_updated_at()';
    execute 'drop trigger if exists gift_cards_set_updated_at on public.gift_cards';
    execute 'create trigger gift_cards_set_updated_at before update on public.gift_cards for each row execute function public.set_updated_at()';
    execute 'drop trigger if exists campaigns_set_updated_at on public.campaigns';
    execute 'create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at()';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- RLS: lock CRM/finance tables to authenticated staff for now. Public booking
-- remains handled by existing booking policies. Customer self-service can be
-- opened later after dashboard auth paths are fully tested.
-- -----------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.marketing_consents enable row level security;
alter table public.leads enable row level security;
alter table public.message_logs enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.payments enable row level security;
alter table public.payment_methods_settings enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.gift_cards enable row level security;
alter table public.gift_card_transactions enable row level security;
alter table public.customer_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.loyalty_points_ledger enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.audit_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'customers','customer_contacts','marketing_consents','leads','message_logs','follow_up_tasks','payments','payment_methods_settings',
    'coupons','coupon_redemptions','gift_cards','gift_card_transactions','customer_wallets','wallet_transactions','loyalty_points_ledger','campaigns','campaign_recipients','audit_logs'
  ] loop
    execute format('drop policy if exists "staff manage %I" on public.%I', t, t);
    execute format('create policy "staff manage %I" on public.%I for all using (public.current_user_is_staff()) with check (public.current_user_is_staff())', t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.customer_contacts to authenticated;
grant select, insert, update, delete on public.marketing_consents to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.message_logs to authenticated;
grant select, insert, update, delete on public.follow_up_tasks to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.payment_methods_settings to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;
grant select, insert, update, delete on public.coupon_redemptions to authenticated;
grant select, insert, update, delete on public.gift_cards to authenticated;
grant select, insert, update, delete on public.gift_card_transactions to authenticated;
grant select, insert, update, delete on public.customer_wallets to authenticated;
grant select, insert, update, delete on public.wallet_transactions to authenticated;
grant select, insert, update, delete on public.loyalty_points_ledger to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.campaign_recipients to authenticated;
grant select, insert, update, delete on public.audit_logs to authenticated;

commit;
