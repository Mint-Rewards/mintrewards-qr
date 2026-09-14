-- 0005: Row Level Security for the Mint Ambassador program
--
-- Same model as 0002_rls.sql: authenticated == admin. The important asymmetry is the
-- same one too -- mint_ambassadors and ambassador_scan_events have NO insert policy
-- for any client role. The public registration form runs its insert through the
-- service role from a server action, exactly like the QR scan redirect does.

alter table ambassador_campaigns   enable row level security;
alter table mint_ambassadors       enable row level security;
alter table ambassador_scan_events enable row level security;

-- --- ambassador_campaigns ----------------------------------------------------
create policy ambassador_campaigns_admin_all on ambassador_campaigns
  for all to authenticated using (true) with check (true);

-- --- mint_ambassadors ---------------------------------------------------------
-- Read-only for admins. Writes are server-side (service role) exclusively, from the
-- public registration action.
create policy mint_ambassadors_admin_read on mint_ambassadors
  for select to authenticated using (true);

-- --- ambassador_scan_events ---------------------------------------------------
create policy ambassador_scan_events_admin_read on ambassador_scan_events
  for select to authenticated using (true);
