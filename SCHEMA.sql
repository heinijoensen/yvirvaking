-- ============================================================
-- Yvirvaking — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. PROFILES
-- ──────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text,
  role            text not null default 'customer'
                    check (role in ('admin', 'installer', 'customer')),
  pump_id         text,        -- for customers: which pump they own
  installer_id    uuid,        -- for installers: link to another profile (optional)
  created_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ──────────────────────────────────────────────────────────
-- 2. PUMPS
-- ──────────────────────────────────────────────────────────
create table if not exists public.pumps (
  id                  text primary key,
  customer            text,
  phone               text,
  email               text,
  address             text,
  region              text,
  lat                 double precision,
  lng                 double precision,
  model               text,
  installed           text,
  status              text default 'ok'
                        check (status in ('ok', 'warning', 'fault')),
  cop                 double precision default 0,
  temp_indoor         double precision,
  temp_outdoor        double precision,
  energy_today        double precision default 0,
  last_seen           text,
  alerts              jsonb default '[]'::jsonb,
  myuplink_device_id  text,
  created_at          timestamptz not null default now()
);

alter table public.pumps enable row level security;

-- ──────────────────────────────────────────────────────────
-- 3. WORK ORDERS
-- ──────────────────────────────────────────────────────────
create table if not exists public.work_orders (
  id          text primary key,
  pump_id     text references public.pumps(id) on delete set null,
  customer    text,
  type        text,
  status      text default 'open'
                check (status in ('open', 'in_progress', 'scheduled', 'completed')),
  priority    text default 'medium'
                check (priority in ('high', 'medium', 'low')),
  description text,
  assigned    text,
  due         date,
  created_at  timestamptz not null default now()
);

alter table public.work_orders enable row level security;

-- ──────────────────────────────────────────────────────────
-- 4. AUTO-CREATE PROFILE TRIGGER
-- ──────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────────────────
-- 5. RLS POLICIES
-- ──────────────────────────────────────────────────────────

-- Helper: get current user's role
create or replace function public.current_user_role()
returns text
language sql stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: get current user's pump_id
create or replace function public.current_user_pump_id()
returns text
language sql stable
security definer set search_path = public
as $$
  select pump_id from public.profiles where id = auth.uid();
$$;

-- -- PROFILES policies --

-- Users can read their own profile
drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row"
  on public.profiles for select
  using (id = auth.uid());

-- Admins can read all profiles
drop policy if exists "profiles: admin read all" on public.profiles;
create policy "profiles: admin read all"
  on public.profiles for select
  using (public.current_user_role() = 'admin');

-- Admins can update all profiles
drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all"
  on public.profiles for update
  using (public.current_user_role() = 'admin');

-- Users can update their own profile
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update"
  on public.profiles for update
  using (id = auth.uid());

-- -- PUMPS policies --

-- Admins see all pumps
drop policy if exists "pumps: admin all" on public.pumps;
create policy "pumps: admin all"
  on public.pumps for all
  using (public.current_user_role() = 'admin');

-- Installers can read all pumps
drop policy if exists "pumps: installer read" on public.pumps;
create policy "pumps: installer read"
  on public.pumps for select
  using (public.current_user_role() = 'installer');

-- Installers can update pumps (field updates)
drop policy if exists "pumps: installer update" on public.pumps;
create policy "pumps: installer update"
  on public.pumps for update
  using (public.current_user_role() = 'installer');

-- Customers can only see their own pump
drop policy if exists "pumps: customer own" on public.pumps;
create policy "pumps: customer own"
  on public.pumps for select
  using (
    public.current_user_role() = 'customer'
    and id = public.current_user_pump_id()
  );

-- -- WORK ORDERS policies --

-- Admins see all work orders
drop policy if exists "work_orders: admin all" on public.work_orders;
create policy "work_orders: admin all"
  on public.work_orders for all
  using (public.current_user_role() = 'admin');

-- Installers can read all work orders
drop policy if exists "work_orders: installer read" on public.work_orders;
create policy "work_orders: installer read"
  on public.work_orders for select
  using (public.current_user_role() = 'installer');

