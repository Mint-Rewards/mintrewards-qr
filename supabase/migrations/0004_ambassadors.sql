-- Mint Ambassador program
-- 0004: core schema
--
-- Distinct funnel from the field-team QR system: one QR per CAMPAIGN (not per
-- platform) that opens a public registration form instead of redirecting to an app
-- store. A student fills the form once; the submission is the "conversion".
--
-- ambassador_scan_events mirrors qr_scan_events so the same funnel question
-- ("how many scans became registrations?") can be answered the same way.

-- ---------------------------------------------------------------------------
-- ambassador_campaigns
-- ---------------------------------------------------------------------------
create table ambassador_campaigns (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (length(trim(title)) > 0),
  event_name     text,
  event_date     date,
  location_name  text,
  city           text,
  status         text not null default 'draft'
                   check (status in ('draft','active','paused','completed','archived')),
  tracking_code  text not null unique,
  tracking_url   text not null,
  reference_code text not null unique,
  qr_image_path  text,
  -- Shown as the suggested caption when an ambassador shares their card. Kept per
  -- campaign so different events/universities can carry their own call-to-action;
  -- falls back to a generic one in application code when null.
  share_caption  text,
  notes          text,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index ambassador_campaigns_status_idx on ambassador_campaigns (status);
create index ambassador_campaigns_city_idx   on ambassador_campaigns (city);

create trigger ambassador_campaigns_set_updated_at
  before update on ambassador_campaigns
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- mint_ambassadors  (the registrations)
-- ---------------------------------------------------------------------------
create table mint_ambassadors (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references ambassador_campaigns (id) on delete cascade,
  full_name        text not null check (length(trim(full_name)) > 0),
  university       text not null check (length(trim(university)) > 0),
  -- Year of admission/batch, not year of submission. Status below is derived from
  -- this at insert time in application code (see src/lib/ambassador/config.ts) --
  -- stored rather than computed on read so the cutoff year can change in future
  -- intakes without reclassifying everyone who already registered.
  batch_year       integer not null check (batch_year between 2000 and 2100),
  ambassador_status text not null check (ambassador_status in ('student','alumnus')),
  card_file_path   text,
  ip_address       text,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index mint_ambassadors_campaign_idx  on mint_ambassadors (campaign_id, created_at desc);
create index mint_ambassadors_status_idx    on mint_ambassadors (ambassador_status);
create index mint_ambassadors_university_idx on mint_ambassadors (university);

-- ---------------------------------------------------------------------------
-- ambassador_scan_events  (form page views, before a submission ever happens)
-- ---------------------------------------------------------------------------
create table ambassador_scan_events (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ambassador_campaigns (id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  ip_address  text,
  user_agent  text,
  device_type text,
  browser     text,
  os          text,
  is_bot      boolean not null default false
);

create index ambassador_scan_events_campaign_idx   on ambassador_scan_events (campaign_id, scanned_at desc);
create index ambassador_scan_events_scanned_at_idx on ambassador_scan_events (scanned_at desc);
