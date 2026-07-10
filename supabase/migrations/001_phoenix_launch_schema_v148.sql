-- Phoenix Hibachi V148 Supabase launch schema
-- Paste this entire file into Supabase Dashboard > SQL Editor > New query > Run.
-- It is written to be safe for an existing project: it creates missing tables/columns,
-- drops/recreates known policies, and keeps existing rows.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Profiles / roles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'customer',
  account_status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists role text not null default 'customer',
  add column if not exists account_status text not null default 'active',
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists profiles_role_idx on public.profiles (lower(role));
create index if not exists profiles_email_idx on public.profiles (lower(email));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((select role from public.profiles where id = auth.uid()), 'anonymous'))
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
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_phoenix_profile on auth.users;
create trigger on_auth_user_created_phoenix_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- -----------------------------------------------------------------------------
-- Public booking requests
-- -----------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text unique not null,
  customer_name text not null default 'Guest',
  customer_email text,
  customer_phone text,
  event_date date not null default current_date,
  event_time time not null default '16:00',
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

alter table public.bookings
  add column if not exists booking_number text,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists event_date date,
  add column if not exists event_time time,
  add column if not exists adults integer not null default 0,
  add column if not exists kids integer not null default 0,
  add column if not exists guest_count integer not null default 0,
  add column if not exists package_name text,
  add column if not exists add_ons jsonb not null default '[]'::jsonb,
  add column if not exists address text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists allergies jsonb not null default '[]'::jsonb,
  add column if not exists allergy_notes text,
  add column if not exists rain_plan text,
  add column if not exists parking_notes text,
  add column if not exists delay_policy text,
  add column if not exists customer_late_policy text,
  add column if not exists travel_fee numeric(10,2) not null default 0,
  add column if not exists deposit_amount numeric(10,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists status text not null default 'pending',
  add column if not exists admin_notes text,
  add column if not exists assigned_chef_id uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_chef_name text,
  add column if not exists final_total numeric(10,2),
  add column if not exists paid_amount numeric(10,2) not null default 0,
  add column if not exists balance_due numeric(10,2),
  add column if not exists pdf_url text,
  add column if not exists pdf_path text,
  add column if not exists invoice_pdf_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists bookings_booking_number_uidx on public.bookings (booking_number);
create index if not exists bookings_event_date_idx on public.bookings (event_date);
create index if not exists bookings_customer_email_idx on public.bookings (lower(customer_email));
create index if not exists bookings_customer_phone_idx on public.bookings (customer_phone);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_assigned_chef_id_idx on public.bookings (assigned_chef_id);

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Chef/team applications
-- -----------------------------------------------------------------------------
create table if not exists public.chef_applications (
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

alter table public.chef_applications
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists applicant_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists account_email text,
  add column if not exists home_zip text,
  add column if not exists experience_years text,
  add column if not exists has_transportation boolean default false,
  add column if not exists availability jsonb not null default '[]'::jsonb,
  add column if not exists service_areas jsonb not null default '[]'::jsonb,
  add column if not exists available_days jsonb not null default '[]'::jsonb,
  add column if not exists preferred_order_areas jsonb not null default '[]'::jsonb,
  add column if not exists chef_address_street text,
  add column if not exists chef_address_city text,
  add column if not exists chef_address_state text,
  add column if not exists chef_address_zip text,
  add column if not exists vehicle_type text,
  add column if not exists self_introduction text,
  add column if not exists notes text,
  add column if not exists attachment_files jsonb not null default '[]'::jsonb,
  add column if not exists driver_license_files jsonb not null default '[]'::jsonb,
  add column if not exists performance_video_files jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'new',
  add column if not exists account_status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists chef_applications_email_idx on public.chef_applications (lower(email));
create index if not exists chef_applications_status_idx on public.chef_applications (status, account_status);

drop trigger if exists chef_applications_set_updated_at on public.chef_applications;
create trigger chef_applications_set_updated_at
before update on public.chef_applications
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Global website settings/content from Admin dashboard
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  public_read boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings
  add column if not exists value jsonb not null default '{}'::jsonb,
  add column if not exists public_read boolean not null default true,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists app_settings_public_idx on public.app_settings (public_read, key);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- Public guest reviews/testimonials. Public submissions are held for staff approval.
create table if not exists public.guest_reviews (
  id uuid primary key default gen_random_uuid(),
  guest_name text,
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

drop trigger if exists guest_reviews_set_updated_at on public.guest_reviews;
create trigger guest_reviews_set_updated_at
before update on public.guest_reviews
for each row execute function public.set_updated_at();

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
  {"id":"addon-sushi-roll","name":"Sushi Roll Tray","price":85,"tag":"Popular","image":"assets/addon-sushi.webp","note":"California roll, spicy tuna, shrimp tempura, vegetable roll. Approx. 6–8 rolls / 48 pcs.","bookingNote":"California, spicy tuna, shrimp tempura, vegetable roll. Approx. 6–8 rolls.","published":true},
  {"id":"addon-premium-sushi","name":"Premium Sushi Tray","price":130,"tag":"Premium","image":"assets/addon-premium-sushi.webp","note":"Assorted hand-pressed sushi only: tuna, salmon, yellowtail, shrimp, eel, and chef-selected nigiri. No rolls, no sashimi. Approx. 32–40 pcs.","bookingNote":"Assorted hand-pressed sushi only. No rolls, no sashimi. Approx. 32–40 pieces / 4–6 people.","published":true},
  {"id":"addon-sashimi-combo","name":"Sushi & Sashimi Combo","price":160,"tag":"","image":"assets/addon-sashimi.webp","note":"Assorted sushi plus sashimi. Approx. 4–6 people / 32–40 pieces. Fish depends on availability.","bookingNote":"Assorted sushi plus sashimi. Approx. 4–6 people / 32–40 pieces. Fish depends on availability.","published":true},
  {"id":"addon-gyoza","name":"Extra Gyoza Tray","price":45,"tag":"","image":"assets/addon-gyoza.webp","note":"Pan-fried dumplings, approx. 24 pcs. Serves 6–8 people. Dipping sauce included.","bookingNote":"Pan-fried dumplings, approx. 24 pcs. Serves 6–8 people. Garlic ponzu available.","published":true},
  {"id":"addon-edamame","name":"Extra Edamame Tray","price":35,"tag":"","image":"assets/addon-edamame.webp","note":"Steamed edamame tray. Serves approx. 8–10 people. Garlic-style option can be requested.","bookingNote":"Steamed edamame tray. Serves approx. 8–10 people. Garlic-style option available.","published":true},
  {"id":"addon-noodle","name":"Noodle / Yakisoba Tray","price":50,"tag":"Kids Fav","image":"assets/addon-noodle.webp","note":"Stir-fried noodles with vegetables. Serves approx. 6–8 people as a side.","bookingNote":"Stir-fried noodles with vegetables. Serves approx. 6–8 people as a side.","published":true}
]'::jsonb, true),
('social_links_v146', '[
  {"id":"social-google","platform":"Google","label":"Leave a Google review","url":"#reviews","qr":"","note":"Review link placeholder. Replace with your real Google Business Profile review URL.","published":true},
  {"id":"social-instagram","platform":"Instagram","label":"Follow on Instagram","url":"https://www.instagram.com/","qr":"","note":"Add your official Instagram profile link.","published":true},
  {"id":"social-tiktok","platform":"TikTok","label":"Watch us on TikTok","url":"https://www.tiktok.com/","qr":"","note":"Add your official TikTok profile link.","published":true},
  {"id":"social-facebook","platform":"Facebook","label":"Follow on Facebook","url":"https://www.facebook.com/","qr":"","note":"Add your official Facebook page link.","published":true}
]'::jsonb, true),
('recipes_v140', '[
  {"id":"recipe-yum-yum","title":"Yum Yum Sauce for Hibachi Night","category":"Sauce","image":"assets/package-premium.webp","summary":"A creamy, sweet, tangy sauce inspired by backyard hibachi parties.","body":"Mix mayonnaise, ketchup, melted butter, garlic powder, paprika, sugar, and rice vinegar. Rest cold for 30 minutes before serving.","published":true},
  {"id":"recipe-teriyaki","title":"Glossy Teriyaki Sauce","category":"Sauce","image":"assets/media-fire-show.webp","summary":"Sweet, savory, glossy teriyaki for chicken, steak, salmon, or fried rice.","body":"Simmer soy sauce, mirin, sugar, garlic, ginger, and a little cornstarch slurry until glossy.","published":true},
  {"id":"recipe-steak","title":"Steak Doneness Guide","category":"Technique","image":"assets/package-signature.webp","summary":"Rare, medium rare, medium, and well-done explained in plain English.","body":"Let steak rest before cooking, sear hot, and slice after resting. Guests should tell the chef their doneness preference before the show starts.","published":true}
]'::jsonb, true),
('stories_v140', '[
  {"id":"story-behind-fire","title":"Behind the Fire","category":"Chef Story","image":"assets/media-knife-rhythm.webp","summary":"The clean two-hour show starts long before the chef arrives.","body":"Knife rhythm, timing, clean prep, packing, and route planning are all part of the private hibachi experience.","published":true},
  {"id":"story-prep","title":"Why Prep Work Matters","category":"Operations","image":"assets/visual-hero-live-show.webp","summary":"Every onion volcano depends on quiet prep work.","body":"A smooth party depends on packed sauces, proteins, vegetables, rice, equipment, timing, and rain backup before the chef leaves.","published":true},
  {"id":"story-rain","title":"Rain Day Party Planning","category":"Party Tips","image":"assets/occasion-backyard.webp","summary":"A safe covered cooking area keeps the party moving.","body":"Weather changes fast. Customers should prepare a safe covered area or contact Customer Service for route and reschedule review.","published":true}
]'::jsonb, true),
('shop_products_v140', '[
  {"id":"shop-gift-card","title":"Phoenix Hibachi Gift Card","price":100,"image":"assets/phoenix-logo-transparent.png","link":"#calendar","status":"Available","summary":"A flexible gift toward a future private hibachi party.","published":true},
  {"id":"shop-sauce-kit","title":"Sauce Bottle / Party Kit","price":18,"image":"assets/addon-edamame.webp","link":"#shop","status":"Coming soon","summary":"Feature sauces, bottles, or party tools here when your ecommerce link is ready.","published":true},
  {"id":"shop-shirt","title":"Phoenix Hibachi Merch","price":25,"image":"assets/phoenix-logo-transparent.png","link":"#shop","status":"Coming soon","summary":"T-shirts, hats, aprons, and chef-themed merchandise.","published":true}
]'::jsonb, true),
('hero_media_v140', '{}'::jsonb, true),
('contact_settings', '{"business_name":"Phoenix Hibachi","business_phone":"(516) 518-3325","text_phone":"(516) 518-3325","booking_email":"booking@phoenix-hibachi.com","support_email":"support@phoenix-hibachi.com","service_area_text":"NY, NJ, CT, Long Island","cancellation_policy_title":"48-Hour Policy","cancellation_policy_text":"Deposits are applied toward your final balance. Cancellations within 72 hours of the event may be non-refundable. Rescheduling is subject to availability and must be confirmed by Phoenix Hibachi."}'::jsonb, true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Storage buckets
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

-- profiles policies
drop policy if exists "profiles read own or staff" on public.profiles;
drop policy if exists "profiles update own or staff" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles read own or staff" on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_user_is_staff());
create policy "profiles update own or staff" on public.profiles
for update to authenticated
using (id = auth.uid() or public.current_user_is_staff())
with check (id = auth.uid() or public.current_user_is_staff());
create policy "profiles insert own" on public.profiles
for insert to authenticated
with check (id = auth.uid() or public.current_user_is_staff());

-- bookings policies
drop policy if exists "public can create bookings" on public.bookings;
drop policy if exists "staff can read all bookings" on public.bookings;
drop policy if exists "staff can update bookings" on public.bookings;
drop policy if exists "staff can delete bookings" on public.bookings;
drop policy if exists "chef can read assigned bookings" on public.bookings;
drop policy if exists "member can read own bookings" on public.bookings;
-- old policy names used by earlier Phoenix builds
drop policy if exists "admin manager can read all bookings" on public.bookings;
drop policy if exists "admin manager can update all bookings" on public.bookings;
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
drop policy if exists "public can submit chef applications" on public.chef_applications;
drop policy if exists "staff can read chef applications" on public.chef_applications;
drop policy if exists "staff can update chef applications" on public.chef_applications;
drop policy if exists "staff can delete chef applications" on public.chef_applications;
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

-- app settings policies
drop policy if exists "public can read public app settings" on public.app_settings;
drop policy if exists "staff can manage app settings" on public.app_settings;
create policy "public can read public app settings" on public.app_settings
for select to anon, authenticated
using (public_read = true and key in (
  'pricing_settings_v140','addon_catalog_v141','recipes_v140','stories_v140','shop_products_v140','hero_media_v140','social_links_v146','contact_settings'
));
create policy "staff can manage app settings" on public.app_settings
for all to authenticated
using (public.current_user_is_staff())
with check (public.current_user_is_staff());

-- guest review policies
drop policy if exists "public can submit reviews" on public.guest_reviews;
drop policy if exists "public can read published reviews" on public.guest_reviews;
drop policy if exists "staff can manage reviews" on public.guest_reviews;
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

-- storage policies
drop policy if exists "public read public images" on storage.objects;
drop policy if exists "staff upload public images" on storage.objects;
drop policy if exists "staff update public images" on storage.objects;
drop policy if exists "staff delete public images" on storage.objects;
drop policy if exists "public submit chef application files" on storage.objects;
drop policy if exists "staff read chef application files" on storage.objects;
drop policy if exists "staff read order pdfs" on storage.objects;
drop policy if exists "staff upload order pdfs" on storage.objects;
drop policy if exists "staff update order pdfs" on storage.objects;

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

commit;

-- IMPORTANT AFTER RUNNING:
-- 1) Create your Admin user in Supabase Authentication.
-- 2) Run this line after replacing YOUR-ADMIN-EMAIL:
-- update public.profiles set role='admin', account_status='active' where lower(email)=lower('YOUR-ADMIN-EMAIL');
-- 3) Never put the service_role / secret key in the website frontend.
