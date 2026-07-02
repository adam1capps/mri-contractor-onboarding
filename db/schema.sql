-- Roof MRI Connect: contractor onboarding schema (Neon / Postgres)
-- Run once against the Neon database wired to the Netlify project
-- (env NETLIFY_DATABASE_URL or DATABASE_URL).

create table if not exists trainings (
  id            serial primary key,
  token         text unique not null,
  company       text not null,
  contact_name  text,
  contact_email text,
  training_date date,
  meet_location text,
  trainer       text,
  package       text,
  -- 'onsite'   = trainer travels to the contractor
  -- 'nashville'= contractor travels to the ReDry facility (roof provided by ReDry)
  format        text not null default 'onsite' check (format in ('onsite', 'nashville')),
  status        text not null default 'booked',
  created_at    timestamptz not null default now()
);

create table if not exists agreements (
  id            serial primary key,
  training_id   integer not null references trainings(id),
  signer_name   text not null,
  signer_title  text not null,
  signer_email  text not null,
  sig_type      text not null check (sig_type in ('draw', 'type')),
  sig_data      text not null,          -- data URL (draw) or typed name (type)
  ip            text,
  user_agent    text,
  terms_version text not null,
  signed_at     timestamptz not null default now(),
  pdf_url       text                    -- reserved: populated once PDFs get durable storage
);

create table if not exists participants (
  id               serial primary key,
  training_id      integer not null references trainings(id),
  name             text not null,
  email            text not null,
  waiver_token     text unique not null,
  waiver_sig_type  text check (waiver_sig_type in ('draw', 'type')),
  waiver_sig_data  text,
  ip               text,
  user_agent       text,
  waiver_signed_at timestamptz
);

create index if not exists participants_training_idx on participants (training_id);
create index if not exists agreements_training_idx on agreements (training_id);

-- Demo seed matching the prototype page (safe to re-run)
insert into trainings (token, company, training_date, meet_location, trainer, package, format)
values ('demo-token', 'Summit Commercial Roofing', '2026-08-13', '8:00 AM, Summit''s Office', 'Adam Capps', 'Professional', 'onsite')
on conflict (token) do nothing;
