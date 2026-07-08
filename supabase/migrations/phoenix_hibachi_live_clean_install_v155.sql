-- Phoenix Hibachi LIVE clean Supabase install V155
-- Use on a NEW Supabase project before launch.
-- Run once in Supabase Dashboard > SQL Editor > New query > Run.
-- This resets Phoenix public tables, creates RLS policies, GRANT permissions, and storage buckets.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Clean public Phoenix objects only. Auth users are NOT deleted.
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created_phoenix_profile on auth.users;

drop table if exists public.review_highlights cascade;
drop table if exists public.reschedule_requests cascade;
drop table if exists public.cancellation_requests cascade;
drop table if exists public.assignments cascade;
drop table if exists public.chefs cascade;
drop table if exists public.guest_reviews cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.chef_applications cascade;
drop table if exists public.bookings cascade;
drop table if exists public.profiles cascade;

drop function if exists public.current_user_is_staff() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.handle_new_user_profile() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.preserve_staff_profile_role() cascade;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles / portal roles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'customer',
  account_status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin','manager','customer_service','staff','chef','customer','member')),
  constraint profiles_status_check check (account_status in ('active','pending','paused','inactive','deleted'))
);

create index profiles_role_idx on public.profiles (lower(role));
create index profiles_email_idx on public.profiles (lower(email));

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((select role::text from public.profiles where id = auth.uid()), 'anonymous'))
$$;

create or replace function public.current_user_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin','manager','customer_service','staff')
$$;

-- Prevent frontend member signup/profile upserts from downgrading an existing staff/admin account to customer.
create or replace function public.preserve_staff_profile_role()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if lower(coalesce(old.role,'')) in ('admin','manager','customer_service','staff')
       and lower(coalesce(new.role,'')) in ('customer','member') then
      new.role := old.role;
      new.account_status := old.account_status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_preserve_staff_role on public.profiles;
create trigger profiles_preserve_staff_role
before update on public.profiles
for each row execute function public.preserve_staff_profile_role();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when lower(coalesce(new.raw_user_meta_data->>'requested_role','')) = 'chef' then 'chef' else 'customer' end,
    case when lower(coalesce(new.raw_user_meta_data->>'requested_role','')) = 'chef' then 'pending' else 'active' end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created_phoenix_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- -----------------------------------------------------------------------------
-- Public booking requests
-- -----------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text unique not null,
  customer_name text not null default 'Guest',
  customer_email text,
  customer_phone text,
  event_date date,
  event_time time,
  adults integer not null default 0,
  kids integer not null default 0,
  guest_count integer not null default 0,
  package_name text not null default 'Classic',
  add_ons jsonb not null default '[]'::jsonb,
  address text,
  latitude numeric,
  longitude numeric,
  allergies jsonb not null default '[]'::jsonb,
  allergy_notes text,
  rain_plan text,
  parking_notes text,
  delay_policy text,
  customer_late_policy text,
  travel_fee numeric(10,2) not null default 0,
  deposit_amount numeric(10,2) not null default 0,
  payment_status text not null default 'unpaid',
  status text not null default 'pending',
  admin_notes text,
  assigned_chef_id uuid references public.profiles(id) on delete set null,
  assigned_chef_name text,
  final_total numeric(10,2),
  paid_amount numeric(10,2) not null default 0,
  balance_due numeric(10,2),
  pdf_url text,
  pdf_path text,
  invoice_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_event_date_idx on public.bookings (event_date);
create index bookings_customer_email_idx on public.bookings (lower(customer_email));
create index bookings_customer_phone_idx on public.bookings (customer_phone);
create index bookings_status_idx on public.bookings (status);
create index bookings_assigned_chef_id_idx on public.bookings (assigned_chef_id);

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Chef/team applications
-- -----------------------------------------------------------------------------
create table public.chef_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  applicant_name text,
  phone text,
  email text,
  account_email text,
  home_zip text,
  experience_years text,
  has_transportation boolean default false,
  availability jsonb not null default '[]'::jsonb,
  service_areas jsonb not null default '[]'::jsonb,
  available_days jsonb not null default '[]'::jsonb,
  preferred_order_areas jsonb not null default '[]'::jsonb,
  chef_address_street text,
  chef_address_city text,
  chef_address_state text,
  chef_address_zip text,
  vehicle_type text,
  self_introduction text,
  notes text,
  attachment_files jsonb not null default '[]'::jsonb,
  driver_license_files jsonb not null default '[]'::jsonb,
  performance_video_files jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  account_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chef_applications_email_idx on public.chef_applications (lower(email));
