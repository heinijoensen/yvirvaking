-- ============================================================
-- Yvirvaking — RLS Security Patch
-- Run this in Supabase SQL Editor AFTER the main SCHEMA.sql
--
-- Fixes two gaps identified in the security audit:
--   1. Installers could not INSERT new work orders
--      (ServiceWizard submit and CSV import both need this)
--   2. Installers could not INSERT new pumps
--      (CSV import of new customers/installations needs this)
-- ============================================================

-- ── Work orders: allow installers to create new orders ──────

drop policy if exists "work_orders: installer insert" on public.work_orders;
create policy "work_orders: installer insert"
  on public.work_orders for insert
  with check (public.current_user_role() in ('admin', 'installer'));

-- ── Pumps: allow installers to register new installations ───

drop policy if exists "pumps: installer insert" on public.pumps;
create policy "pumps: installer insert"
  on public.pumps for insert
  with check (public.current_user_role() in ('admin', 'installer'));

-- ── Work orders: let customers see their own pump's history ─
-- (optional — uncomment if you want customers to track jobs)

-- drop policy if exists "work_orders: customer own pump" on public.work_orders;
-- create policy "work_orders: customer own pump"
--   on public.work_orders for select
--   using (
--     public.current_user_role() = 'customer'
--     and pump_id = public.current_user_pump_id()
--   );

-- ── Verify policies are in place ────────────────────────────
-- Run this SELECT to confirm (should return 9+ rows):
--
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
