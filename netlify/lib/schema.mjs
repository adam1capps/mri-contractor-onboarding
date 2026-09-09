/* Canonical database schema for Roof MRI contractor onboarding.

   This module is the SINGLE SOURCE OF TRUTH for the schema. db/schema.sql is
   generated from it (npm run schema:sql) for anyone who prefers psql.

   Every statement is written to be idempotent so applying the schema against a
   database that already holds signed agreements is safe and repeatable. The
   Neon HTTP driver runs one statement per request, so the schema is kept as an
   array rather than one blob. */

export const TABLES = ['trainings', 'agreements', 'participants'];

export const SCHEMA_STATEMENTS = [
  {
    name: 'trainings',
    sql: `create table if not exists trainings (
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
)`,
  },
  {
    name: 'agreements',
    sql: `create table if not exists agreements (
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
)`,
  },
  {
    name: 'participants',
    sql: `create table if not exists participants (
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
)`,
  },
  {
    name: 'participants_training_idx',
    sql: 'create index if not exists participants_training_idx on participants (training_id)',
  },
  {
    name: 'agreements_training_idx',
    sql: 'create index if not exists agreements_training_idx on agreements (training_id)',
  },
];

/* Expected columns per table. Creating a table with IF NOT EXISTS is a silent
   no-op against a database whose table already exists but is missing a column
   (e.g. applied from an older revision of this file), which would then fail at
   the first signature. Checking columns turns that silent drift into a clear
   report in the admin console. */
export const EXPECTED_COLUMNS = {
  trainings: ['id', 'token', 'company', 'contact_name', 'contact_email', 'training_date',
    'meet_location', 'trainer', 'package', 'format', 'status', 'created_at'],
  agreements: ['id', 'training_id', 'signer_name', 'signer_title', 'signer_email', 'sig_type',
    'sig_data', 'ip', 'user_agent', 'terms_version', 'signed_at', 'pdf_url'],
  participants: ['id', 'training_id', 'name', 'email', 'waiver_token', 'waiver_sig_type',
    'waiver_sig_data', 'ip', 'user_agent', 'waiver_signed_at'],
};

/* Constraints that protect data quality but can legitimately fail on a database
   that already holds violating rows (a trainee added twice before this existed).
   They are applied separately and a failure is reported, never fatal: the core
   tables must still come up. */
export const HARDENING_STATEMENTS = [
  {
    name: 'participants_training_email_uniq',
    sql: `create unique index if not exists participants_training_email_uniq
            on participants (training_id, lower(email))`,
    note: 'stops the same trainee being added twice, which would leave a waiver permanently unsigned',
  },
];

/* What actually exists in the connected database: tables AND their columns. */
export async function inspectSchema(sql) {
  const rows = await sql(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name = any($1)`,
    [TABLES],
  );

  const byTable = {};
  for (const r of rows) (byTable[r.table_name] ||= []).push(r.column_name);

  const present = Object.keys(byTable);
  const missing = TABLES.filter(t => !present.includes(t));

  const drifted = {};
  for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
    if (!byTable[table]) continue;
    const absent = expected.filter(c => !byTable[table].includes(c));
    if (absent.length) drifted[table] = absent;
  }

  return {
    present,
    missing,
    drifted,
    applied: missing.length === 0 && Object.keys(drifted).length === 0,
  };
}

/* Applies every statement in order and reports the outcome of each. Safe to
   re-run: the core statements are IF NOT EXISTS, so existing tables and the
   signed agreements in them are left untouched. A hardening statement that
   fails (because existing rows violate it) is recorded and the run continues,
   so one dirty row can never stop the tables coming up. */
export async function applySchema(sql) {
  const results = [];

  for (const stmt of SCHEMA_STATEMENTS) {
    await sql(stmt.sql);
    results.push({ name: stmt.name, ok: true, required: true });
  }

  for (const stmt of HARDENING_STATEMENTS) {
    try {
      await sql(stmt.sql);
      results.push({ name: stmt.name, ok: true, required: false });
    } catch (err) {
      results.push({
        name: stmt.name,
        ok: false,
        required: false,
        note: stmt.note,
        error: err.message || 'failed',
      });
    }
  }

  return results;
}
