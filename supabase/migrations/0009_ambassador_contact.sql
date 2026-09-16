-- 0009: contact details for ambassadors
--
-- The programme had no way to reach a single registered ambassador, which is a problem
-- for an event that happens in a physical place on a specific day. Email and phone also
-- give the person an identity: browser storage brings someone back to their card only
-- on the device they signed up on, whereas an email address works anywhere.
--
-- Nullable because the 18 rows already in the table predate the fields. New sign-ups
-- are required to supply both, enforced in the registration action rather than by a NOT
-- NULL that would reject the existing history.

alter table mint_ambassadors add column email text;
alter table mint_ambassadors add column phone text;

comment on column mint_ambassadors.email is
  'Lower-cased at the boundary so one person cannot hold two rows via casing.';
comment on column mint_ambassadors.phone is
  'Normalised to +923XXXXXXXXX so the same number is always the same string.';

-- One registration per email per campaign.
--
-- The action looks for an existing row first and returns that person their original
-- card rather than creating a second one, so this index is the backstop for two
-- submissions racing each other. Partial, because the pre-existing rows have no email
-- and must not collide with one another.
create unique index mint_ambassadors_campaign_email_idx
  on mint_ambassadors (campaign_id, email)
  where email is not null;

-- Looking someone up by phone is an admin support action ("I lost my badge"), so it
-- only needs to be indexed, not unique: a shared family number is plausible, and
-- blocking a sibling from registering would be worse than the duplicate it prevents.
create index mint_ambassadors_phone_idx on mint_ambassadors (phone) where phone is not null;
