# Handoff: Roof MRI Contractor Onboarding

**Repo:** `adam1capps/mri-contractor-onboarding` · **Owner:** Adam Capps (adam@re-dry.com)

## Where it lives

- **Production: https://onboarding.roof-mri.com**, Netlify project `contractor-onboarding`
  (site ID `5e973d6a-f425-453a-9b62-0ca1cf9a7228`), deploying from `main`.
- Static pages publish from the repo root; API routes are Netlify Functions v2 with custom
  paths (`netlify/functions/`), backed by Neon Postgres.
- Netlify env vars, all set: `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `SENDGRID_API_KEY`, `SITE_BASE_URL` (pinned to the branded domain so every emailed link
  is correct regardless of Netlify's primary-URL setting). Optional: `EMAIL_FROM`,
  `NOTIFY_EMAILS`, `ADMIN_EMAIL_DOMAINS` (default `re-dry.com`).
- Netlify's Neon extension is installed on the team but is **discontinued for new database
  creation**. The existing Neon database is the one to use; do not try to re-provision.

## How one site serves every training

One row in `trainings` per booked training, each with a random token. Nothing about a
contractor is hardcoded anywhere.

1. Staff create the training in **`/admin/`** (Clerk sign-in, ReDry Google accounts only).
2. The contractor gets `https://onboarding.roof-mri.com/training/{token}` by email.
3. They execute the company Training Agreement on that page.
4. The crew roster then unlocks; each trainee gets `/training/{token}/w/{ptk}` for their
   personal field waiver. Rule on training day: no signed waiver, no roof.

The bare domain serves a neutral "use your personalized link" page. It must never render a
named customer again: that was the old `/` to `/training/` redirect landing on the demo.

## Checking the database

`/admin/` has a **Database** panel (Clerk-gated, `GET/POST /api/admin/db`). It reports
whether a database is connected, which env var supplies the connection, whether every table
**and column** exists, and how many trainings, agreements and waivers are stored. If
anything is missing it offers a **Create the tables** button that applies the schema.

Column checking matters: `CREATE TABLE IF NOT EXISTS` is a silent no-op against a table that
exists but is missing a column, so a half-applied schema would otherwise look healthy right
up until the first contractor tried to sign.

`netlify/lib/schema.mjs` is the single source of truth. `db/schema.sql` is generated from it
(`npm run schema:sql`) for anyone who prefers psql; `npm run schema:check` verifies the
module's column list still matches its own DDL. Every statement is idempotent and safe to
re-run against a database holding signed agreements. Constraints that can legitimately fail
on existing data are applied separately and reported, never fatal.

## Conventions that are load-bearing

- **Never tell a signer something was recorded when it was not.** The demo fallback exists
  only for `demo-token`; on a real token a failed write surfaces the error, keeps the draft,
  and leaves the page unsigned.
- **Nothing contractor-specific in the page shell.** The demo is data behind `demo-token`
  and uses a fictional company.
- Terms changes require a `TERMS_VERSION` bump in **both** `netlify/lib/terms.mjs` and
  `training/index.html`. The page now compares its version against the server's and blocks
  signing on a mismatch rather than letting every signature fail at submit time.
- Work on a `claude/...` branch, push, open a **draft PR** against `main`.
- GitHub access via the GitHub MCP tools; no `gh` CLI in remote sessions.

## Design rules (per Adam, Jul 2026)

- **Match the Roof MRI Connect app** (connect.roof-mri.com). Tokens are mirrored in the
  `:root` block of `training/index.html`: Plus Jakarta Sans, off-white `#F7F8FA` page with
  white cards (radius 10/16, soft layered shadows), navy `#1E2C55` fills for topbar/hero and
  buttons (hover `#2a3d6e`), green `#00BD70` CTAs (hover `#00A862`), tinted status fills,
  pill badges, focus rings `0 0 0 3px #00bd7014`, accents yellow `#F2C94C`, red `#EB5757`.
- The pre-Jul-2026 rules (Trebuchet MS, navy/green as text and borders only) are retired.
- Still standing: **no em dashes anywhere in copy**, including emails and PDFs.

## Still open

- **Executed agreement PDFs are not retrievable.** `agreements.pdf_url` is reserved and the
  only copy is the email attachment. If SendGrid fails or the signer's address was mistyped,
  the PDF exists nowhere, though the signature data is in Postgres. Worth adding
  `GET /api/admin/trainings/:token/agreement.pdf` that re-renders from the stored row using
  `netlify/lib/pdf.mjs`, since everything needed is already persisted.
- **No way to remove a mistyped trainee.** A crew member added with a wrong email can never
  be corrected, so that training never reads as fully signed. Needs an admin-only delete on
  the participants route (only where `waiver_signed_at is null`).
- **Waiver page does not identify the participant.** It should look up the `ptk` server side
  and show their name, and block re-signing client side (the API is already idempotent).
- **Foreign keys have no `ON DELETE`,** so a training with signatures cannot be deleted
  without removing children first. Cancelling via the admin Status field is the intended
  path; a real delete needs the constraint changed first.
- **Waivers store no terms version,** unlike the company agreement. Needs a column before it
  can be recorded.
- **Nashville copy is DRAFT** and needs Adam's sign-off; the facility street address still
  has to be injected. Open question: whether Agreement Section 03 (roof list) should differ
  for Nashville, since ReDry provides the roof.
- **`jimmy-nunez-onboarding`** is a separate Netlify site (`jimmynunez.roof-mri.com`), the
  one-off-per-contractor pattern this site replaces. Folding it in means creating a training
  here and pointing or retiring that site.
