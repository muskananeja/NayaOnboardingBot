# NAYA — NIIT CAS Onboarding

NAYA guides Entry and Lateral Analysts through their first 90 days at NIIT CAS, and gives
admins a People view of everyone's progress. Live at https://naya-app-azure.vercel.app.

## What's here

- `public/index.html` — the analyst onboarding experience (served at `/`): six phases from
  Day 1 to Month 3, 24 tasks (12 required, 12 self-paced), Buddy and Coach contacts.
- `pages/dashboard.tsx` — the admin People view (sign in at `/login`).
- `pages/snapshot/[id].tsx` — an analyst's progress snapshot.
- `pages/api/*` — admin sign-in, analyst state sync and the analyst list.

## Deploying

The Vercel project is connected to this repository: merging to `main` deploys production
automatically. Other branches build Preview deployments, which never read production data
(see `lib/store.ts`).

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in SESSION_SECRET and ADMIN_PASSWORD_HASH
npm run dev
npm test
```
