# TourniBase Overview

Last updated and verified: July 4, 2026

## Current direction

TourniBase is currently a web-based digital gate system for youth basketball
tournaments.

The web MVP in this repository is the main product. It is built to let
tournament directors:

- Sell spectator passes online
- Deliver individual mobile passes
- Scan guests in quickly on ordinary phones
- Block duplicate and invalid tickets
- Recover buyers through order lookup
- Track sales, attendance, and gate activity

The goal is to validate this product with real East Coast tournament directors
before expanding into a larger platform.

## MVP status

| Item | Current state |
| --- | --- |
| Progress | Phases 1–16 of 19 complete |
| Current phase | Phase 16 documentation complete |
| Next phase | Phase 17 local-only demo data, not started |
| Production app | [tournibase-web-app.vercel.app](https://tournibase-web-app.vercel.app) |
| Payments | Stripe test mode |
| Database | Live Supabase schema matches all 11 committed migrations |
| Launch dependency | Production receipt and pass-link email delivery |

Remaining numbered phases:

1. Phase 17: local-only seed and demo data.
2. Phase 18: install, lint, typecheck, build, and reasonable fixes.
3. Phase 19: final Git review and MVP handoff.

Before accepting real customer payments, TourniBase must also add transactional
pass email, switch Stripe and the production webhook to live mode, and complete
one real end-to-end purchase and gate test.

Keep this section current after every phase or material product change. The
[Implementation Roadmap](./implementation-roadmap.md) is the detailed progress
tracker.

## What is live now

### Director tools

- Invite-only Supabase password login
- Protected dashboard and organization ownership
- Tournament creation with venue, dates, organizer, contact, and public slug
- Ticket type creation, editing, activation, and deactivation
- Draft and published event controls
- Temporary, revocable scanner links with permission levels
- Sales, revenue, admission, and gate-activity dashboards
- Coach and parent sharing tools
- Printable public-checkout gate poster

### Buyer tools

- Public tournament ticket page
- Ticket quantity selection and buyer contact collection
- Stripe-hosted test checkout
- One individual mobile pass per purchased admission
- Branded QR code on each pass
- Clear event, ticket, validity, venue, order, and support information

### Gate tools

- Mobile camera scanning
- Manual pass-link or token entry
- Server-authoritative admission decisions
- Atomic duplicate blocking
- Reasoned duplicate overrides
- Check-in undo
- Buyer and order lookup
- Manual pass check-in
- Persisted recent scanner activity
- Optional cash, Venmo, external-card, and comp sale recording

### Reporting

- Gross online sales and estimated payout
- Online and manual admission totals
- Revenue by ticket type and day
- Successful, duplicate, invalid, and wrong-day scan totals
- Manual check-in and override totals
- Active scanner-link and unscanned-pass totals

## Core end-to-end flow

1. A director logs in and creates a tournament.
2. The director creates active ticket types and publishes the event.
3. A parent opens the public event page and pays through Stripe Checkout.
4. A verified Stripe success event marks the order paid and creates one pass per
   admission.
5. The buyer opens each mobile pass from the success page.
6. Gate staff open a temporary scanner link and scan the QR.
7. Postgres validates the scanner, tournament, payment, pass state, valid date,
   and prior admissions in one atomic operation.
8. A valid pass is admitted. A second use is blocked as already scanned.
9. The director reviews sales and gate activity from the dashboard.

Production pass-link email is not built yet. The success-page links are the
current delivery method.

## Current product boundary

The web MVP is an admission product. It is not full tournament management.

Not included:

- Scheduling or brackets
- Team registration or rosters
- Scores or standings
- Referee or gym scheduling
- Full card-terminal point of sale
- Automated refunds and disputes

## Postponed work

### Waitlist website

The existing waitlist site is a separate repository, Vercel project, Supabase
project, and local checkout. Work on it is postponed. It is not the current MVP
and should not drive current product decisions.

### Native app

The long-term direction may pivot toward a native iOS and Android app. That work
is postponed until the web MVP proves the core admission workflow with real
customers. The current product should remain web-first so directors, buyers, and
gate staff can use it without installing anything.

## Current architecture

- Next.js App Router web app deployed on Vercel
- Supabase Auth, Postgres, Row Level Security, and migration-managed schema
- Stripe-hosted Checkout and signed webhook processing
- Server Components and Server Actions for protected data and mutations
- Temporary scanner credentials stored only as SHA-256 hashes
- Individual pass UUIDs resolved only through server-controlled pass and scanner
  flows
- Tournament-local time-zone handling, currently defaulting to
  `America/New_York`

See [MVP Architecture](./mvp-architecture.md) and
[Database Schema](./database-schema.md) for implementation details.

## Security status

- All 10 public application tables have RLS enabled.
- Anonymous users can read only published tournaments and active ticket types.
- Orders, passes, scanner sessions, check-ins, and manual sales are not
  anonymously readable.
- Director data is restricted through organization ownership.
- The Supabase secret key and Stripe secret keys stay on the server.
- Scanner links expire and can be revoked.
- Gate validation functions are unavailable to anonymous and authenticated
  browser roles.
- Stripe card details never pass through TourniBase.

## Known limitations

- Automated receipt and pass-link email is not implemented.
- Stripe remains in test mode.
- Director accounts are created manually through Supabase.
- Gate-sale recording tracks external payment but does not charge a card.
- Refund and dispute operations are not automated.
- Demo data is not available yet.
- Final quality and release checks remain in Phases 18 and 19.

## Documentation

- [Web MVP Product Plan](./mvp-product-plan.md)
- [MVP Architecture](./mvp-architecture.md)
- [Database Schema](./database-schema.md)
- [Implementation Roadmap](./implementation-roadmap.md)
- [Repository setup and test guide](../README.md)
