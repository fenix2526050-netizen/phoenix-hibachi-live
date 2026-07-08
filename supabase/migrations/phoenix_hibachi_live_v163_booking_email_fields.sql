-- Phoenix Hibachi V163: dedicated booking fields for Make/Gmail order notifications.
-- Run this once in Supabase SQL Editor before uploading/testing V163 website code.

alter table public.bookings
  add column if not exists protein_selections jsonb not null default '{}'::jsonb,
  add column if not exists protein_summary text,
  add column if not exists protein_upcharge numeric(10,2) not null default 0,
  add column if not exists food_subtotal numeric(10,2),
  add column if not exists sales_tax numeric(10,2),
  add column if not exists service_notes text,
  add column if not exists preferred_arrival_window text;

-- Existing columns used by the email template; this is safe if they already exist.
alter table public.bookings
  add column if not exists final_total numeric(10,2),
  add column if not exists balance_due numeric(10,2),
  add column if not exists paid_amount numeric(10,2) not null default 0;

-- Make sure anonymous booking inserts and staff reads still work after adding fields.
grant insert on public.bookings to anon, authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
