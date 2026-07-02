# Handoff: Roof MRI Contractor Onboarding Training Page

**Repo:** `adam1capps/mri-contractor-onboarding` · **Owner:** Adam Capps (adam@re-dry.com)

## Current state (as of Jul 2, 2026)

- PR #1 merged to `main`: the training prep + agreement execution page prototype.
- PR from `claude/handoff-docs-7i5hz5`: backend build. Netlify functions + Neon for all three
  endpoints, roster waiver-status flip with polling, all-signed notification, executed-agreement
  PDF + SendGrid email, and the Nashville format render.
- Files in repo:
  - `training/index.html`: single-file page (all CSS/JS inline). Build notes in the HTML header
    comment. Now calls the real API with graceful demo fallback when the API/database is
    unavailable (deploy previews keep working). `?format=nashville` previews the Nashville
    render; `?ptk={token}` opens the participant waiver view directly.
  - `netlify/functions/`: Netlify Functions v2 with custom paths:
    - `training-agreement.mjs`: `POST /api/training/:token/agreement`. Validates payload and
      terms version (409 on mismatch), stores signature + IP/user agent/timestamp in Neon,
      generates the executed-agreement PDF (pdf-lib), emails it to the signer and notifies
      Adam/Regina. PDF/email are best effort; the DB row is the legal artifact.
    - `training-participants.mjs`: `GET` (roster with signed status) and `POST` (add trainee;
      server generates the waiver token and emails the signing link). POST requires the
      agreement to be signed first (409 otherwise).
    - `waiver-sign.mjs`: `POST /api/waiver/:ptk/sign`. Stores signature + metadata, idempotent
      on re-sign, and emails Adam/Regina when the whole crew has signed.
  - `netlify/lib/`: shared modules. `terms.mjs` is the canonical agreement text + TERMS_VERSION
    (must stay in sync with the HTML); `pdf.mjs` (executed-agreement PDF); `email.mjs`
    (SendGrid, same pattern as the re-dry.com intake fn); `db.mjs` (Neon client).
  - `db/schema.sql`: canonical schema (trainings, agreements, participants) + demo seed row.
  - `netlify.toml`, `package.json`: functions config (esbuild) and deps
    (`@neondatabase/serverless`, `pdf-lib`).
  - `_redirects`: Netlify 302 from site root to `/training/` (prototype convenience only).
- Deployed on Netlify as project **contractor-onboarding** (deploy previews auto-build on PRs).

## Setup needed before the backend is live (Adam or next session)

1. Attach a Neon database to the Netlify project (sets `NETLIFY_DATABASE_URL`; `DATABASE_URL`
   also works) and run `db/schema.sql` against it once.
2. Netlify env vars: `SENDGRID_API_KEY` (emails are skipped with a console warning when unset),
   optional `EMAIL_FROM` (default adam@re-dry.com), `NOTIFY_EMAILS` (comma-separated, default
   adam@re-dry.com), `SITE_BASE_URL` (default https://connect.roof-mri.com).
3. Housekeeping still pending, and it now blocks deploy previews: the repo default branch is
   still `claude/roof-mri-training-agreement-liyg7r`, and Netlify's production branch matches
   it, so deploy previews do NOT build for PRs targeting `main` (confirmed on PR #3: no
   preview, production still serves the old branch). Fix: switch the GitHub default branch to
   `main`, set the Netlify production branch to `main` (Site configuration > Build & deploy >
   Branches), then delete the old branch. (Not possible via the tools available in remote
   sessions.)

## What the page is

One personalized URL per booked training in the Roof MRI Connect stack (target:
`connect.roof-mri.com/training/{token}`, Netlify functions + Neon). Two deliberate signature flows:

1. **Company agreement**: authorized signer executes the Training Agreement (10-section
   accordion, plain-English summary, draw/type signature, ESIGN consent checkboxes,
   `TERMS_VERSION` stamped per signature).
2. **Participant waivers**: after the agreement is signed, a crew roster unlocks; each trainee
   gets a unique link (`/training/{token}/w/{ptk}`) to sign a personal field waiver. Rule: no
   signed waiver, no roof. Roster chips flip to Signed (page polls every 20s).

Demo data is hardcoded (Summit Commercial Roofing, Aug 13 2026, trainer Adam Capps,
Professional package, `TRAINING_TOKEN = "demo-token"`) and will be injected server-side in prod.

## Not built yet (natural next steps)

- **Prod routing + server-side injection**: `/training/{token}` should render the page with real
  training data (company, date, format, token) instead of the hardcoded demo constants, and
  `/training/{token}/w/{ptk}` should resolve to the waiver view (an edge function or a render
  function templating `training/index.html`). The `?ptk=` query param is a stand-in.
- **Durable PDF storage**: `agreements.pdf_url` is reserved; executed PDFs currently exist only
  as email attachments (Netlify Blobs or S3, then backfill the column).
- **Nashville copy sign-off**: the Nashville render's travel/hotel and adjusted cancellation
  copy is DRAFT and needs Adam's approval; the facility street address still needs to be
  injected. Also open: whether Agreement Section 03 (roof list) should be varied for Nashville
  trainings, since ReDry provides the roof. Terms changes require a TERMS_VERSION bump in BOTH
  `netlify/lib/terms.mjs` and `training/index.html`.
- **Waiver page hardening**: prod waiver view should look up the participant by `ptk` and show
  their name/training details server-side.

## Standing design rules (per Adam, enforce on all Roof MRI/ReDry work)

- White/light backgrounds only. Brand navy `#1E2C55` and green `#00BD70` as **text and borders
  only, never fills** (logo squares at mark scale are the sole exception).
- Trebuchet MS throughout. **No em dashes anywhere in copy** (including emails and PDFs).
- Accent colors in use: yellow `#E8A614`, red `#D6453C`.

## Session conventions

- Work on a `claude/...` feature branch, push, open a **draft PR** against `main`.
- GitHub access via the GitHub MCP tools (no `gh` CLI in the remote environment); repo scope
  limited to this repo.
- For design-heavy work on this app, load the `artifact-design` skill before writing UI.
