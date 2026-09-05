-- 0003: analytics views
--
-- Aggregation lives in SQL so it is fast and directly testable, rather than being
-- reassembled in TypeScript across several round trips.
--
-- All views exclude bot traffic (is_bot = false). Raw counts including bots remain
-- available by querying qr_scan_events directly on the scans page.

-- Per-assignment rollup.
create or replace view v_assignment_performance as
select
  a.id                as assignment_id,
  a.title,
  a.reference_code,
  a.location_name,
  a.location_type,
  a.city,
  a.area,
  a.status,
  a.campaign_start_date,
  a.campaign_end_date,
  a.created_at,
  a.team_member_id,
  tm.full_name        as team_member_name,
  count(se.id)                                                          as total_scans,
  count(se.id) filter (where se.platform = 'ios')                       as ios_scans,
  count(se.id) filter (where se.platform = 'android')                   as android_scans,
  count(se.id) filter (where se.scanned_at >= now() - interval '7 days') as scans_last_7d,
  max(se.scanned_at)                                                    as last_scan_at
from qr_assignments a
join team_members tm on tm.id = a.team_member_id
left join qr_scan_events se
  on se.assignment_id = a.id and se.is_bot = false
group by a.id, tm.full_name;

-- Per-team-member rollup.
create or replace view v_team_member_performance as
select
  tm.id               as team_member_id,
  tm.full_name,
  tm.phone,
  tm.email,
  tm.city,
  tm.region,
  tm.status,
  tm.created_at,
  count(distinct a.id)                                                   as total_assignments,
  count(distinct a.id) filter (where a.status = 'active')                as active_assignments,
  count(se.id)                                                           as total_scans,
  count(se.id) filter (where se.platform = 'ios')                        as ios_scans,
  count(se.id) filter (where se.platform = 'android')                    as android_scans,
  count(se.id) filter (where se.scanned_at >= now() - interval '7 days')  as scans_last_7d,
  max(se.scanned_at)                                                     as last_scan_at
from team_members tm
left join qr_assignments a on a.team_member_id = tm.id
left join qr_scan_events se
  on se.team_member_id = tm.id and se.is_bot = false
group by tm.id;

-- Single-row dashboard headline numbers.
create or replace view v_dashboard_totals as
select
  (select count(*) from team_members where status = 'active')            as active_team_members,
  (select count(*) from team_members)                                    as total_team_members,
  (select count(*) from qr_assignments)                                  as total_assignments,
  (select count(*) from qr_assignments where status = 'active')          as active_assignments,
  (select count(*) from qr_scan_events where is_bot = false)             as total_scans,
  (select count(*) from qr_scan_events where is_bot = false and platform = 'ios')     as ios_scans,
  (select count(*) from qr_scan_events where is_bot = false and platform = 'android') as android_scans,
  (select count(*) from qr_scan_events
     where is_bot = false and scanned_at >= now() - interval '7 days')   as scans_last_7d,
  (select count(*) from qr_scan_events
     where is_bot = false and scanned_at >= current_date)                as scans_today,
  (select count(*) from generated_standees)                              as total_standees;

-- Views run as their owner by default. Pin them to the querying user's privileges so
-- RLS on the underlying tables still applies.
alter view v_assignment_performance  set (security_invoker = on);
alter view v_team_member_performance set (security_invoker = on);
alter view v_dashboard_totals        set (security_invoker = on);
