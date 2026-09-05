-- 0002: Row Level Security
--
-- Model: this is an internal, invite-only admin tool. Public signup is disabled in the
-- Supabase dashboard, so every authenticated user is an admin. If per-user roles are
-- needed later, add an `admin_users` allowlist table and change `authenticated` below
-- to a membership check -- the policy shape stays the same.
--
-- The important asymmetry: qr_scan_events has NO insert policy for any client role.
-- Scan writes happen server-side with the service role key only (which bypasses RLS).
-- A leaked anon key therefore cannot forge or poison scan analytics.

alter table team_members       enable row level security;
alter table qr_assignments     enable row level security;
alter table qr_codes           enable row level security;
alter table qr_scan_events     enable row level security;
alter table generated_standees enable row level security;
alter table attributed_signups enable row level security;

-- --- team_members -----------------------------------------------------------
create policy team_members_admin_all on team_members
  for all to authenticated using (true) with check (true);

-- --- qr_assignments ---------------------------------------------------------
create policy qr_assignments_admin_all on qr_assignments
  for all to authenticated using (true) with check (true);

-- --- qr_codes ---------------------------------------------------------------
create policy qr_codes_admin_all on qr_codes
  for all to authenticated using (true) with check (true);

-- --- qr_scan_events ---------------------------------------------------------
-- Read-only for admins. Deliberately no insert/update/delete policy: writes are
-- server-side (service role) exclusively.
create policy qr_scan_events_admin_read on qr_scan_events
  for select to authenticated using (true);

-- --- generated_standees -----------------------------------------------------
create policy generated_standees_admin_read on generated_standees
  for select to authenticated using (true);
-- Inserts come from the standee generation route (service role), not the browser.

-- --- attributed_signups -----------------------------------------------------
create policy attributed_signups_admin_read on attributed_signups
  for select to authenticated using (true);