create index chef_applications_status_idx on public.chef_applications (status, account_status);

drop trigger if exists chef_applications_set_updated_at on public.chef_applications;
create trigger chef_applications_set_updated_at
before update on public.chef_applications
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Global website settings/content from Admin dashboard
-- -----------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  public_read boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index app_settings_public_idx on public.app_settings (public_read, key);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Guest reviews/testimonials
-- -----------------------------------------------------------------------------
create table public.guest_reviews (
  id uuid primary key default gen_random_uuid(),
  guest_name text,
  customer_email text,
  rating integer check (rating between 1 and 5),
  title text,
  body text not null,
  platform text default 'website',
  image_url text,
  event_date date,
  published boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guest_reviews_status_idx on public.guest_reviews (status, published, created_at desc);

drop trigger if exists guest_reviews_set_updated_at on public.guest_reviews;
create trigger guest_reviews_set_updated_at
before update on public.guest_reviews
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Operational staff tables prepared for dashboard expansion
-- -----------------------------------------------------------------------------
create table public.chefs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text,
  phone text,
  email text,
  home_zip text,
  service_areas jsonb not null default '[]'::jsonb,
  availability jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  booking_number text,
  chef_profile_id uuid references public.profiles(id) on delete set null,
  chef_name text,
  status text not null default 'assigned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  booking_number text,
  customer_email text,
  customer_phone text,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_number text,
  customer_email text,
  customer_phone text,
  requested_date date,
  requested_time time,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_highlights (
  id uuid primary key default gen_random_uuid(),
  guest_name text,
  body text not null,
  rating integer check (rating between 1 and 5),
  source text default 'website',
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chefs_profile_idx on public.chefs (profile_id);
create index assignments_booking_number_idx on public.assignments (booking_number);
create index assignments_chef_profile_idx on public.assignments (chef_profile_id);
create index cancellation_booking_number_idx on public.cancellation_requests (booking_number);
create index reschedule_booking_number_idx on public.reschedule_requests (booking_number);
create index review_highlights_published_idx on public.review_highlights (published, sort_order);

create trigger chefs_set_updated_at before update on public.chefs for each row execute function public.set_updated_at();
create trigger assignments_set_updated_at before update on public.assignments for each row execute function public.set_updated_at();
create trigger cancellation_requests_set_updated_at before update on public.cancellation_requests for each row execute function public.set_updated_at();
create trigger reschedule_requests_set_updated_at before update on public.reschedule_requests for each row execute function public.set_updated_at();
create trigger review_highlights_set_updated_at before update on public.review_highlights for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Seed default global settings. Existing keys are not overwritten.
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, public_read) values
('pricing_settings_v140', '{
  "packages":{"Classic":55,"Premium":65,"Signature":110},
  "packageProteinPortions":{"Classic":2,"Premium":3,"Signature":4},
  "proteinUpcharge":5,
  "premiumProteins":["Scallop","Lobster","Filet Mignon"],
  "addonsOverride":true,
  "addons":{"Sushi Roll Tray":85,"Premium Sushi Tray":130,"Sushi & Sashimi Combo":160,"Extra Gyoza Tray":45,"Extra Edamame Tray":35,"Noodle / Yakisoba Tray":50},
  "moneyRules":{"depositRequired":200,"memberCreditBuy":1000,"memberCreditBonus":100,"firstPartyCoupon":50,"birthdayCoupon":50,"socialCoupon":50,"couponMinimumParty":600,"chefAdultRate":15,"chefKidRate":7.5,"chefMinimumPayout":150,"minimumBillableGuests":10,"estimatedFoodCostRate":35,"defaultTravelFee":50,"salesTaxRate":8.875}
}'::jsonb, true),
('addon_catalog_v141', '[
  {"id":"addon-sushi-roll","name":"Sushi Roll Tray","price":85,"tag":"Popular","image":"assets/addon-sushi.webp","note":"California roll, spicy tuna, shrimp tempura, vegetable roll. Approx. 6-8 rolls / 48 pcs.","bookingNote":"California, spicy tuna, shrimp tempura, vegetable roll. Approx. 6-8 rolls.","published":true},
  {"id":"addon-premium-sushi","name":"Premium Sushi Tray","price":130,"tag":"Premium","image":"assets/addon-premium-sushi.webp","note":"Assorted hand-pressed sushi only: tuna, salmon, yellowtail, shrimp, eel, and chef-selected nigiri. No rolls, no sashimi. Approx. 32-40 pcs.","bookingNote":"Assorted hand-pressed sushi only. No rolls, no sashimi. Approx. 32-40 pieces / 4-6 people.","published":true},
  {"id":"addon-sashimi-combo","name":"Sushi & Sashimi Combo","price":160,"tag":"","image":"assets/addon-sashimi.webp","note":"Assorted sushi plus sashimi. Approx. 4-6 people / 32-40 pieces. Fish depends on availability.","bookingNote":"Assorted sushi plus sashimi. Approx. 4-6 people / 32-40 pieces. Fish depends on availability.","published":true},
  {"id":"addon-gyoza","name":"Extra Gyoza Tray","price":45,"tag":"","image":"assets/addon-gyoza.webp","note":"Pan-fried dumplings, approx. 24 pcs. Serves 6-8 people. Dipping sauce included.","bookingNote":"Pan-fried dumplings, approx. 24 pcs. Serves 6-8 people. Garlic ponzu available.","published":true},
  {"id":"addon-edamame","name":"Extra Edamame Tray","price":35,"tag":"","image":"assets/addon-edamame.webp","note":"Steamed edamame tray. Serves approx. 8-10 people. Garlic-style option can be requested.","bookingNote":"Steamed edamame tray. Serves approx. 8-10 people. Garlic-style option available.","published":true},
  {"id":"addon-noodle","name":"Noodle / Yakisoba Tray","price":50,"tag":"Kids Fav","image":"assets/addon-noodle.webp","note":"Stir-fried noodles with vegetables. Serves approx. 6-8 people as a side.","bookingNote":"Stir-fried noodles with vegetables. Serves approx. 6-8 people as a side.","published":true}
]'::jsonb, true),
('social_links_v146', '[
  {"id":"social-google","platform":"Google","label":"Leave a Google review","url":"#reviews","qr":"","note":"Review link placeholder. Replace with your real Google Business Profile review URL.","published":true},
  {"id":"social-instagram","platform":"Instagram","label":"Follow on Instagram","url":"https://www.instagram.com/","qr":"","note":"Add your official Instagram profile link.","published":true},
  {"id":"social-tiktok","platform":"TikTok","label":"Watch us on TikTok","url":"https://www.tiktok.com/","qr":"","note":"Add your official TikTok profile link.","published":true},
  {"id":"social-facebook","platform":"Facebook","label":"Follow on Facebook","url":"https://www.facebook.com/","qr":"","note":"Add your official Facebook page link.","published":true}
]'::jsonb, true),
('recipes_v140', '[
  {"id":"recipe-yum-yum","title":"Yum Yum Sauce for Hibachi Night","category":"Sauce","image":"assets/package-premium.webp","summary":"A creamy, sweet, tangy sauce inspired by backyard hibachi parties.","body":"Mix mayonnaise, ketchup, melted butter, garlic powder, paprika, sugar, and rice vinegar. Rest cold for 30 minutes before serving.","published":true},
  {"id":"recipe-teriyaki","title":"Glossy Teriyaki Sauce","category":"Sauce","image":"assets/media-fire-show.webp","summary":"Sweet, savory, glossy teriyaki for chicken, steak, salmon, or fried rice.","body":"Simmer soy sauce, mirin, sugar, garlic, ginger, and a little cornstarch slurry until glossy.","published":true}
]'::jsonb, true),
('stories_v140', '[
  {"id":"story-behind-fire","title":"Behind the Fire","category":"Chef Story","image":"assets/media-knife-rhythm.webp","summary":"The clean two-hour show starts long before the chef arrives.","body":"Knife rhythm, timing, clean prep, packing, and route planning are all part of the private hibachi experience.","published":true},
  {"id":"story-rain","title":"Rain Day Party Planning","category":"Party Tips","image":"assets/occasion-backyard.webp","summary":"A safe covered cooking area keeps the party moving.","body":"Weather changes fast. Customers should prepare a safe covered cooking area when rain is possible.","published":true}
]'::jsonb, true),
('shop_products_v140', '[
  {"id":"shop-gift-card","title":"Phoenix Hibachi Gift Card","price":100,"image":"assets/phoenix-logo-transparent.png","link":"#calendar","status":"Available","summary":"A flexible gift toward a future private hibachi party.","published":true},
  {"id":"shop-merch","title":"Phoenix Hibachi Merch","price":25,"image":"assets/phoenix-logo-transparent.png","link":"#shop","status":"Coming soon","summary":"T-shirts, hats, aprons, and chef-themed merchandise.","published":true}
]'::jsonb, true),
('hero_media_v140', '{}'::jsonb, true),
('contact_settings', '{"business_name":"Phoenix Hibachi","business_phone":"347-471-9190","text_phone":"347-471-9190","booking_email":"booking@phoenixhibachi.com","support_email":"support@phoenixhibachi.com","service_area_text":"NY, NJ, CT, Long Island","cancellation_policy_title":"48-Hour Policy","cancellation_policy_text":"Deposits are non-refundable inside 48 hours. Reschedule requests are subject to availability."}'::jsonb, true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Storage buckets. This does NOT delete any files.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('public-images', 'public-images', true),
  ('chef-application-files', 'chef-application-files', false),
  ('order-pdfs', 'order-pdfs', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.chef_applications enable row level security;
alter table public.app_settings enable row level security;
alter table public.guest_reviews enable row level security;
alter table public.chefs enable row level security;
alter table public.assignments enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.reschedule_requests enable row level security;
alter table public.review_highlights enable row level security;

-- profiles policies
create policy "profiles read own or staff" on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_user_is_staff());
create policy "profiles insert own or staff" on public.profiles
for insert to authenticated
with check (id = auth.uid() or public.current_user_is_staff());
create policy "profiles update own or staff" on public.profiles
for update to authenticated
using (id = auth.uid() or public.current_user_is_staff())
with check (id = auth.uid() or public.current_user_is_staff());

-- bookings policies
create policy "public can create bookings" on public.bookings
for insert to anon, authenticated
with check (true);
create policy "staff can read all bookings" on public.bookings
for select to authenticated
using (public.current_user_is_staff());
create policy "staff can update bookings" on public.bookings
for update to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());
create policy "staff can delete bookings" on public.bookings
for delete to authenticated
using (public.current_user_is_staff());
create policy "chef can read assigned bookings" on public.bookings
for select to authenticated
using (assigned_chef_id = auth.uid());
create policy "member can read own bookings" on public.bookings
for select to authenticated
using (lower(customer_email) = lower(coalesce(auth.jwt()->>'email','')));

-- chef applications policies
create policy "public can submit chef applications" on public.chef_applications
for insert to anon, authenticated
with check (true);
create policy "staff can read chef applications" on public.chef_applications
for select to authenticated
using (public.current_user_is_staff());
create policy "staff can update chef applications" on public.chef_applications
for update to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());
create policy "staff can delete chef applications" on public.chef_applications
for delete to authenticated
using (public.current_user_is_staff());
create policy "chef applicant can read own application" on public.chef_applications
for select to authenticated
using (lower(email) = lower(coalesce(auth.jwt()->>'email','')) or user_id = auth.uid());

