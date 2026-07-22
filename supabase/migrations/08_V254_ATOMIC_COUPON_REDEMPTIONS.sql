begin;

-- Keep active orders and provisional drafts on the same secure-pricing schema.
-- This block is idempotent and also covers projects where the earlier V250
-- migration was only applied to public.bookings.
alter table public.bookings
  add column if not exists food_subtotal numeric(12,2) not null default 0,
  add column if not exists food_subtotal_cents bigint not null default 0,
  add column if not exists sales_tax numeric(12,2) not null default 0,
  add column if not exists sales_tax_cents bigint not null default 0,
  add column if not exists final_total numeric(12,2) not null default 0,
  add column if not exists order_total_cents bigint not null default 0,
  add column if not exists balance_due numeric(12,2) not null default 0,
  add column if not exists balance_due_cents bigint not null default 0,
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists deposit_amount numeric(12,2) not null default 0,
  add column if not exists deposit_required_cents bigint not null default 20000,
  add column if not exists deposit_due_cents bigint not null default 20000,
  add column if not exists payment_verification_status text default 'not_verified',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists manager_discount numeric(10,2) not null default 0,
  add column if not exists coupon_discount numeric(10,2) not null default 0,
  add column if not exists applied_coupon_id uuid,
  add column if not exists applied_coupon_code text;

alter table public.booking_drafts
  add column if not exists draft_status text not null default 'open',
  add column if not exists draft_updated_at timestamptz not null default now(),
  add column if not exists finalized_at timestamptz,
  add column if not exists request_status text default 'draft_checkout',
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists payment_access_token_hash text,
  add column if not exists food_subtotal numeric(12,2) not null default 0,
  add column if not exists food_subtotal_cents bigint not null default 0,
  add column if not exists sales_tax numeric(12,2) not null default 0,
  add column if not exists sales_tax_cents bigint not null default 0,
  add column if not exists final_total numeric(12,2) not null default 0,
  add column if not exists order_total_cents bigint not null default 0,
  add column if not exists balance_due numeric(12,2) not null default 0,
  add column if not exists balance_due_cents bigint not null default 0,
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists deposit_amount numeric(12,2) not null default 0,
  add column if not exists deposit_required_cents bigint not null default 20000,
  add column if not exists deposit_due_cents bigint not null default 20000,
  add column if not exists deposit_deferred boolean not null default true,
  add column if not exists deposit_status text default 'unpaid',
  add column if not exists payment_status text default 'unpaid',
  add column if not exists payment_verification_status text default 'not_verified',
  add column if not exists tip_cents bigint not null default 0,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists manager_discount numeric(10,2) not null default 0,
  add column if not exists coupon_discount numeric(10,2) not null default 0,
  add column if not exists applied_coupon_id uuid,
  add column if not exists applied_coupon_code text;

alter table public.bookings alter column deposit_required_cents set default 20000;
alter table public.bookings alter column deposit_due_cents set default 20000;
alter table public.booking_drafts alter column deposit_required_cents set default 20000;
alter table public.booking_drafts alter column deposit_due_cents set default 20000;

-- Active bookings are server-created only. Older Phoenix migrations allowed
-- anonymous inserts directly into bookings, which let a forged browser request
-- choose protected money fields. Drafts remain public-insertable, but only as
-- short-lived zero-money checkout drafts that must be repriced by Edge Functions.
alter table public.bookings enable row level security;
drop policy if exists "public can create bookings" on public.bookings;
revoke insert on public.bookings from anon, authenticated;
grant select, insert, update, delete on public.bookings to service_role;

-- Profile authorization is never allowed to trust user-editable metadata. A
-- normal member may keep their own contact/avatar fields current, but cannot
-- promote role/account_status. Chef self-registration is the only non-customer
-- role accepted on an untrusted insert, and it always starts pending.
create or replace function public.phx_enforce_profile_role_security()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  v_trusted_caller boolean := current_user in (
    'postgres', 'service_role', 'supabase_admin'
  );
  v_auth_service_caller boolean := current_user = 'supabase_auth_admin';
  v_staff_caller boolean := false;
  v_role_manager_caller boolean := false;