-- Installers can update work orders (status updates, notes)
drop policy if exists "work_orders: installer update" on public.work_orders;
create policy "work_orders: installer update"
  on public.work_orders for update
  using (public.current_user_role() = 'installer');

-- Customers cannot access work orders directly

-- ──────────────────────────────────────────────────────────
-- 6. SEED DATA — PUMPS (15 pumps from shared-data.js)
-- ──────────────────────────────────────────────────────────
insert into public.pumps
  (id, customer, phone, email, address, region, lat, lng, model, installed, status, cop, temp_indoor, temp_outdoor, energy_today, last_seen, alerts, myuplink_device_id)
values
  ('P001', 'Jón Petersen',      '+298 211 401', 'jon.petersen@gmail.com',      'Áarvegur 12, Tórshavn',        'Streymoy', 62.008, -6.790, 'CTC GSi 612',     '2023-03-14', 'ok',      3.8, 21.2, 7.1, 12.4, '2 min ago',  '[]',                                                                                   'ET731020421655'),
  ('P002', 'Ragnheiður Holm',   '+298 211 402', 'ragnheidur@holm.fo',           'Fjalsgøta 5, Tórshavn',        'Streymoy', 62.015, -6.765, 'CTC EcoAir 520',  '2022-11-02', 'ok',      3.5, 20.8, 7.1,  9.8, '5 min ago',  '[]',                                                                                   null),
  ('P003', 'Bjarni Jacobsen',   '+298 211 403', 'bjarni.jacobsen@olivant.fo',   'Kirkjubøvegur 3, Velbastaður', 'Streymoy', 61.972, -6.842, 'CTC EcoHeat 400', '2021-06-22', 'warning', 2.1, 18.4, 6.8, 18.7, '12 min ago', '["Low COP detected","Filter inspection due"]',                                        null),
  ('P004', 'Marin Olsen',       '+298 211 404', 'marin.olsen@gmail.com',        'Breiðablik 8, Hoyvík',         'Streymoy', 62.023, -6.748, 'CTC EcoAir 620',  '2024-01-10', 'ok',      4.1, 22.0, 7.2,  8.1, '1 min ago',  '[]',                                                                                   null),
  ('P005', 'Súsanna Dahl',      '+298 211 405', 'susanna.dahl@gmail.com',       'Niðasta bygd 2, Kirkjubøur',   'Streymoy', 61.960, -6.878, 'CTC EcoHeat 400', '2020-09-05', 'fault',   0.0, 14.1, 6.5, 31.2, '4 hrs ago',  '["FAULT: Compressor error E47","No hot water since 09:14"]',                          null),
  ('P006', 'Heðin Magnusson',   '+298 211 406', 'hedin@magnusson.fo',           'Undir Hálsi 7, Klaksvík',      'Norðoyar', 62.229, -6.587, 'CTC EcoAir 520',  '2022-04-18', 'ok',      3.9, 21.5, 5.9, 11.2, '3 min ago',  '[]',                                                                                   null),
  ('P007', 'Tóra Hansen',       '+298 211 407', 'tora.hansen@olivant.fo',       'Klaksvíksvegur 14, Klaksvík',  'Norðoyar', 62.235, -6.578, 'CTC EcoHeat 600', '2021-12-01', 'warning', 2.4, 19.1, 5.9, 22.1, '18 min ago', '["High energy consumption"]',                                                         null),
  ('P008', 'Andrias Patursson', '+298 211 408', 'andrias.p@gmail.com',          'Yviri við Strond 1, Eiði',     'Eysturoy', 62.301, -7.093, 'CTC EcoAir 620',  '2023-07-30', 'ok',      3.7, 20.9, 6.2, 10.5, '6 min ago',  '[]',                                                                                   null),
  ('P009', 'Fríða Niclasen',    '+298 211 409', 'frida.niclasen@gmail.com',     'Gøtugøta 4, Runavík',          'Eysturoy', 62.149, -6.717, 'CTC EcoHeat 400', '2019-08-11', 'fault',   0.0, 12.8, 6.4,  0.0, '6 hrs ago',  '["FAULT: Communication lost","MyUplink offline"]',                                    null),
  ('P010', 'Dávur Joensen',     '+298 211 410', 'davur.joensen@olivant.fo',     'Niðari bygd 9, Sandur',        'Sandoy',   61.832, -6.818, 'CTC EcoAir 520',  '2023-02-14', 'ok',      3.6, 21.8, 7.8,  9.3, '4 min ago',  '[]',                                                                                   null),
  ('P011', 'Rúni Sørensen',     '+298 211 411', 'runi.sorensen@gmail.com',      'Uppistova 3, Vágur',           'Suðuroy',  61.471, -6.808, 'CTC EcoHeat 400', '2022-08-25', 'ok',      3.4, 20.4, 8.1, 13.1, '7 min ago',  '[]',                                                                                   null),
  ('P012', 'Malan Danielsen',   '+298 211 412', 'malan.danielsen@olivant.fo',   'Sandvíksvegur 6, Tvøroyri',    'Suðuroy',  61.557, -6.801, 'CTC EcoHeat 600', '2021-03-09', 'warning', 2.7, 18.8, 8.1, 19.8, '31 min ago', '["Annual service overdue (14 months)"]',                                              null),
  ('P013', 'Eyðun Reinert',     '+298 211 413', 'eydun.reinert@gmail.com',      'Á Hvammi 11, Sørvágur',        'Vágar',    62.071, -7.305, 'CTC EcoAir 620',  '2024-04-01', 'ok',      4.0, 21.3, 7.4,  8.8, '2 min ago',  '[]',                                                                                   null),
  ('P014', 'Anni Mortensen',    '+298 211 414', 'anni.mortensen@olivant.fo',    'Glyvursvegur 2, Glyvrar',      'Eysturoy', 62.172, -6.814, 'CTC EcoAir 520',  '2023-05-17', 'ok',      3.8, 22.1, 6.5, 10.2, '9 min ago',  '[]',                                                                                   null),
  ('P015', 'Pætur Thomsen',     '+298 211 415', 'paetur.thomsen@gmail.com',     'Miðvágsvegur 4, Miðvágur',     'Vágar',    62.048, -7.209, 'CTC EcoHeat 400', '2020-11-20', 'warning', 2.2, 17.9, 7.3, 24.3, '1 hr ago',   '["Defrost cycle stuck","Low COP trend — 3 days"]',                                    null)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────
