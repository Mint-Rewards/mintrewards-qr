-- MintRewards QR Onboarding Attribution System
-- 0001: core schema
--
-- Design notes:
--  * team_member_id is denormalised onto qr_codes and qr_scan_events (per spec). It is
--    derivable via the assignment, but keeping it local makes per-member analytics a
--    single-table scan. Triggers below keep it correct so application code cannot drift.
--  * Tracking codes are generated in the application (CSPRNG, 60 bits). The UNIQUE
--    constraint here is the actual uniqueness guarantee -- the app retries on 23505.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------------
create table team_members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (length(trim(full_name)) > 0),
  phone       text,
  email       text,
  city        text,
  region      text,
  status      text not null default 'active' check (status in ('active','inactive')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index team_members_status_idx on team_members (status);
create index team_members_city_idx   on team_members (city);

create trigger team_members_set_updated_at
  before update on team_members
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- qr_assignments
-- ---------------------------------------------------------------------------
create table qr_assignments (
  id                  uuid primary key default gen_random_uuid(),
  team_member_id      uuid not null references team_members (id) on delete restrict,
  title               text not null check (length(trim(title)) > 0),
  location_name       text,
  location_type       text check (location_type in ('society','flats','project','event','mall','other')),
  city                text,
  area                text,
  campaign_start_date date,
  campaign_end_date   date,
  status              text not null default 'draft'
                        check (status in ('draft','active','paused','completed','archived')),
  reference_code      text not null unique,
  notes               text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint campaign_dates_ordered
    check (campaign_end_date is null or campaign_start_date is null
           or campaign_end_date >= campaign_start_date)
);

create index qr_assignments_team_member_idx on qr_assignments (team_member_id);
create index qr_assignments_status_idx      on qr_assignments (status);
create index qr_assignments_city_idx        on qr_assignments (city);
create index qr_assignments_created_at_idx  on qr_assignments (created_at desc);

create trigger qr_assignments_set_updated_at
  before update on qr_assignments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- qr_codes
-- ---------------------------------------------------------------------------
create table qr_codes (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references qr_assignments (id) on delete cascade,
  team_member_id  uuid not null references team_members (id) on delete restrict,
  platform        text not null check (platform in ('ios','android')),
  tracking_code   text not null unique,
  tracking_url    text not null,
  destination_url text not null,
  qr_image_path   text,
  status          text not null default 'active' check (status in ('active','disabled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- exactly one iOS and one Android code per assignment
  unique (assignment_id, platform)
);

-- The redirect hot path. UNIQUE already indexes tracking_code; named here for clarity.
create index qr_codes_assignment_idx  on qr_codes (assignment_id);
create index qr_codes_team_member_idx on qr_codes (team_member_id);

create trigger qr_codes_set_updated_at
  before update on qr_codes
  for each row execute function set_updated_at();

-- Keep the denormalised team_member_id in step with the parent assignment.
create or replace function sync_qr_code_team_member()
returns trigger
language plpgsql
as $$
begin
  select team_member_id into new.team_member_id
  from qr_assignments where id = new.assignment_id;
  return new;
end;
$$;

create trigger qr_codes_sync_team_member
  before insert or update of assignment_id on qr_codes
  for each row execute function sync_qr_code_team_member();

-- Reassigning an assignment to a different team member must cascade to its QR codes,
-- otherwise historical attribution silently points at the wrong person.
create or replace function cascade_assignment_team_member()
returns trigger
language plpgsql
as $$
begin
  if new.team_member_id is distinct from old.team_member_id then
    update qr_codes set team_member_id = new.team_member_id where assignment_id = new.id;
  end if;
  return new;
end;
$$;

create trigger qr_assignments_cascade_team_member
  after update of team_member_id on qr_assignments
  for each row execute function cascade_assignment_team_member();

-- ---------------------------------------------------------------------------
-- qr_scan_events
-- ---------------------------------------------------------------------------
create table qr_scan_events (
  id             uuid primary key default gen_random_uuid(),
  qr_code_id     uuid not null references qr_codes (id) on delete cascade,
  assignment_id  uuid not null references qr_assignments (id) on delete cascade,
  team_member_id uuid not null references team_members (id) on delete restrict,
  platform       text not null check (platform in ('ios','android')),
  scanned_at     timestamptz not null default now(),
  ip_address     text,
  user_agent     text,
  referrer       text,
  device_type    text,
  browser        text,
  os             text,
  redirected_to  text,
  -- Link-preview fetchers (WhatsApp, iMessage, Slack) hit these URLs too. Flag rather
  -- than drop, so counts stay honest and auditable.
  is_bot         boolean not null default false
);

create index qr_scan_events_qr_code_idx     on qr_scan_events (qr_code_id, scanned_at desc);
create index qr_scan_events_assignment_idx  on qr_scan_events (assignment_id, scanned_at desc);
create index qr_scan_events_team_member_idx on qr_scan_events (team_member_id, scanned_at desc);
create index qr_scan_events_scanned_at_idx  on qr_scan_events (scanned_at desc);
create index qr_scan_events_platform_idx    on qr_scan_events (platform);

-- ---------------------------------------------------------------------------
-- generated_standees
-- ---------------------------------------------------------------------------
create table generated_standees (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references qr_assignments (id) on delete cascade,
  template_name text not null,
  language      text not null default 'english' check (language in ('english','urdu')),
  file_path     text not null,
  file_type     text not null default 'pdf',
  generated_at  timestamptz not null default now(),
  generated_by  uuid references auth.users (id) on delete set null
);

create index generated_standees_assignment_idx on generated_standees (assignment_id, generated_at desc);

-- ---------------------------------------------------------------------------
-- attributed_signups  (future use -- see PLAN.md §10)
-- ---------------------------------------------------------------------------
create table attributed_signups (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text,
  qr_code_id         uuid references qr_codes (id) on delete set null,
  assignment_id      uuid references qr_assignments (id) on delete set null,
  team_member_id     uuid references team_members (id) on delete set null,
  platform           text check (platform in ('ios','android')),
  signup_at          timestamptz,
  attribution_source text,
  created_at         timestamptz not null default now()
);

create index attributed_signups_qr_code_idx     on attributed_signups (qr_code_id);
create index attributed_signups_team_member_idx on attributed_signups (team_member_id);
