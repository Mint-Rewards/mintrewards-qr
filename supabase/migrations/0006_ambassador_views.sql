-- 0006: Mint Ambassador analytics views
--
-- Same reasoning as 0003_views.sql: aggregation lives in SQL, views run as the
-- querying user (security_invoker) so RLS on the underlying tables still applies.

create or replace view v_ambassador_campaign_performance as
select
  c.id                as campaign_id,
  c.title,
  c.reference_code,
  c.event_name,
  c.event_date,
  c.location_name,
  c.city,
  c.status,
  c.created_at,
  count(distinct v.id)                                                    as total_views,
  count(distinct m.id)                                                    as total_registrations,
  count(distinct m.id) filter (where m.ambassador_status = 'student')     as student_count,
  count(distinct m.id) filter (where m.ambassador_status = 'alumnus')     as alumnus_count,
  case when count(distinct v.id) = 0 then null
       else round(count(distinct m.id)::numeric / count(distinct v.id) * 100, 1)
  end                                                                     as conversion_pct,
  max(m.created_at)                                                       as last_registration_at
from ambassador_campaigns c
left join ambassador_scan_events v on v.campaign_id = c.id and v.is_bot = false
left join mint_ambassadors m       on m.campaign_id = c.id
group by c.id;

create or replace view v_ambassador_dashboard_totals as
select
  (select count(*) from ambassador_campaigns)                                       as total_campaigns,
  (select count(*) from ambassador_campaigns where status = 'active')               as active_campaigns,
  (select count(*) from mint_ambassadors)                                           as total_ambassadors,
  (select count(*) from mint_ambassadors where ambassador_status = 'student')       as student_ambassadors,
  (select count(*) from mint_ambassadors where ambassador_status = 'alumnus')       as alumnus_ambassadors,
  (select count(*) from ambassador_scan_events where is_bot = false)                as total_views,
  (select count(*) from mint_ambassadors
     where created_at >= now() - interval '7 days')                                 as registrations_last_7d;

alter view v_ambassador_campaign_performance set (security_invoker = on);
alter view v_ambassador_dashboard_totals      set (security_invoker = on);
