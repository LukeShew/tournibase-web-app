# TourniBase Overview

Last updated and verified against the local repository: August 31, 2026

## Current direction

TourniBase is currently a web-based digital gate system for youth basketball
tournaments.

TourniBase’s long-term goal is to become the go-to admissions operating system
for youth sports tournaments. The broader vision is not limited to basketball.

The current wedge is intentionally narrow: youth basketball tournament
admission control. TourniBase focuses on shorter, smoother entry lines and
fraud prevention through reliable pass validation and duplicate-use blocking.

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
| Progress | All 19 numbered phases complete |
| Current phase | Final Stripe live-mode setup and pilot readiness |
| Next phase | Configure live keys and webhooks, complete live onboarding, then run the first live-payment gate |
| Production app | [tournibase.com](https://tournibase.com) |
| Payments | Direct charges to director accounts; staging uses the Sandbox and production is isolated for live Connect with paid checkout disabled |
| Environment split | Deployed with one Vercel project and one Supabase project; organizations are isolated as `test` or `live` |
| Database | Isolation migrations `20260829002309` and `20260831003839`, plus trusted-signup grant migration `20260831024917`, applied |
| Email | Live through Resend and end-to-end tested |
| Offline access | Downloadable pass PNG for Photos or Files |
| Refund support | TourniBase full-order and pass-specific refunds with connected-account webhook synchronization |
| Legal/support pages | Footer links to Terms, Privacy, Refund Policy, and Support |
| Launch dependency | Configure live Stripe keys and webhooks, complete director live onboarding, and pass a controlled purchase/scan/refund test |

No numbered phases remain. See the [Final MVP Handoff](./mvp-handoff.md) for
routes, environment variables, database state, local testing, and launch work.

Before accepting real customer payments, TourniBase must finish the remaining
[staging and production rollout](./environment-rollout.md) checks, configure the
live webhooks and keys, have the pilot director complete live onboarding, and
pass one controlled real-money purchase, email, gate, duplicate-scan, and refund
test.

Keep this section current after every phase or material product change. The
[Implementation Roadmap](./implementation-roadmap.md) is the detailed progress
tracker.

## Current product capabilities

### Director tools

- Public production signup with email confirmation and protected password login
  is active; Supabase Auth reports `disable_signup: false`, and its trusted
  server database path was independently verified on August 31, 2026
- Disabled public signup on the permanent staging environment
- Protected dashboard and organization ownership
- Tournament creation with venue, dates, organizer, contact, and public slug
- Ticket type creation, editing, activation, and deactivation
- Draft and published event controls
- Organization-level Stripe Connect onboarding in Payments settings
- Paid-event publishing controls that require a connected account ready for
  charges and payouts; free-only events do not require Connect
- Temporary, revocable scanner links with permission levels
- Sales, revenue, admission, and gate-activity dashboards
- Coach and parent sharing tools

### Buyer tools

- Public tournament ticket page
- Ticket quantity selection and buyer contact collection
- Stripe-hosted direct-charge checkout on the event organizer's connected
  account, scoped to the application's test or live environment
- One individual mobile pass per purchased admission
- Branded QR code on each pass
- Pass delivery by email
- TourniBase refund confirmation email after Stripe refund webhook
- Offline pass image save flow for weak-service backup
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
3. A parent opens the public event page and pays through Stripe Checkout. The
   event organizer is the seller and merchant of record.
4. A verified Stripe success event marks the order paid and creates one pass per
   admission.
5. TourniBase emails every mobile pass and device-save link through Resend.
6. The buyer can open each mobile pass from the success page or save it to
   Photos or Files before arriving.
7. Gate staff open a temporary scanner link and scan the QR.
8. Postgres validates the scanner, tournament, payment, pass state, valid date,
   and prior admissions in one atomic operation.
9. A valid pass is admitted. A second use is blocked as already scanned.
10. The director reviews sales and gate activity from the dashboard.
11. If an order is refunded, TourniBase scopes the refund to the order's
    connected Stripe account, reverses any application fee, syncs the refund
    state, emails the buyer, and fully invalidates active or checked-in passes
    on full refunds.

The branded email template and retry-safe Resend delivery system are live. The
success page remains the backup retrieval method.

## Current product boundary

The web MVP is an admission product. It is not full tournament management.

Not included:

- Scheduling or brackets
- Team registration or rosters
- Scores or standings
- Referee or gym scheduling
- Full card-terminal point of sale
- Self-serve refund portal
- Automated dispute handling

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
- Stripe Accounts v2 hosted onboarding for one connected account per
  organization
- Direct-charge Stripe Checkout with immutable connected-account routing on
  each order
- Separate signed webhooks for connected payments and Connect account status
- Connected-account refund sync into order and pass statuses
- TourniBase refund confirmation emails
- React Email template rendering with provider-neutral delivery tracking
- Server Components and Server Actions for protected data and mutations
- Temporary scanner credentials stored only as SHA-256 hashes
- Individual pass UUIDs resolved only through server-controlled pass and scanner
  flows
- Tournament-local time-zone handling, currently defaulting to
  `America/New_York`
- One Vercel project with `main` for production and a branch-scoped `staging`
  target
- One canonical Supabase project with immutable organization environment
  routing
- Test checkout at a $0 application fee; live checkout at exactly 2% plus 30
  cents after its launch gate

The environment-isolation application code is deployed to staging and
production. Its additive and contract migrations are applied to the shared
Supabase project.

See [MVP Architecture](./mvp-architecture.md) and
[Database Schema](./database-schema.md) for implementation details.

## Security status

- All 13 public application tables have RLS enabled in the current schema.
- Public event and ticket reads move through the server-side,
  environment-aware data layer; the old anonymous Data API policies are
  removed.
- Orders, passes, scanner sessions, check-ins, manual sales, and email delivery
  records are not anonymously readable.
- Director data is restricted through organization ownership.
- Organization ownership and test/live routing are immutable.
- The Supabase secret key and Stripe secret keys stay on the server.
- Scanner links expire and can be revoked.
- Gate validation functions are unavailable to anonymous and authenticated
  browser roles.
- Stripe card details never pass through TourniBase.

## Known limitations

- Live Stripe API keys and the two production webhook destinations are not yet
  configured. Production paid checkout remains disabled until that setup,
  director live onboarding, and the controlled real-money test are complete.
- Production Supabase Auth signup is enabled and independently verified. The
  trusted organization-creation grant is restored, while direct authenticated
  organization inserts remain blocked.
- Sandbox and live connected accounts are separate, so every production
  director must complete live onboarding before the first tournament.
- TourniBase does not hold tournament proceeds. Stripe deducts processing fees
  from the director's connected account and controls bank payout timing.
- Staging charges no TourniBase fee. Production is configured for exactly 2%
  plus 30 cents once its paid-checkout kill switch is enabled.
- Directors create accounts only from the production signup page; staging
  `/signup` remains disabled and redirects to production.
- The signed-out staging entrance uses the normal public design, exposes no
  test-event listing or staging label, and is marked not to be indexed.
- Supabase leaked-password protection is unavailable on the current plan, so
  directors must use strong, unique passwords.
- Gate-sale recording tracks external payment but does not charge a card.
- Full Stripe refunds automatically invalidate active or checked-in passes and
  send the buyer a refund confirmation email.
- Directors can refund a specific paid pass from order details. Generic partial
  refunds created directly in Stripe cannot identify a specific pass.
- Dispute operations are not automated.
- The permanent staging workspace contains hosted test tournaments and orders.
  A separate guarded seed command remains available for local development.
- Saved pass images work without buyer internet, but scanner devices still need
  internet to prevent duplicate or reused entry.
- Apple Wallet and Google Wallet passes are postponed.
- All numbered build phases are complete.

## Documentation

- [Web MVP Product Plan](./mvp-product-plan.md)
- [MVP Architecture](./mvp-architecture.md)
- [Database Schema](./database-schema.md)
- [Local Demo Data](./demo-data.md)
- [Implementation Roadmap](./implementation-roadmap.md)
- [Transactional Email](./transactional-email.md)
- [Refund and Support Process](./refund-support.md)
- [Final MVP Handoff](./mvp-handoff.md)
- [Staging and Production Rollout](./environment-rollout.md)
- [Repository setup and test guide](../README.md)
