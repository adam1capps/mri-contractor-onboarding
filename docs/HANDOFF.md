# Handoff: Roof MRI Contractor Onboarding Training Page

**Repo:** `adam1capps/mri-contractor-onboarding` · **Owner:** Adam Capps (adam@re-dry.com)

## Current state (as of Jul 2, 2026)

- PR #1 merged to `main`: the training prep + agreement execution page prototype.
- Files in repo:
  - `training/index.html`: single-file static prototype (all CSS/JS inline). Extensive build notes live in the HTML header comment: intent, ESIGN/UETA checklist, suggested Neon schema, endpoint stubs.
  - `_redirects`: Netlify 302 from site root to `/training/` (prototype convenience only).
- Deployed on Netlify as project **contractor-onboarding** (deploy previews auto-build on PRs).
- Housekeeping possibly still pending: repo default branch may still be `claude/roof-mri-training-agreement-liyg7r` (first branch ever pushed); should be switched to `main` in GitHub settings and the old branch deleted.

## What the page is

One personalized URL per booked training in the Roof MRI Connect stack (target: `connect.roof-mri.com/training/{token}`, Netlify functions + Neon). Two deliberate signature flows:

1. **Company agreement**: authorized signer executes the Training Agreement (10-section accordion, plain-English summary, draw/type signature, ESIGN consent checkboxes, `TERMS_VERSION` stamped per signature).
2. **Participant waivers**: after the agreement is signed, a crew roster unlocks; each trainee gets a unique link (`/training/{token}/w/{ptk}`) to sign a personal field waiver. Rule: no signed waiver, no roof.

Demo data is hardcoded (Summit Commercial Roofing, Aug 13 2026, trainer Adam Capps, Professional package, `TRAINING_TOKEN = "demo-token"`) and will be injected server-side in prod.

## Not built yet (natural next steps)

- Netlify functions + Neon for the three stubbed endpoints: `POST /api/training/:token/agreement`, `POST /api/training/:token/participants`, `POST /api/waiver/:ptk/sign` (schema suggestion is in the file header). Server must capture IP/user agent/timestamp, store signature data, generate the executed-agreement PDF, and email it (SendGrid, same pattern as the re-dry.com intake function).
- Waiver status flip on the roster ("Awaiting signature" to signed) and notification to Adam/Regina when all crew have signed.
- **Nashville training format** render: travel/hotel info, ReDry facility address, roof provided by ReDry, adjusted cancellation terms (`trainings.format = 'nashville'` vs `'onsite'`).

## Standing design rules (per Adam, enforce on all Roof MRI/ReDry work)

- White/light backgrounds only. Brand navy `#1E2C55` and green `#00BD70` as **text and borders only, never fills** (logo squares at mark scale are the sole exception).
- Trebuchet MS throughout. **No em dashes anywhere in copy.**
- Accent colors in use: yellow `#E8A614`, red `#D6453C`.

## Session conventions

- Work on a `claude/...` feature branch, push, open a **draft PR** against `main`.
- GitHub access via the GitHub MCP tools (no `gh` CLI in the remote environment); repo scope limited to this repo.