-- app settings policies
create policy "public can read public app settings" on public.app_settings
for select to anon, authenticated
using (public_read = true);
create policy "staff can manage app settings" on public.app_settings
for all to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());

-- guest review policies
create policy "public can submit reviews" on public.guest_reviews
for insert to anon, authenticated
with check (status = 'pending' and published = false);
create policy "public can read published reviews" on public.guest_reviews
for select to anon, authenticated
using (published = true and status = 'approved');
create policy "staff can manage reviews" on public.guest_reviews
for all to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());

-- operational tables policies
create policy "staff can manage chefs" on public.chefs
for all to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());
create policy "chef can read own chef profile" on public.chefs
for select to authenticated
using (profile_id = auth.uid());

create policy "staff can manage assignments" on public.assignments
for all to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());
create policy "chef can read own assignments" on public.assignments
for select to authenticated
using (chef_profile_id = auth.uid());

create policy "public can create cancellation requests" on public.cancellation_requests
for insert to anon, authenticated
with check (true);
create policy "staff can manage cancellation requests" on public.cancellation_requests
for all to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());

create policy "public can create reschedule requests" on public.reschedule_requests
for insert to anon, authenticated
with check (true);
create policy "staff can manage reschedule requests" on public.reschedule_requests
for all to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());

create policy "public can read published review highlights" on public.review_highlights
for select to anon, authenticated
using (published = true);
create policy "staff can manage review highlights" on public.review_highlights
for all to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());

