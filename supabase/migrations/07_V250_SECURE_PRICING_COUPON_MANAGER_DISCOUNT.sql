-- Phoenix Hibachi V250: secure pricing/coupon/manager discount support
begin;

alter table public.bookings add column if not exists food_subtotal numeric(12,2) not null default 0;
alter table public.bookings add column if not exists food_subtotal_cents bigint not null default 0;
alter table public.bookings add column if not exists sales_tax numeric(12,2) not null default 0;
alter table public.bookings add column if not exists sales_tax_cents bigint not null default 0;
alter table public.bookings add column if not exists manager_discount numeric(10,2) not null default 0;
alter table public.bookings add column if not exists coupon_discount numeric(10,2) not null default 0;
alter table public.bookings add column if not exists applied_coupon_id uuid;
alter table public.bookings add column if not exists applied_coupon_code text;

create index if not exists bookings_applied_coupon_code_idx on public.bookings(lower(coalesce(applied_coupon_code,'')));
create unique index if not exists one_active_coupon_per_booking_idx
  on public.coupon_redemptions(booking_id)
  where status in ('reserved','redeemed') and booking_id is not null;

commit;
