# NAYA — NIIT CAS Onboarding

Admin dashboard + contractor/associate onboarding engine for NIIT CAS, deployed at
https://naya-app-azure.vercel.app.

## Branch note: `naya-admin-onboarding-reconciliation`

This branch replaces the repo's prior scaffold (`naya_niit_bot.html` + `src/flows`,
`src/tasks`, etc. on `main`) with the actual Next.js application currently running in
production. That scaffold predates the admin dashboard, auth, and contractor task
engine and was never updated to match what was deployed.

Production (`naya-app` on Vercel, project `prj_eXFau8CgJaskNN5XXwJ4B0PmCwmA`) has never
had a connected Git repository — every prior deployment was pushed directly via the
Vercel CLI from a local working copy, with no commit history. This branch is the first
attempt to give that app a real, reviewable source of truth. It was reconstructed from:
production's public `index.html`/`contacts.json` (pulled live), and the working
server-side code as it existed in a recent development session (contractor/associate
tri-state requirements, the unified People dashboard, the invite-link system, the task
engine). It has been typechecked, covered by an automated test suite, built for
production, and walked manually through the core admin + contractor demo journeys
against a local dev server — but it has **not** been diffed byte-for-byte against
whatever is live right now, because production's server-side source was never
retrievable to diff against.

Before this branch is treated as the permanent source of truth, connect this repo to
the Vercel project (`vercel git connect`) so future deploys are reviewable, and confirm
with a production smoke test that nothing regressed.

## Stack

Next.js (Pages Router) + Vercel KV (Redis), iron-session admin auth, a hashed/rotatable
contractor invite-token system, and a derived (never hand-edited) contractor/associate
task engine. See `lib/contractorTasks.ts` for the task-generation rules and
`DEMO_READINESS.md` for the current stakeholder-demo status.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in SESSION_SECRET and ADMIN_PASSWORD_HASH
npm run dev
```