-- 7. SEED DATA — WORK ORDERS (6 from shared-data.js)
-- ──────────────────────────────────────────────────────────
insert into public.work_orders
  (id, pump_id, customer, type, status, priority, description, assigned, due, created_at)
values
  ('WO-2024-081', 'P005', 'Súsanna Dahl',    'Emergency',      'open',        'high',   'Compressor fault E47 — no heating/hot water',     'Pauli Rasmussen', '2024-05-04', '2024-05-04 09:22:00+00'),
  ('WO-2024-080', 'P009', 'Fríða Niclasen',  'Emergency',      'open',        'high',   'MyUplink communication lost — unit offline',       'Súni Jacobsen',   '2024-05-04', '2024-05-04 07:55:00+00'),
  ('WO-2024-079', 'P015', 'Pætur Thomsen',   'Maintenance',    'in_progress', 'medium', 'Defrost cycle investigation + COP analysis',       'Pauli Rasmussen', '2024-05-06', '2024-05-03 14:10:00+00'),
  ('WO-2024-078', 'P003', 'Bjarni Jacobsen', 'Maintenance',    'in_progress', 'medium', 'Filter replacement + performance check',           'Súni Jacobsen',   '2024-05-07', '2024-05-02 11:30:00+00'),
  ('WO-2024-077', 'P012', 'Malan Danielsen', 'Annual Service', 'scheduled',   'low',    'Annual service — 14 months overdue',               'Pauli Rasmussen', '2024-05-10', '2024-05-01 09:00:00+00'),
  ('WO-2024-075', 'P006', 'Heðin Magnusson', 'Annual Service', 'completed',   'low',    'Annual service completed successfully',            'Súni Jacobsen',   '2024-04-28', '2024-04-20 10:00:00+00')
on conflict (id) do nothing;
