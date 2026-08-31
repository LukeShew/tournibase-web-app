# TourniBase Web MVP Implementation Roadmap

Last updated: August 31, 2026

## Current status

- Main product: TourniBase web MVP
- Completed: All 19 numbered phases
- Current production URL:
  [tournibase.com](https://tournibase.com)
- Payment status: Staging Connect direct charges use the onboarding Sandbox at
  a $0 TourniBase fee; production checkout remains disabled
- Environment rollout: Dual Vercel targets are deployed and both Supabase
  environment-isolation migrations are applied
- Transactional email: Live through Resend and end-to-end tested
- Offline access: Downloadable PNG for every paid pass
- Refund support: Basic organizer support flow and Stripe refund sync built
- Next phase: Configure live Stripe keys and webhooks, complete live director
  onboarding, then run the live payment gate
- Production signup: Supabase Auth and the trusted server organization-creation
  path are enabled and independently verified
- Not started: No numbered phases

The waitlist website and a native mobile app are postponed, separate products.
They are not part of this roadmap.

## Phase tracker

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Next.js, Supabase Auth, protected dashboard, database foundation | Complete |
| 2 | Tournament creation and director overview | Complete |
| 3 | Ticket type management | Complete |
| 4 | Public event page and publishing | Complete |
| 5 | Stripe Checkout, webhook, order fulfillment | Complete |
| 6 | Individual mobile passes and QR codes | Complete |
| 7 | Temporary scanner-link management | Complete |
| 8 | Mobile camera scanner and manual token entry | Complete |
| 9 | Atomic validation, duplicate blocking, override, undo | Complete |
| 10 | Buyer/order lookup and manual check-in | Complete |
| 11 | Persisted recent scanner activity | Complete |
| 12 | In-person gate-sale recording and gate access cleanup | Complete |
| 13 | Director sales and gate dashboards | Complete |
| 14 | Coach and parent sharing flow | Complete |
| 15 | Customer-facing product language and positioning | Complete |
| 16 | Product, architecture, schema, roadmap, setup, and test docs | Complete |
| 17 | Local-only seed and demo data | Complete |
| 18 | Install, lint, typecheck, build, and reasonable fixes | Complete |
| 19 | Final Git review, commit, and MVP handoff | Complete |

## Phase 17: Seed and demo data

Completed with a guarded `npm run seed` command that refuses hosted Supabase
URLs and creates:

- Tournament: **DMV Summer Tip-Off Classic**
- Venue: **Capital Sports Complex**
- Saturday Pass: **$20**
- Sunday Pass: **$20**
- Weekend Pass: **$30**
- Student/Child Pass: **$10**

The event dates automatically use the next Saturday and Sunday in
`America/New_York`. The command is idempotent, production pages contain no demo
data, and the automatic SQL seed contains permissions only, so it cannot copy
demo records to a hosted project.

See [Local Demo Data](./demo-data.md).

## Phase 18: Quality checks

Completed July 4, 2026. All required checks passed without code changes:

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

Dependency installation was already current. ESLint reported zero warnings,
TypeScript reported zero errors, and the optimized Next.js production build
compiled and generated its static pages successfully.

## Phase 19: Final Git and handoff

Completed July 4, 2026:

- Reviewed both repositories and confirmed they matched GitHub before Phase 19.
- Confirmed no real secrets or private environment files are tracked or present
  in Git history.
- Confirmed production and local migration histories matched at the July 4
  handoff. The later Connect and environment-isolation migrations have since
  been applied to hosted Supabase.
- Rebuilt and reseeded the local Docker database from scratch.
- Recorded final routes, environment variables, schema state, local test
  instructions, verification results, and known limitations in the
  [Final MVP Handoff](./mvp-handoff.md).

## Launch dependencies outside the numbered build phases

These are required before accepting real customer payments:

- Finish the remaining [staging and production rollout](./environment-rollout.md)
  verification; the dual deployment and both migrations are complete.
- Verify the permanent staging workspace, $0 application fee, forced test-email
  recipient, host isolation, refunds, and multi-director isolation.
- Configure live keys and both live webhook destinations with production
  checkout disabled.
- Have the pilot director complete hosted onboarding in live mode.
- Run one low-value live purchase using a real card and confirm the 2% plus
  30-cent TourniBase application fee.
- Confirm pass creation, email, scanning, duplicate blocking, refund email,
  refunded-pass rejection, and dashboard totals.
- Follow the basic support and refund procedure for tournament day.

## Known current limitations

- Pass-email delivery is live and has passed a Stripe test purchase.
- Full-order and pass-specific refunds are initiated in TourniBase, synchronized
  from the connected Stripe account, reflected in revenue, and followed by a
  buyer refund email.
- The staging/production split is deployed and the shared hosted database
  enforces the final `test`/`live` boundary. Live Stripe keys and production
  webhook destinations remain unfinished, so production checkout stays off.
- Saved pass PNGs work offline for buyers, but scanner devices still require
  internet for authoritative validation and duplicate prevention.
- Apple Wallet and Google Wallet passes are postponed.
- Gate sales record external payment; TourniBase does not process those charges.
- Pass-specific partial refunds are available from order details. Generic
  partial refunds created directly in Stripe remain order-level only.
- Dispute workflows are not automated.
- Ticket quantities use an atomic pending reservation during checkout.
- Staging public signup is disabled and redirects to production. Production
  Supabase Auth signup is enabled and independently verified, while direct
  authenticated organization inserts remain blocked.

## MVP-ready definition

The web MVP is ready for a controlled real tournament only when:

- Phase 17 demo data remains development-only.
- Phase 18 checks pass.
- Phase 19 handoff is complete.
- Transactional pass email remains healthy in production.
- The environment rollout is complete and Stripe live mode plus both live
  webhooks pass an end-to-end test.
- Stripe refund sync passes an end-to-end test.
- The event director can create tickets, publish, sell, scan, recover a buyer
  through lookup, and read the dashboard without developer intervention.

## Documentation update rule

After every completed phase or material product change:

1. Update the date, completed phase count, next phase, and remaining work here.
2. Update the same current-state block in
   [TourniBase Overview](./TourniBase%20Overview.md).
3. Update [README](../README.md) when setup, environment variables, routes, or
   test steps change.
4. Update the architecture or schema docs whenever code or migrations change.