-- storage policies
create policy "public read public images" on storage.objects
for select to anon, authenticated
using (bucket_id = 'public-images');
create policy "staff upload public images" on storage.objects
for insert to authenticated
with check (bucket_id = 'public-images' and public.current_user_is_staff());
create policy "staff update public images" on storage.objects
for update to authenticated
using (bucket_id = 'public-images' and public.current_user_is_staff())
with check (bucket_id = 'public-images' and public.current_user_is_staff());
create policy "staff delete public images" on storage.objects
for delete to authenticated
using (bucket_id = 'public-images' and public.current_user_is_staff());

create policy "public submit chef application files" on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'chef-application-files');
create policy "staff read chef application files" on storage.objects
for select to authenticated
using (bucket_id = 'chef-application-files' and public.current_user_is_staff());

create policy "staff read order pdfs" on storage.objects
for select to authenticated
using (bucket_id = 'order-pdfs' and public.current_user_is_staff());
create policy "staff upload order pdfs" on storage.objects
for insert to authenticated
with check (bucket_id = 'order-pdfs' and public.current_user_is_staff());
create policy "staff update order pdfs" on storage.objects
for update to authenticated
using (bucket_id = 'order-pdfs' and public.current_user_is_staff())
with check (bucket_id = 'order-pdfs' and public.current_user_is_staff());

