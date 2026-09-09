/* Regenerates db/schema.sql from netlify/lib/schema.mjs (the source of truth).
   Run: npm run schema:sql */
import { writeFileSync } from 'node:fs';
import { SCHEMA_STATEMENTS, HARDENING_STATEMENTS } from '../netlify/lib/schema.mjs';

const header = `-- Roof MRI Connect: contractor onboarding schema (Neon / Postgres)
--
-- GENERATED FILE. Do not edit by hand.
-- Source of truth: netlify/lib/schema.mjs   Regenerate: npm run schema:sql
--
-- You do not need to run this manually: sign in to /admin/ and use the
-- database panel, which applies exactly these statements. This file is here
-- for anyone who would rather run it with psql against NETLIFY_DATABASE_URL
-- or DATABASE_URL. Every statement is idempotent and safe to re-run against a
-- database that already holds signed agreements.
`;

const core = SCHEMA_STATEMENTS.map(s => `${s.sql};`).join('\n\n');
const hardening = HARDENING_STATEMENTS
  .map(s => `-- ${s.note}\n-- Fails if existing rows already violate it; clean the duplicates, then re-run.\n${s.sql};`)
  .join('\n\n');
const body = `${core}\n\n-- Data-quality constraints (applied separately; a failure here is not fatal).\n\n${hardening}`;
writeFileSync(new URL('../db/schema.sql', import.meta.url), `${header}\n${body}\n`);
console.log(`db/schema.sql regenerated: ${SCHEMA_STATEMENTS.length} core + ${HARDENING_STATEMENTS.length} hardening statements`);
