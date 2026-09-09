-- Roof MRI Connect: contractor onboarding schema (Neon / Postgres)
--
-- GENERATED FILE. Do not edit by hand.
-- Source of truth: netlify/lib/schema.mjs   Regenerate: npm run schema:sql
--
-- You do not need to run this manually: sign in to /admin/ and use the
-- database panel, which applies exactly these statements. This file is here
-- for anyone who would rather run it with psql against NETLIFY_DATABASE_URL
-- or DATABASE_URL. Every statement is idempotent and safe to re-run against a
-- database that already holds signed agreements.

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
  sig_data      text not null,
  ip            text,
  user_agent    text,
  terms_version text not null,
  signed_at     timestamptz not null default now(),
  pdf_url       text
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

-- Data-quality constraints (applied separately; a failure here is not fatal).

-- stops the same trainee being added twice, which would leave a waiver permanently unsigned
-- Fails if existing rows already violate it; clean the duplicates, then re-run.
create unique index if not exists participants_training_email_uniq
            on participants (training_id, lower(email));
