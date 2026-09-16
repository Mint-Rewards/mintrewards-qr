-- 0008: short names for the badge
--
-- The badge has one centred line for the campus, and the full legal names do not fit:
-- "Balochistan University of Information Technology, Engineering and Management
-- Sciences (BUITEMS)" shrank to the floor and still truncated mid-word.
--
-- Shrinking further is the wrong fix -- students call it BUITEMS, so the acronym is
-- both shorter AND the more natural label on a badge.
--
-- This is a DISPLAY name for the badge only. mint_ambassadors keeps the full name it
-- always stored, so the roster, exports and per-campus analytics are unaffected.
-- Left null wherever the real name already fits, and COALESCE picks it up.

alter table universities add column short_name text;

comment on column universities.short_name is
  'Badge label where the full name is too long for one line. Null means use name.';

update universities set short_name = v.uni_short
from (values
  ('National University of Sciences and Technology (NUST)', 'NUST'),
  ('Pakistan Institute of Engineering and Applied Sciences (PIEAS)', 'PIEAS'),
  ('National University of Modern Languages (NUML)', 'NUML'),
  ('Allama Iqbal Open University', 'AIOU'),
  ('University of Engineering and Technology (UET) Lahore', 'UET Lahore'),
  ('University of Engineering and Technology (UET) Peshawar', 'UET Peshawar'),
  ('University of Engineering and Technology (UET) Taxila', 'UET Taxila'),
  ('Government College University Lahore', 'GC University Lahore'),
  ('Government College University Faisalabad', 'GC University Faisalabad'),
  ('University of Veterinary and Animal Sciences', 'UVAS Lahore'),
  ('Lahore College for Women University', 'LCWU'),
  ('NED University of Engineering and Technology', 'NED University'),
  ('Dow University of Health Sciences', 'Dow University'),
  ('Institute of Business Administration (IBA) Karachi', 'IBA Karachi'),
  ('Federal Urdu University of Arts, Science and Technology', 'Federal Urdu University'),
  ('Balochistan University of Information Technology, Engineering and Management Sciences (BUITEMS)', 'BUITEMS'),
  ('Mehran University of Engineering and Technology', 'Mehran University'),
  ('Liaquat University of Medical and Health Sciences', 'LUMHS'),
  ('University of Agriculture Faisalabad', 'UAF'),
  ('The Islamia University of Bahawalpur', 'Islamia University Bahawalpur'),
  ('Pir Mehr Ali Shah Arid Agriculture University', 'Arid Agriculture University'),
  ('University of Azad Jammu and Kashmir', 'AJK University'),
  ('Lahore University of Management Sciences (LUMS)', 'LUMS'),
  ('University of Management and Technology (UMT)', 'UMT'),
  ('Beaconhouse National University', 'BNU'),
  ('Institute of Business Management (IoBM)', 'IoBM'),
  ('Shaheed Zulfikar Ali Bhutto Institute of Science and Technology (SZABIST)', 'SZABIST'),
  ('Sir Syed University of Engineering and Technology', 'Sir Syed University'),
  ('Indus Valley School of Art and Architecture', 'Indus Valley School of Art'),
  ('National University of Computer and Emerging Sciences (FAST-NUCES)', 'FAST-NUCES'),
  ('Ghulam Ishaq Khan Institute of Engineering Sciences and Technology (GIKI)', 'GIKI'),
  ('Capital University of Science and Technology', 'CUST'),
  ('CECOS University of Information Technology and Emerging Sciences', 'CECOS University'),
  ('City University of Science and Information Technology', 'City University Peshawar'),
  ('Sarhad University of Science and Information Technology', 'Sarhad University')
) as v(uni_name, uni_short)
where universities.name = v.uni_name;
