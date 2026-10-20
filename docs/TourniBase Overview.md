# TourniBase Overview

> October 20 launch work: matching account-transition code `7ea3a1b` is deployed
> on both hosts. All 35 migrations are applied. Staging now uses Express with
> platform-paid processing, Stripe-owned connected-account losses and the approved
> per-ticket fees. Historical orders keep their original account. Sandbox purchase
> and pass/full-order refund checks passed; remaining acceptance is tracked below.
> Production pricing is unchanged and checkout stays disabled. Onboarding UI is on hold
> at the user's request. See [current launch checklist](launch-readiness-2026-10-20.md).

Last updated against local implementation and recorded hosted checks: October 20, 2026

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
| Current phase | Investigate the selected Express model's preview eligibility and validate the pending per-ticket pricing release |
| Next phase | Finish payment acceptance and live pilot readiness; new-director onboarding UI is on hold at the user's request |
| Production app | [tournibase.com](https://tournibase.com) |
| Payments | Direct charges to director accounts; staging uses the Sandbox and production is isolated for live Connect with paid checkout disabled |
| Environment split | Deployed with one Vercel project and one Supabase project; organizations are isolated as `test` or `live` |
| Database | 35 hosted/local migrations, including tier snapshots, refund-advance reporting, and retained account history; no historical repricing |
| Email | Live through Resend and end-to-end tested |
| Offline access | Downloadable pass PNG for Photos or Files |
| Refund support | TourniBase full-order and pass-specific refunds with connected-account webhook synchronization |
| Legal/support pages | Footer links to Terms, Privacy, Refund Policy, and Support |
| Launch dependency | Resolve platform-paid processing and insufficient-balance refunds, deploy and validate the new pricing, complete live director onboarding, explicitly enable checkout, and obtain genuine pilot payment/payout evidence |

No original numbered MVP phases remain. The pricing change and guided setup
below are later work, not completed phases. See the [Final MVP Handoff](./mvp-handoff.md) for
routes, environment variables, database state, local testing, and launch work.

### October 20 pricing release — staging active, live checkout off

The user selected a buyer fee **per paid ticket**:

- Base price $10 or less: $1.
- Base price above $10: $1 plus 4% of the **whole** base price, rounded to cents
  per ticket—not 4% of only the amount above $10.
- Free tickets: $0.

The intended director proceeds equal the full base ticket price, with Stripe
processing charged to TourniBase. The buyer fee is not all profit: processing
and other platform costs come out of it. Both staging and production will use
the same tiers; staging transactions remain Sandbox-only.

Express account creation now uses the per-request `2026-09-30.preview`
API with platform-paid processing and Stripe-owned losses. Authenticated
Express login links, full-dashboard compatibility, original-account routing
for historical orders, and cached/fresh fee-and-loss checks are implemented.
No existing connected account is replaced automatically.

The isolated Sandbox account `acct_1USX6aBDCy7Cmb69` accepted this configuration.
The user completed hosted onboarding. Stripe now shows payments and payouts
active, Express dashboard, Application fee collection and Stripe negative-balance
collection. It now handles future staging purchases; the old account remains
stored for historical orders. All 2,041 pre-transition order routes are unchanged.
No production account was switched.

All 35 migrations are applied, including `20261020204507` and `20261020204755`
for retained account history and an admin-only Sandbox switch. Local draft
migration timestamps were renamed to their hosted identities; never apply twice.
Local validation passed 436 tests across 40 files, TypeScript, ESLint, production
webpack build, all migrations and three SQL suites.

Matching application source `7ea3a1b` is Ready on both hosts. Production retains
legacy 2% + $0.30 per order with paid checkout off. Staging has `per_ticket_v2`
with 400 BPS, 100 fixed cents and the Sandbox QA override false. Order TB-002045
proved $46.24 director net from a $50.09 payment with a $3.85 buyer/application
fee, two unique passes and a sent receipt. Its $19.19 single-pass refund returned
exactly $1.70 of the fee. The remaining $30.90 was then refunded successfully:
all $50.09 and $3.85 of fees returned, both passes refunded, nothing pending/failed.
Further refund edge cases and live eligibility are tracked
in the launch checklist; Sandbox evidence is not a live payout verification.

The current actionable gates are tracked in
[launch readiness](launch-readiness-2026-10-20.md). New-director onboarding
concepts exist, but implementation is on hold at the user's request.

### Historical deployed acceptance — October 17

Live Stripe keys, separate webhook destinations, and dedicated card-only
Checkout configurations are configured. The payment-method configuration is
saved in Production for live mode and Preview restricted to the staging branch
for Sandbox. Cards and eligible Apple Pay/Google Pay are enabled; other methods
and connected-account customization are disabled.

The fee/refund/checkout release, strict maintenance guard, and refund synchronization follow-up `7425b18` are deployed to both environments;
both Vercel deployments are Ready. The eight-event connected-payment webhook
subscriptions are saved and verified in both Stripe environments. Hosted
Sandbox orders `2040`–`2043` verified partial/full, pending-to-success,
later-failed, and fee-inclusive refunds with delivered receipts. The approved
fee run verified collection and full refund of the $1.22 application fee.
Staging's zero-fee restoration is verified in Vercel and on the redeployed
stable ticket page. Production paid checkout remains disabled, and there is not
yet a live director organization/connected account ready to sell. Complete the
[staging and production rollout](./environment-rollout.md) checks and real
director onboarding before enabling an authorized pilot. Use a genuine
admission purchase for live validation, not a fabricated live payment. Sandbox
is the place for repeatable purchase, refund, and admission scenarios.

The user deferred real director onboarding to a later session. Keep production
checkout disabled; no onboarding action is required from the user now.

Final source follow-up `f6be6cd` fixes director Stripe Dashboard URL ordering
and failed-refund guidance; it is locally verified and deployed Ready on both
hosts. Local checks passed 277 tests across 34 files,
ESLint, TypeScript, a production webpack build,
all 30 migrations, and the rollback SQL regression. These results do not
establish that production is 100% ready or guarantee a director's bank payout.

The later refund synchronization follow-up `7425b18` passed 295 tests across
35 files, lint, TypeScript, and the production webpack build; its matching
deployments are verified Ready. It retries competing refund-state updates with
fresh snapshots, distinguishes accepted-but-synchronizing refunds from failed
refunds, and keeps open order details current after refresh. The log review
that triggered it found an order-2043 webhook/refund-route error that recovered
automatically about 17 seconds later; final money and receipts were correct.
The rollout receipt records the verified deployment IDs; configuration is
unchanged, with production checkout disabled and staging's fee at zero.

Keep this section current after every phase or material product change. The
[Implementation Roadmap](./implementation-roadmap.md) is the detailed progress
tracker.

## Competition and position

The intended customer is an independent youth basketball director who wants
admissions without replacing scheduling or team registration. This is a
competitive market: Exposure already combines tournament tools with QR gate
admission; GoFan explicitly serves youth/club tournaments; Hometown Box Office
and Eventlink offer school-oriented operations; Ticket Tailor is a standalone
ticketing alternative; Eventbrite adds broad event discovery. SportsEngine
Tourney is an adjacent tournament-operations product.

QR tickets and app-free buying are not unique advantages. TourniBase must prove
easy setup, reliable connected payments, clear gate decisions, reconciliation,
and event-day support. It currently lacks true offline gate validation and
native Wallet passes. Do not claim lowest total cost or no director fees:
Stripe processing still comes from the director's proceeds.

The pending October 20 model is intended to remove ordinary processing
deductions from director proceeds, but that claim is not yet verified or active.
Refund/dispute exceptions and prominent customer-facing wording still need a
separate policy decision; changing Terms alone does not complete that work.

The October 17 [source-backed market report](../../../docs/market-competition-2026-10-17.md)
contains current official pricing, feature limits, vendor/brand corrections,
and pilot measurements. It also flags prominent upfront fee-inclusive ticket
pricing as a launch requirement; this documentation is not legal certification.

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
- Fee-inclusive one-pass offers and a full-order total before buyer details;
  the deployed legacy fixed fee is charged once per order. The pending release
  instead sums immutable per-ticket fees
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

This describes the currently deployed legacy pricing. The October 20
per-ticket replacement above has not been activated.

1. A director logs in and creates a tournament.
2. The director creates active ticket types and publishes the event.
3. A parent opens the public event page and pays through Stripe Checkout. The
   event organizer is the seller and merchant of record. In production,
   TourniBase adds 2% of the admission subtotal plus $0.30 once per paid order.
   A $10 admission costs the buyer $10.50; TourniBase receives $0.50 and the
   director has $10 before Stripe processing. Staging and free orders have no
   TourniBase fee.
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
    successful refund state, emails the buyer, and invalidates active or
    checked-in passes on successful full refunds. Pass refunds include the
    allocated buyer fee. Pending/failed attempts are not completed refunds;
    failed attempts require Stripe/support review and do not restore blocked
    passes automatically.

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

### Next phase: guided director introduction and setup

The user requested a Canva-like introduction for new accounts, explaining the
app and guiding important setup such as connecting Stripe and creating the
first event. Queue this after the payment model is resolved. It is not
implemented, and no decision has been made to require completion before
directors can use the app. Keep the same introduction, UI, routes, and behavior
on staging and production, aside from the intentional environment boundaries.

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
- Staging uses the approved per-ticket buyer fee and platform-paid processing; production's
  legacy configuration is 2% plus 30 cents per paid order, with checkout off.
  opt-in `per_ticket_v2` policy is implemented identically on both sites and
  requires verified platform-paid processing before activation
- Dedicated environment-specific Checkout payment-method configurations, with
  card methods and eligible card wallets only
- Immutable buyer-fee snapshots, exact pass-level fee refunds, and versioned
  reconciliation of succeeded, pending, and failed refund amounts

The environment-isolation application code is deployed to staging and
production. Its additive and contract migrations are applied to the shared
Supabase project. The October buyer-fee/refund-lifecycle migrations and October
20 tiered snapshot migration are applied. Matching `7425b18` deployments
reached Ready on October 17; the current application source is `7ea3a1b` on both
sites. The October 17 Sandbox refund cases and zero-fee restoration are
verified. The October 20 tiers are active in staging with Express. Purchase
allocation, receipt/pass fulfillment and pass/full-order refunds passed; remaining
refund acceptance and live configuration are tracked in the launch checklist.
Real-director launch preparation remains deferred.

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

- Live Stripe API keys, both production webhook destinations, and dedicated
  payment-method configurations are configured. Production paid checkout
  remains disabled pending verification of the selected payment model and real director
  onboarding. No live director organization/connected account is ready yet;
  genuine pilot payment and payout evidence remain outstanding.
- Production Supabase Auth signup is enabled and independently verified. The
  trusted organization-creation grant is restored, while direct authenticated
  organization inserts remain blocked.
- Sandbox and live connected accounts are separate, so every production
  director must complete live onboarding before the first tournament.
- Under the deployed legacy setup, Stripe deducts processing fees from the
  director's connected account and controls bank payout timing. The pending
  release must verify TourniBase as processing payer before a tiered paid sale.
- Staging charges no TourniBase fee. Production is configured for exactly 2%
  of admission subtotal plus 30 cents once per paid order, paid on top by the
  buyer once its paid-checkout kill switch is enabled. Reports exclude this
  buyer fee from director ticket revenue.
- The deployed strict maintenance guard can temporarily
  permit that same 2% plus $0.30 fee in Sandbox for an explicitly authorized
  purchase/refund acceptance run. `TOURNIBASE_SANDBOX_FEE_QA_ENABLED=true`
  requires test mode, exact fee values, and the hosted staging/Preview boundary;
  it is rejected in live mode. Normal staging stays fee-free, and the run must
  finish by restoring the flag to `false`, both fee values to zero, redeploying,
  and verifying restoration. The approved order `2043` completed its fee/refund
  checks, and zero-fee restoration is verified on the Ready redeployment and
  stable ticket page. This changes no real-money routing or SQL schema.
  See the [maintenance procedure](./environment-rollout.md#temporary-sandbox-fee-acceptance-procedure).
- Directors create accounts only from the production signup page; staging
  `/signup` remains disabled and redirects to production.
- The signed-out staging entrance uses the normal public design, exposes no
  test-event listing or staging label, and is marked not to be indexed.
- Supabase leaked-password protection is unavailable on the current plan, so
  directors must use strong, unique passwords.
- Gate-sale recording tracks external payment but does not charge a card.
- Successful full Stripe refunds invalidate active or checked-in passes and
  send the buyer a refund confirmation email.
- Directors can refund a specific paid pass from order details. Generic partial
  refunds created directly in Stripe cannot identify a specific pass.
- Pending/failed refunds are separate from completed refund totals. Failed
  attempts need manual review and do not automatically reactivate blocked
  passes. The payment destination must also subscribe to `refund.created`,
  `refund.updated`, and `refund.failed`.
- Dispute operations are not automated.
- The permanent staging workspace contains hosted test tournaments and orders.
  A separate guarded seed command remains available for local development.
- Saved pass images work without buyer internet, but scanner devices still need
  internet to prevent duplicate or reused entry.
- Apple Wallet and Google Wallet passes are postponed.
- All numbered build phases are complete.

## Documentation

- [Payment readiness QA](./qa-payment-readiness-2026-10-17.md)
- [Public-site QA](./qa-public-sites-2026-10-17.md)

- [Web MVP Product Plan](./mvp-product-plan.md)
- [MVP Architecture](./mvp-architecture.md)
- [Database Schema](./database-schema.md)
- [Local Demo Data](./demo-data.md)
- [Implementation Roadmap](./implementation-roadmap.md)
- [Transactional Email](./transactional-email.md)
- [Refund and Support Process](./refund-support.md)
- [Final MVP Handoff](./mvp-handoff.md)
- [Staging and Production Rollout](./environment-rollout.md)
- [Pending Pricing and Next-Phase Handoff](./pricing-handoff-2026-10-20.md)
- [Repository setup and test guide](../README.md)
