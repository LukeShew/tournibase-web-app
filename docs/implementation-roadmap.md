# TourniBase Web MVP Implementation Roadmap

Last updated: July 4, 2026

## Current status

- Main product: TourniBase web MVP
- Completed: Phases 1–16 of 19
- Current production URL:
  [tournibase-web-app.vercel.app](https://tournibase-web-app.vercel.app)
- Payment status: Stripe test mode
- Next phase: Phase 17, local-only seed and demo data
- Not started: Phases 17–19

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
| 12 | In-person gate-sale recording and checkout poster | Complete |
| 13 | Director sales and gate dashboards | Complete |
| 14 | Coach and parent sharing flow | Complete |
| 15 | Customer-facing product language and positioning | Complete |
| 16 | Product, architecture, schema, roadmap, setup, and test docs | Complete |
| 17 | Local-only seed and demo data | Not started |
| 18 | Install, lint, typecheck, build, and reasonable fixes | Not started |
| 19 | Final Git review, commit, and MVP handoff | Not started |

## Phase 17: Seed and demo data

Add a safe local/development demo flow for:

- Tournament: **DMV Summer Tip-Off Classic**
- Venue: **Capital Sports Complex**
- Saturday Pass: **$20**
- Sunday Pass: **$20**
- Weekend Pass: **$30**
- Student/Child Pass: **$10**

Demo data must not be hardcoded into production pages or inserted into the live
database by default.

## Phase 18: Quality checks

Run:

```bash
npm install
npm run lint
npm run typecheck
npm run build
```

Fix all reasonable failures. If a problem cannot be fixed within the phase,
record the exact error, likely cause, and recommended next action.

## Phase 19: Final Git and handoff

- Review the complete diff and repository status.
- Confirm no secrets or environment files are committed.
- Commit the final MVP state with a clear message.
- Provide the final routes, schema changes, environment variables, local test
  instructions, and known limitations.

## Launch dependencies outside the numbered build phases

These are required before accepting real customer payments:

- Add transactional email delivery for receipt and mobile pass links.
- Switch all Stripe variables and the production webhook to live mode together.
- Run one low-value live purchase using a real card.
- Confirm the live webhook marks the order paid and creates the correct passes.
- Open and scan every issued pass through a production scanner link.
- Confirm the director dashboard totals match Stripe and the gate results.
- Write a basic support and refund procedure for tournament day.

## Known current limitations

- Pass links appear on the success page but are not emailed automatically.
- Stripe is configured in test mode.
- Gate sales record external payment; TourniBase does not process those charges.
- Refund and dispute workflows are not automated.
- Ticket quantity limits are enforced during checkout, but this is not a
  reserved-inventory system for heavy concurrent demand.
- Director accounts are invite-only and created through Supabase.

## MVP-ready definition

The web MVP is ready for a controlled real tournament only when:

- Phase 17 demo data remains development-only.
- Phase 18 checks pass.
- Phase 19 handoff is complete.
- Transactional pass email is working.
- Stripe live mode and its webhook pass an end-to-end test.
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
