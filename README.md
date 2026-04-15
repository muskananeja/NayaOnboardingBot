# NIIT CAS Onboarding Bot (Spec-Driven Core)

This repository contains a deterministic TypeScript core for the NIIT CAS onboarding bot.

## Included in this baseline

- Canonical task registry across PH0–PH5 with deduplicated shared weekly-connect task ID (`M1` reused by `S1` and `T1`).
- State schema and initializer.
- Transition guards (including immutable `COMPLETE` and non-skippable milestones).
- Progress computation with weighted in-progress credits.
- Dependency warning resolver (STRONG / WEAK / DEDUP checks).
- Resume summary model with fixed 3-option menu.
- Unit tests for key invariants.

## Run locally

```bash
npm install
npm test
```