begin
  if v_trusted_caller then
    return new;
  end if;

  select
    coalesce(bool_or(lower(coalesce(p.role, '')) in ('admin','owner','manager','customer_service','staff')), false),
    coalesce(bool_or(lower(coalesce(p.role, '')) in ('admin','owner','manager')), false)
  into v_staff_caller, v_role_manager_caller
  from public.profiles p
  where p.id = auth.uid();

  if tg_op = 'INSERT' then
    if not v_auth_service_caller
       and (auth.uid() is null or new.id is distinct from auth.uid()) then
      raise exception 'A profile may only be created for the signed-in user.';
    end if;
    if lower(coalesce(new.role, '')) = 'chef' then
      new.role := 'chef';
      new.account_status := 'pending';
    else
      new.role := 'customer';
      new.account_status := 'active';
    end if;
    return new;
  end if;

  if v_auth_service_caller then
    new.id := old.id;
    new.role := old.role;
    new.account_status := old.account_status;
    return new;
  end if;

  if v_staff_caller then
    if not v_role_manager_caller then
      new.role := old.role;
      new.account_status := old.account_status;
    end if;
    return new;
  end if;

  if auth.uid() is null or old.id is distinct from auth.uid() then
    raise exception 'A profile may only be updated by its owner or staff.';
  end if;
  new.id := old.id;
  new.role := old.role;
  new.account_status := old.account_status;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_role_security_v254 on public.profiles;
create trigger profiles_enforce_role_security_v254
before insert or update on public.profiles
for each row execute function public.phx_enforce_profile_role_security();

revoke all on function public.phx_enforce_profile_role_security() from public, anon, authenticated;

-- Defense in depth: authenticated browser sessions may only update operational
-- scheduling/status fields that the current Admin UI still writes directly.
-- Price, guest, menu, address, payment and Coupon columns remain service-role only,
-- so editing a browser payload cannot overwrite protected order data.
revoke update on public.bookings from public, anon, authenticated;
do $$
declare
  v_columns text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_columns
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'bookings'
    and c.column_name = any(array[
      'status',
      'request_status',
      'activated_at',
      'abandoned_at',
      'cancelled_at',
      'cancellation_reason',
      'rescheduled_at',
      'event_date',
      'event_time',
      'exact_event_time',
      'preferred_arrival_window',
      'admin_notes',
      'service_notes',
      'customer_notes',
      'special_notes',
      'special_requests',
      'allergy_notes',
      'allergies',
      'assigned_chef_id',
      'assigned_chef_name',
      'reminder_72h_sent_at',
      'reminder_42h_sent_at',
      'sms_opt_in',
      'sms_consent_at',
      'sms_consent_source',
      'updated_at'
    ]);

  if v_columns is not null then
    execute format('grant update (%s) on table public.bookings to authenticated', v_columns);
  end if;
end
$$;

