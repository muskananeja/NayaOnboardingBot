# NAYA — Preview Readiness Report

## Recommendation: READY FOR ELAINE/GEORGIE REVIEW

All three acceptance journeys pass on a real Vercel Preview deployment (not local dev),
at desktop and 375px mobile widths. No production data was created, modified, or
deleted. Production itself was not touched or redeployed.

## Preview URL

https://naya-i4746brn6-spotshare1.vercel.app

This is a **Preview** deployment (`target: null`, not Production). It currently shares
the same Vercel KV database as production, because that's the only way to verify real
persistence-dependent behavior (admin edits, task completion, readiness) on Vercel's
serverless infrastructure — an in-memory fallback does not persist across serverless
invocations the way it does in local `next dev`. All testing below used one clearly
labeled, isolated test record (`ZZZ PREVIEW TEST - DELETE ME`), which was deleted via
the API immediately after testing. See "Production data" below for verification.

Note: this Preview deployment requires Vercel's Deployment Protection bypass to view
outside the Vercel dashboard (the project is private by default). Open it from inside
Vercel (logged in as the project owner) or ask me for a reviewer link.

## Authoritative repository / branch

- Repo: https://github.com/muskananeja/NayaOnboardingBot
- Branch: `naya-admin-onboarding-reconciliation`
- PR: https://github.com/muskananeja/NayaOnboardingBot/pull/4

This repo previously held an unrelated, pre-dashboard scaffold (`naya_niit_bot.html` +
a different state-machine layout) that did not match what's live in production.
Production itself had **no connected Git repository** — every prior deploy went up via
`vercel deploy` from a local folder with no commit history. This branch is the first
real, reviewable source of truth for the app. Vercel is still not connected to this
repo (deploys above were pushed from the branch via CLI) — connecting it is a follow-up
step, not done in this pass, since it would require changing production's deployment
configuration.

## Files changed during reconciliation

Full diff is in PR #4. Summary: removed the stale `naya_niit_bot.html` + `src/`
scaffold; added the actual Next.js app — `lib/` (auth, contractor task engine, invite
tokens, rate limiting, audit, store), `pages/api/*` (all contractor/employee/auth
routes), `pages/dashboard.tsx`, `pages/contractors/{index,new}.tsx`, `pages/login.tsx`,
`pages/people.tsx`, `pages/index.tsx` (serves `public/index.html` at `/`), `tests/*`,
and `public/index.html` (one targeted fix, see below — no redesign).

## The invitation URL fix (finalized)

- Canonical parameter going forward: **`?token=`** — this is what the admin dashboard's
  "Generate/Replace invitation link" has always produced.
- Backward compatibility: the contractor-facing page now checks `?token=` first, then
  falls back to `?invite=`, so any link using the older parameter name still opens.
- Verified on the live Preview:
  - A newly generated `?token=` link opens directly into the contractor journey. PASS
  - An invalid/garbage token shows: *"This invitation link isn't valid or has expired.
    Please contact your Resourcing Lead for a new one."* PASS
  - No production invitation was regenerated or revoked during this testing — only the
    one test record's invite was ever issued, and that record was deleted afterward.

## Production data — untouched

Before and after this pass, the two real contractor records
(`Muskan Aneja` / `muskart27@gmail.com` and `xyz` / `adimuskan97@gmail.com`) were read
but never modified — confirmed by their `last_saved` timestamps being identical before
and after this session's testing. The one test record created
(`ZZZ PREVIEW TEST - DELETE ME`, id `c_muqgurx1n37hue`) was deleted via
`DELETE /api/contractor-state` immediately after Journeys A–C were verified; a follow-up
listing call confirms only the two original records remain.

## Verification

- `npx tsc --noEmit` — clean
- `npx vitest run` — 31/31 passed
- `npx next build` — succeeds
- Preview deployment build — succeeded on Vercel

## Acceptance journeys — all against the live Preview URL

**A. Resourcing Lead/admin (create) — PASS**
Signed in, opened the People dashboard, filtered to Contractors, ran the 3-step wizard
(engagement type, country, start date, ownership, Yes/No/To-be-confirmed requirements),
reviewed the generated 10 core + 6 conditional tasks, created the record, received a
working one-time invitation link.

**B. Admin management — PASS**
Opened the new record: phases, ownership, dependencies, invitation status ("Active —
expires..."), progress (0/16), and "Ready to start: Not yet" all displayed correctly.
Used **Preview journey** (read-only, admin-session-gated) without affecting the real
invitation. Updated one task (`Confirm engagement / SOW`) to Complete — progress and
next-action refreshed live (0% → 6%) without a page reload.

**C. Contractor/associate — PASS**
Opened the invitation link: saw the prioritized next action, categorized sections
(Your actions / NIIT actions / Waiting on client / Blocked / Upcoming / Completed), and
key contacts. Opened a task's detail and confirmed why-it-matters, owner, dependency,
resource ("Resource to be confirmed" where unvalidated), and status. Completed one
contractor-owned task (NIIT mandatory training) — view refreshed immediately and showed
"You're all set for now. We'll let you know when something needs you." Confirmed via a
direct API call that the contractor **cannot** complete an internally-owned task
(attempted `K0`, owned by Resourcing Lead — rejected with 409 "This task is not
currently waiting on you").

## Visual check — desktop and 375px mobile

Checked all three journeys at both widths. No demo-blocking issues found: no clipped or
overlapping content, no broken buttons, navigation (Back/Cancel) present at every step,
no raw status codes or developer language visible, readiness language is plain
("Ready to start: Not yet" / "Getting ready"), resources show "Resource to be
confirmed" rather than a blank or broken link.

## Remaining (non-blocking) items

- Vercel is not yet connected to the new GitHub repo — future deploys still require a
  manual `vercel deploy`/`--prod` until that's set up (a one-time follow-up, not done
  here since it changes production's deployment configuration).
- Preview deployments of this app currently need to either share production's KV (as
  done here, with manual cleanup) or get their own isolated KV instance for reliable
  future testing without any cleanup step — worth setting up if previews will be used
  repeatedly.
- The Phase 1 full 11-persona audit and a dedicated visual/terminology sweep beyond
  demo-blocking issues were out of scope for this pass, per your instructions.

## Do not deploy to production

No production deploy has been made or queued. Production (`naya-app`, the live
`naya-app-azure.vercel.app` deployment) is exactly as it was before this session.
