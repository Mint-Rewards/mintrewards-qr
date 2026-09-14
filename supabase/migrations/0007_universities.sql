-- 0007: university reference list for the ambassador sign-up form
--
-- The form previously took a free-text university, which is unusable for the question
-- the programme actually asks ("which campuses are converting?"): "LUMS", "Lums",
-- "L.U.M.S" and "Lahore University of Management Sciences" are four rows that should
-- be one. A reference table makes the common case a pick-list and keeps the long tail
-- as free text under an explicit "Other".

create table universities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),
  sector     text not null check (sector in ('public','private')),
  city       text,
  -- Retire a campus without deleting it: existing registrations keep their reference,
  -- but it stops being offered on the form.
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index universities_active_name_idx on universities (is_active, name);

-- ---------------------------------------------------------------------------
-- mint_ambassadors gains the reference, keeping the text for display and for
-- "Other" entries, which have no row to point at.
-- ---------------------------------------------------------------------------
alter table mint_ambassadors
  add column university_id uuid references universities (id) on delete set null;

create index mint_ambassadors_university_id_idx on mint_ambassadors (university_id);

-- ---------------------------------------------------------------------------
-- RLS: same model as the rest of the admin tables. The public form reads this
-- list server-side through the service role, so it needs no anonymous policy.
-- ---------------------------------------------------------------------------
alter table universities enable row level security;

create policy universities_admin_all on universities
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed: major Pakistani universities, public and private.
--
-- NOT EXHAUSTIVE, and deliberately so -- it covers the campuses the programme is
-- most likely to reach, with "Other" catching everything else. Review and extend it
-- rather than treating it as authoritative.
-- ---------------------------------------------------------------------------
insert into universities (name, sector, city) values
  -- Public sector
  ('Quaid-i-Azam University', 'public', 'Islamabad'),
  ('National University of Sciences and Technology (NUST)', 'public', 'Islamabad'),
  ('COMSATS University Islamabad', 'public', 'Islamabad'),
  ('International Islamic University', 'public', 'Islamabad'),
  ('Pakistan Institute of Engineering and Applied Sciences (PIEAS)', 'public', 'Islamabad'),
  ('National University of Modern Languages (NUML)', 'public', 'Islamabad'),
  ('Allama Iqbal Open University', 'public', 'Islamabad'),
  ('Institute of Space Technology', 'public', 'Islamabad'),
  ('Air University', 'public', 'Islamabad'),
  ('Bahria University', 'public', 'Islamabad'),
  ('University of the Punjab', 'public', 'Lahore'),
  ('University of Engineering and Technology (UET) Lahore', 'public', 'Lahore'),
  ('Government College University Lahore', 'public', 'Lahore'),
  ('King Edward Medical University', 'public', 'Lahore'),
  ('University of Veterinary and Animal Sciences', 'public', 'Lahore'),
  ('Lahore College for Women University', 'public', 'Lahore'),
  ('University of Karachi', 'public', 'Karachi'),
  ('NED University of Engineering and Technology', 'public', 'Karachi'),
  ('Dow University of Health Sciences', 'public', 'Karachi'),
  ('Institute of Business Administration (IBA) Karachi', 'public', 'Karachi'),
  ('Federal Urdu University of Arts, Science and Technology', 'public', 'Karachi'),
  ('University of Peshawar', 'public', 'Peshawar'),
  ('University of Engineering and Technology (UET) Peshawar', 'public', 'Peshawar'),
  ('Khyber Medical University', 'public', 'Peshawar'),
  ('Islamia College University', 'public', 'Peshawar'),
  ('University of Balochistan', 'public', 'Quetta'),
  ('Balochistan University of Information Technology, Engineering and Management Sciences (BUITEMS)', 'public', 'Quetta'),
  ('University of Sindh', 'public', 'Jamshoro'),
  ('Mehran University of Engineering and Technology', 'public', 'Jamshoro'),
  ('Liaquat University of Medical and Health Sciences', 'public', 'Jamshoro'),
  ('University of Agriculture Faisalabad', 'public', 'Faisalabad'),
  ('Government College University Faisalabad', 'public', 'Faisalabad'),
  ('Bahauddin Zakariya University', 'public', 'Multan'),
  ('The Islamia University of Bahawalpur', 'public', 'Bahawalpur'),
  ('University of Engineering and Technology (UET) Taxila', 'public', 'Taxila'),
  ('University of Gujrat', 'public', 'Gujrat'),
  ('University of Sargodha', 'public', 'Sargodha'),
  ('Fatima Jinnah Women University', 'public', 'Rawalpindi'),
  ('Pir Mehr Ali Shah Arid Agriculture University', 'public', 'Rawalpindi'),
  ('University of Azad Jammu and Kashmir', 'public', 'Muzaffarabad'),
  ('Sindh Agriculture University', 'public', 'Tandojam'),
  ('Shah Abdul Latif University', 'public', 'Khairpur'),
  ('Gomal University', 'public', 'Dera Ismail Khan'),
  ('Abdul Wali Khan University', 'public', 'Mardan'),
  -- Private sector
  ('Lahore University of Management Sciences (LUMS)', 'private', 'Lahore'),
  ('University of Central Punjab', 'private', 'Lahore'),
  ('University of Management and Technology (UMT)', 'private', 'Lahore'),
  ('University of Lahore', 'private', 'Lahore'),
  ('Forman Christian College', 'private', 'Lahore'),
  ('Beaconhouse National University', 'private', 'Lahore'),
  ('Lahore School of Economics', 'private', 'Lahore'),
  ('Superior University', 'private', 'Lahore'),
  ('Aga Khan University', 'private', 'Karachi'),
  ('Habib University', 'private', 'Karachi'),
  ('Institute of Business Management (IoBM)', 'private', 'Karachi'),
  ('Shaheed Zulfikar Ali Bhutto Institute of Science and Technology (SZABIST)', 'private', 'Karachi'),
  ('Sir Syed University of Engineering and Technology', 'private', 'Karachi'),
  ('DHA Suffa University', 'private', 'Karachi'),
  ('Hamdard University', 'private', 'Karachi'),
  ('Ziauddin University', 'private', 'Karachi'),
  ('Iqra University', 'private', 'Karachi'),
  ('Muhammad Ali Jinnah University', 'private', 'Karachi'),
  ('Indus Valley School of Art and Architecture', 'private', 'Karachi'),
  ('National University of Computer and Emerging Sciences (FAST-NUCES)', 'private', 'Multiple'),
  ('Ghulam Ishaq Khan Institute of Engineering Sciences and Technology (GIKI)', 'private', 'Topi'),
  ('Riphah International University', 'private', 'Islamabad'),
  ('Foundation University', 'private', 'Islamabad'),
  ('Capital University of Science and Technology', 'private', 'Islamabad'),
  ('Shifa Tameer-e-Millat University', 'private', 'Islamabad'),
  ('CECOS University of Information Technology and Emerging Sciences', 'private', 'Peshawar'),
  ('Abasyn University', 'private', 'Peshawar'),
  ('City University of Science and Information Technology', 'private', 'Peshawar'),
  ('Sarhad University of Science and Information Technology', 'private', 'Peshawar');