alter table public.booking_drafts enable row level security;
drop policy if exists booking_drafts_public_insert on public.booking_drafts;
create policy booking_drafts_public_insert
on public.booking_drafts
for insert
to anon, authenticated
with check (
  request_status = 'draft_checkout'
  and lower(coalesce(status, '')) like 'draft%'
  and draft_status = 'open'
  and checkout_expires_at is not null
  and checkout_expires_at > now()
  and checkout_expires_at <= now() + interval '3 hours'
  and booking_number ~ '^PHX-[0-9]{6}-[A-Z0-9]{4,12}$'
  and payment_access_token_hash ~ '^[0-9a-f]{64}$'
  and coalesce(food_subtotal, 0) = 0
  and coalesce(food_subtotal_cents, 0) = 0
  and coalesce(sales_tax, 0) = 0
  and coalesce(sales_tax_cents, 0) = 0
  and coalesce(final_total, 0) = 0
  and coalesce(order_total_cents, 0) = 0
  and coalesce(balance_due, 0) = 0
  and coalesce(balance_due_cents, 0) = 0
  and coalesce(paid_amount, 0) = 0
  and coalesce(deposit_amount, 0) = 0
  and coalesce(deposit_required_cents, 20000) = 20000
  and coalesce(deposit_due_cents, 20000) = 20000
  and coalesce(deposit_deferred, true) = true
  and coalesce(tip_cents, 0) = 0
  and lower(coalesce(deposit_status, 'unpaid')) = 'unpaid'
  and lower(coalesce(payment_status, 'unpaid')) = 'unpaid'
  and coalesce(manager_discount, 0) = 0
  and coalesce(coupon_discount, 0) = 0
  and applied_coupon_id is null
  and nullif(trim(coalesce(applied_coupon_code, '')), '') is null
  and coalesce(payment_verification_status, 'not_verified') in ('not_verified', '')
  and nullif(trim(coalesce(stripe_checkout_session_id, '')), '') is null
  and nullif(trim(coalesce(stripe_payment_intent_id, '')), '') is null
);
revoke select, update, delete on public.booking_drafts from anon, authenticated;
grant insert on public.booking_drafts to anon, authenticated;
grant select, insert, update, delete on public.booking_drafts to service_role;

-- Coupon inventory and redemption history are never browser-readable/writable.
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupons from anon, authenticated;
revoke all on public.coupon_redemptions from anon, authenticated;
grant select, insert, update, delete on public.coupons to service_role;
grant select, insert, update, delete on public.coupon_redemptions to service_role;

alter table public.coupon_redemptions
  add column if not exists draft_id uuid,
  add column if not exists customer_email text,
  add column if not exists checkout_session_id text;

-- Only an in-flight reservation must be unique. Historical redeemed rows are
-- left compatible with older production data; the RPC still rejects replacing
-- a redeemed Coupon on the same order.
drop index if exists public.one_active_coupon_per_booking_idx;
create unique index one_active_coupon_per_booking_idx
  on public.coupon_redemptions(booking_id)
  where status = 'reserved' and booking_id is not null;

drop index if exists public.one_active_coupon_per_draft_idx;
create unique index one_active_coupon_per_draft_idx
  on public.coupon_redemptions(draft_id)
  where status = 'reserved' and draft_id is not null;

create index if not exists bookings_applied_coupon_code_idx
  on public.bookings(lower(coalesce(applied_coupon_code, '')));

create index if not exists coupon_redemptions_email_idx
  on public.coupon_redemptions(lower(customer_email), coupon_id, status)
  where customer_email is not null;

create index if not exists coupon_redemptions_checkout_idx
  on public.coupon_redemptions(checkout_session_id)
  where checkout_session_id is not null;