-- -----------------------------------------------------------------------------
-- Grants: required when new-table auto exposure is disabled.
-- RLS still controls what each role can actually access.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.current_user_is_staff() to anon, authenticated;

grant select on public.app_settings to anon, authenticated;
grant select, insert on public.guest_reviews to anon, authenticated;
grant insert on public.bookings to anon, authenticated;
grant insert on public.chef_applications to anon, authenticated;
grant insert on public.cancellation_requests to anon, authenticated;
grant insert on public.reschedule_requests to anon, authenticated;
grant select on public.review_highlights to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.chef_applications to authenticated;
grant select, insert, update, delete on public.guest_reviews to authenticated;
grant select, insert, update, delete on public.chefs to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.cancellation_requests to authenticated;
grant select, insert, update, delete on public.reschedule_requests to authenticated;
grant select, insert, update, delete on public.review_highlights to authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

commit;

-- NEXT STEP AFTER THIS INSTALL SUCCEEDS:
-- 1) Authentication > Users > Add user
--    Email: fenix2526050@gmail.com
--    Password: your new admin password
--    Auto Confirm / Confirm email: ON
-- 2) Then run this admin binding SQL separately:
--
-- insert into public.profiles (id, email, full_name, role, account_status)
-- select id, email, 'Fenix Lin', 'admin', 'active'
-- from auth.users
-- where lower(email)=lower('fenix2526050@gmail.com')
-- on conflict (id) do update set
--   email = excluded.email,
--   full_name = 'Fenix Lin',
--   role = 'admin',
--   account_status = 'active',
--   updated_at = now();