create or replace function public.phx_reserve_coupon_redemption(
  p_coupon_id uuid,
  p_booking_id uuid default null,
  p_draft_id uuid default null,
  p_customer_id uuid default null,
  p_customer_email text default null,
  p_code text default null,
  p_discount numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_existing public.coupon_redemptions%rowtype;
  v_total integer := 0;
  v_customer_total integer := 0;
  v_email text := lower(nullif(trim(coalesce(p_customer_email, '')), ''));
begin
  if p_coupon_id is null then
    raise exception 'Coupon is required.';
  end if;
  if (p_booking_id is null and p_draft_id is null)
     or (p_booking_id is not null and p_draft_id is not null) then
    raise exception 'Exactly one booking or draft reference is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_coupon_id::text, 0));

  select * into v_coupon
  from public.coupons
  where id = p_coupon_id
  for update;

  if not found or v_coupon.status <> 'active' then
    raise exception 'This coupon is invalid or inactive.';
  end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then
    raise exception 'This coupon is not active yet.';
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception 'This coupon has expired.';
  end if;

  select * into v_existing
  from public.coupon_redemptions
  where status in ('reserved','redeemed')
    and (
      (p_booking_id is not null and booking_id = p_booking_id)
      or
      (p_draft_id is not null and draft_id = p_draft_id)
    )
  order by created_at desc
  limit 1
  for update;

  if found and v_existing.status = 'redeemed' then
    if v_existing.coupon_id = p_coupon_id then
      return v_existing.id;
    end if;
    raise exception 'A redeemed coupon cannot be replaced on this order.';
  end if;

  select count(*) into v_total
  from public.coupon_redemptions
  where coupon_id = p_coupon_id
    and status in ('reserved','redeemed')
    and (v_existing.id is null or id <> v_existing.id);

  if coalesce(v_coupon.max_redemptions, 0) > 0
     and v_total >= v_coupon.max_redemptions then
    raise exception 'This coupon has reached its usage limit.';
  end if;

  if coalesce(v_coupon.max_redemptions_per_customer, 0) > 0
     and (p_customer_id is not null or v_email is not null) then
    select count(*) into v_customer_total
    from public.coupon_redemptions
    where coupon_id = p_coupon_id
      and status in ('reserved','redeemed')
      and (v_existing.id is null or id <> v_existing.id)
      and (
        (p_customer_id is not null and customer_id = p_customer_id)
        or
        (v_email is not null and lower(customer_email) = v_email)
      );

    if v_customer_total >= v_coupon.max_redemptions_per_customer then
      raise exception 'This coupon has already been used by this customer.';
    end if;
  end if;

  if v_existing.id is not null then
    update public.coupon_redemptions
    set coupon_id = p_coupon_id,
        booking_id = p_booking_id,
        draft_id = p_draft_id,
        customer_id = p_customer_id,
        customer_email = v_email,
        code = upper(coalesce(nullif(trim(p_code), ''), v_coupon.code)),
        discount_amount = greatest(0, coalesce(p_discount, 0)),
        status = 'reserved',
        reserved_at = now(),
        redeemed_at = null,
        released_at = null,
        checkout_session_id = null
    where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.coupon_redemptions (
    coupon_id, booking_id, draft_id, customer_id, customer_email,
    code, discount_amount, status
  ) values (
    p_coupon_id, p_booking_id, p_draft_id, p_customer_id, v_email,
    upper(coalesce(nullif(trim(p_code), ''), v_coupon.code)),
    greatest(0, coalesce(p_discount, 0)), 'reserved'
  ) returning id into v_existing.id;

  return v_existing.id;
end;
$$;

revoke all on function public.phx_reserve_coupon_redemption(uuid, uuid, uuid, uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.phx_reserve_coupon_redemption(uuid, uuid, uuid, uuid, text, text, numeric) to service_role;



-- Atomically promote a verified provisional draft. The draft row is locked,
-- any active Coupon reservation moves to the new booking, and the draft is
-- deleted in the same database transaction.
create or replace function public.phx_promote_booking_draft(
  p_draft_id uuid,
  p_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_draft public.booking_drafts%rowtype;
  v_existing public.bookings%rowtype;
  v_payload jsonb;
  v_booking_json jsonb;
  v_insert_columns text;
  v_select_columns text;
begin
  if p_draft_id is null then
    raise exception 'Draft id is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_draft_id::text, 0));

  select * into v_existing
  from public.bookings
  where id = p_draft_id
  limit 1;
  if found then
    return to_jsonb(v_existing);
  end if;

  select * into v_draft
  from public.booking_drafts
  where id = p_draft_id
  for update;
  if not found then
    raise exception 'Provisional booking was not found.';
  end if;

  select * into v_existing
  from public.bookings
  where booking_number = v_draft.booking_number
  order by created_at desc
  limit 1;
  if found then
    raise exception 'This booking number is already active. The draft was not promoted.';
  end if;

  v_payload := (to_jsonb(v_draft)
    - 'draft_status'
    - 'draft_updated_at'
    - 'finalized_at') || coalesce(p_patch, '{}'::jsonb);

  -- Insert only columns that actually exist in public.bookings and are present
  -- in the payload. This remains safe when bookings and booking_drafts were
  -- created by different historical Phoenix migrations; missing columns use
  -- the active table defaults instead of becoming NULL or shifting by position.
  select
    string_agg(format('%I', a.attname), ', ' order by a.attnum),
    string_agg(format('src.%I', a.attname), ', ' order by a.attnum)
  into v_insert_columns, v_select_columns
  from pg_attribute a
  where a.attrelid = 'public.bookings'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attgenerated = ''
    and a.attidentity <> 'a'
    and v_payload ? a.attname;

  if v_insert_columns is null then
    raise exception 'No compatible booking columns were found for draft promotion.';
  end if;

  execute format(
    'insert into public.bookings as inserted_booking (%1$s) '
    'select %2$s from jsonb_populate_record(null::public.bookings, $1) as src '
    'returning to_jsonb(inserted_booking.*)',
    v_insert_columns,
    v_select_columns
  )
  using v_payload
  into v_booking_json;

  update public.coupon_redemptions
  set booking_id = (v_booking_json->>'id')::uuid,
      draft_id = null
  where draft_id = p_draft_id
    and status in ('reserved','redeemed');

  delete from public.booking_drafts where id = p_draft_id;
  return v_booking_json;
end;
$$;

revoke all on function public.phx_promote_booking_draft(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.phx_promote_booking_draft(uuid, jsonb) to service_role;

-- Stripe payment ledger and atomic application. One Stripe event can change a
-- booking balance only once, while different paid sessions serialize on the
-- booking row so concurrent payments cannot overwrite each other.
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'usd',
  payment_status text,
  raw_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.payment_events
  add column if not exists booking_id uuid,
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_event_id text,
  add column if not exists event_type text,
  add column if not exists amount numeric(12,2) not null default 0,
  add column if not exists currency text not null default 'usd',
  add column if not exists payment_status text,
  add column if not exists raw_summary jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists payment_events_provider_event_unique
  on public.payment_events(provider_event_id);
create index if not exists payment_events_booking_created_idx
  on public.payment_events(booking_id, created_at desc);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
grant select, insert, update, delete on public.payment_events to service_role;

create or replace function public.phx_apply_stripe_checkout_payment(
  p_event_id text,
  p_booking_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_payment_type text,
  p_currency text default 'usd',
  p_event_type text default 'checkout.session.completed',
  p_raw_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_booking public.bookings%rowtype;
  v_event_id uuid;
  v_current_paid_cents bigint;
  v_current_deposit_cents bigint;
  v_required_deposit_cents bigint;
  v_current_balance_cents bigint;
  v_new_balance_cents bigint;
  v_paid_amount_cents bigint;
  v_deposit_amount_cents bigint;
  v_deposit_due_cents bigint;
  v_full boolean;
  v_deposit_covered boolean;
begin
  if nullif(trim(coalesce(p_event_id, '')), '') is null then
    raise exception 'Stripe event id is required.';
  end if;
  if p_booking_id is null then
    raise exception 'Booking id is required.';
  end if;
  if coalesce(p_amount_cents, 0) <= 0 then
    raise exception 'Stripe payment amount must be positive.';
  end if;
  if lower(coalesce(p_payment_type, '')) not in ('deposit','full_balance','custom') then
    raise exception 'Unsupported Stripe payment type.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_booking_id::text, 0));

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'Booking was not found for Stripe payment.';
  end if;

  insert into public.payment_events (
    booking_id, provider, provider_event_id, event_type, amount,
    currency, payment_status, raw_summary
  ) values (
    p_booking_id, 'stripe', trim(p_event_id), p_event_type,
    p_amount_cents::numeric / 100,
    lower(coalesce(nullif(trim(p_currency), ''), 'usd')),
    'processing', coalesce(p_raw_summary, '{}'::jsonb)
  )
  on conflict (provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('applied', false, 'duplicate_event', true, 'booking', to_jsonb(v_booking));
  end if;

  -- Defensive second idempotency guard in case Stripe ever emits a different
  -- event id for the same completed Checkout Session.
  if coalesce(v_booking.stripe_checkout_session_id, '') = coalesce(p_session_id, '')
     and coalesce(v_booking.payment_verification_status, '') = 'verified' then
    update public.payment_events
    set payment_status = 'duplicate_session',
        raw_summary = coalesce(raw_summary, '{}'::jsonb) || jsonb_build_object('duplicate_session', true)
    where id = v_event_id;
    return jsonb_build_object('applied', false, 'duplicate_session', true, 'booking', to_jsonb(v_booking));
  end if;

  v_current_paid_cents := greatest(
    0,
    round(greatest(coalesce(v_booking.paid_amount, 0), coalesce(v_booking.deposit_amount, 0)) * 100)::bigint
  );
  v_current_deposit_cents := greatest(0, round(coalesce(v_booking.deposit_amount, 0) * 100)::bigint);
  v_required_deposit_cents := greatest(20000, coalesce(v_booking.deposit_required_cents, 20000));
  v_current_balance_cents := greatest(0, coalesce(v_booking.balance_due_cents, v_booking.order_total_cents, 0));
  v_new_balance_cents := greatest(0, v_current_balance_cents - p_amount_cents);
  v_paid_amount_cents := v_current_paid_cents + p_amount_cents;
  v_deposit_amount_cents := least(v_required_deposit_cents, greatest(v_current_deposit_cents, v_paid_amount_cents));
  v_deposit_due_cents := greatest(0, v_required_deposit_cents - v_deposit_amount_cents);
  v_full := v_new_balance_cents <= 0;
  v_deposit_covered := v_deposit_due_cents <= 0;

  update public.bookings
  set activated_at = coalesce(activated_at, now()),
      checkout_expires_at = null,
      abandoned_at = null,
      deposit_status = case when v_deposit_covered then 'paid' else 'partially_paid' end,
      deposit_amount = v_deposit_amount_cents::numeric / 100,
      paid_amount = v_paid_amount_cents::numeric / 100,
      deposit_due_cents = v_deposit_due_cents,
      balance_due = v_new_balance_cents::numeric / 100,
      balance_due_cents = v_new_balance_cents,
      deposit_deferred = not v_deposit_covered,
      deposit_paid_at = case when v_deposit_covered then coalesce(deposit_paid_at, now()) else deposit_paid_at end,
      stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id,
      payment_preference = 'stripe',
      payment_verification_status = 'verified',
      payment_status = case
        when v_full then 'paid in full'
        when v_deposit_covered then 'deposit received'
        else 'partial payment received'
      end
  where id = p_booking_id
  returning * into v_booking;

  update public.payment_events
  set payment_status = case
        when v_full then 'paid in full'
        when v_deposit_covered then 'deposit received'
        else 'partial payment received'
      end,
      raw_summary = coalesce(raw_summary, '{}'::jsonb) || jsonb_build_object(
        'session_id', p_session_id,
        'payment_intent_id', p_payment_intent_id,
        'payment_type', p_payment_type,
        'balance_before_cents', v_current_balance_cents,
        'balance_after_cents', v_new_balance_cents
      )
  where id = v_event_id;

  return jsonb_build_object('applied', true, 'booking', to_jsonb(v_booking));
end;
$$;

revoke all on function public.phx_apply_stripe_checkout_payment(text, uuid, text, text, bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.phx_apply_stripe_checkout_payment(text, uuid, text, text, bigint, text, text, text, jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
