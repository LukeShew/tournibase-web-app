# Launch readiness — October 20, 2026

This is the current continuation record. Historical October 17 tests do not
verify the new pricing model. Production checkout stays disabled.

## Latest follow-up — October 20 evening

Mixed-tier/boundary and free checkout, exact partial/full refunds, pending-to-
success, later refund failure and app retry rejection, first admission,
duplicate/refunded-pass rejection, and scanner revocation passed in staging.
Orders 2046–2049 have sent receipt records. Temporary ticket options are inactive;
zero active scanner links remain. No real payments or camera use occurred.

The approved refund/dispute policy and free-pass refund-button fix are prepared
locally, not deployed. Latest validation: 439 tests/41 files, TypeScript, lint,
webpack build. Both hosted branches remain `f3b1b2f` (runtime `7ea3a1b`).
See [detailed evidence and updated launch gates](qa-launch-follow-up-2026-10-20.md).
Supabase Free lacks project backups and leaked-password protection; Vercel's
commercial-plan requirement is unresolved. Live director onboarding, pricing
activation and a genuine payment/payout remain outstanding.

## Completed this continuation

- Implemented Accounts v2 Express creation for `per_ticket_v2`, using
  per-request `2026-09-30.preview`, platform-paid processing and Stripe-owned
  connected-account losses. No fallback to a different risk/fee configuration.
- Added fresh, authenticated Express dashboard login links in Settings and
  order access. Historical orders use their original connected account.
  Full-dashboard accounts retain payment deep links; Express opens its
  dashboard because Stripe's login API has no payment deep-link parameter.
  Login redirects are private/no-store and do not log credential-bearing URLs.
- Added dashboard/loss responsibility synchronization and cached readiness
  checks, alongside the existing fresh Stripe check before paid Checkout.
- Applied refund-advance reporting migration `20261020195327` and account-cache
  migration `20261020195330`. The additive current-connection migration
  `20261020204507` and post-deploy transition migration `20261020204755`
  are applied (35 hosted). The latter's local draft timestamp `20261020204532`
  was renamed to match its hosted identity; do not apply it twice.
  The old local reporting timestamp `20261020064938` was renamed to match its
  hosted identity; do not apply it twice.
- Verified new columns, invoker reporting, denied direct metric execution for
  anon/authenticated, and unchanged routing for all 2,041 pre-transition orders.
- Full application suite passed 436 tests across 40 files. TypeScript, lint,
  production webpack build, all 35 migrations and three SQL suites passed.

## Provider state and immediate dependency

Separate Sandbox account `acct_1USX6aBDCy7Cmb69` accepts Express, Application
fee collection and Stripe loss collection. It is now the current staging
connection, with payments and payouts active after a fresh Stripe refresh.
The user completed hosted onboarding and selected Stripe's test bank. A fresh
Dashboard check confirms Express, Application fee collection and Stripe negative
balance collection. This verifies account readiness and configuration, not
actual bank payouts or live eligibility. Production connections are unchanged.

Existing `acct_1Tui4qBDCykX1MuY` remains the retained historical staging connection.
Incompatible accounts are not automatically replaced. A transition needs a
ready replacement and an explicit switch for future orders, preserving all
historical order IDs/routing. That transition is complete: only future purchases
use Express. Both connection records remain available for synchronization.

### Staging transition approval and safety checkpoint

The user approved switching future staging purchases to the isolated Express
account. A guarded direct update was rejected by the existing immutable-routing
trigger and rolled back. Inspection also found that the current order-integrity
trigger requires the current connection even for historical refund updates.
Do not disable these triggers or delete/replace the connection ad hoc.

The initial replace-and-archive approach was rejected by automated safety review
and never applied. The user approved a shared-database fix and deployment of both
branches. The revised approach retains BOTH original connection rows, flags only
one as `is_current`, and synchronizes webhooks by Stripe account ID rather than
overwriting an organization's connection. No connection or order is deleted.

Completed in order: additive migration `20261020204507`, matching app deployment
on both hosts (`7ea3a1b`), then `20261020204755`. The latter adds an admin-only Sandbox
transition, audit snapshot, expected owner/account checks, and an initially
unverified replacement. The private helper is inaccessible to anon,
authenticated and service_role and rejects live organizations. Historical order
updates still require the retained original connection; new orders require the
current connection. Existing routing immutability guards remain intact.

The 35-migration disposable run and all three SQL suites pass: historical refund
updates, new reservations, retired-account rejection, wrong-owner/live/stale
account rejection, and late webhook synchronization without account promotion.
Application suite: 436 tests across 40 files, plus lint and TypeScript pass.
The retired local timestamp `20261020203108` was replaced, not applied; do not
restore it. The guarded switch preserved the routing fingerprint
`f463758286e6948f973d3d0f837ed1c5` for every pre-transition order.

## Pricing and deployment gates

Approved buyer fee per paid pass: $1 through $10, otherwise $1 plus 4% of the
entire base price, rounded per unit. Free passes stay free. This fee includes
TourniBase's allowance for processing; do not add processing again. The
director retains base ticket value before refunds/disputes once Stripe bills
processing to the platform. Platform fee revenue is not net profit.

Matching source `7ea3a1b` is deployed and Ready on both hosts. Production still
has legacy 2% + $0.30 per order and checkout off. Staging now has the approved
per-ticket tiers; its October 20 settings redeployment is
`3YxhtgC8E8piWn8JjwmcUY5d9bUi` (Ready, stable staging domain assigned).

When ready, use matching code and these settings on both environments:
`TOURNIBASE_PLATFORM_FEE_POLICY=per_ticket_v2`,
`TOURNIBASE_PLATFORM_FEE_BPS=400`,
`TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=100`,
`TOURNIBASE_SANDBOX_FEE_QA_ENABLED=false`.
Keep production `TOURNIBASE_PAID_CHECKOUT_ENABLED=false` during QA.

## Remaining checklist

- [x] Finish isolated Sandbox business/bank onboarding and verify readiness.
- [x] Deploy matching reviewed application code; both builds and public smoke checks pass.
- [x] Validate compatible staging organization setup and safe historical routing.
- [x] Activate new tiers in staging only; live activation remains gated.
- [x] Sandbox mixed-tier/free/boundary purchases and exact saved fees; receipt
      submission and unique passes. Stripe allocation verified on order 2045.
- [x] Pass/full refunds, pending-to-success, failure correction and app retry
      rejection. A controlled low-balance/provider-reason check remains open;
      early fee return was observed, but is not exhaustive funding proof.
- [ ] New-director onboarding UI: on hold at the user's request; do not build yet.
- [ ] Full public/authenticated/mobile/gate QA, without camera.
- [x] User-approved refund/dispute/cancellation policy prepared with visible
      offer conditions; publication and legal/operating review remain open.
- [ ] Approve push and deploy this follow-up to both hosts.
- [ ] Commercial hosting, backup coverage and a successful recovery drill.
- [ ] Operational security review. Production npm audit: zero advisories.
      Full npm audit: five dev-only findings from the same unpatched braces
      advisory (GHSA-vfj7-8cjw-p6xm); no unsafe toolchain downgrade applied.
      Supabase leaked-password protection remains disabled; plan support and
      activation are still open. Service-only tables deny anon/authenticated
      reads. The metrics wrapper checks both owner and environment with an
      empty search path; its elevated privilege is intentional.
- [ ] Real director completes live Stripe setup; verify fees/payments/payouts.
- [ ] Explicit live checkout activation; observe first genuine purchase and
      bank payout before wider rollout.

## Deployment evidence and read-only follow-up

- Source: `7ea3a1b9894c6bc4f16e49988a16504b670d5171` on main and staging.
- Production: `BF5auph2JLpFAvQXrTEiaoZ7FaEx`, Ready, tournibase.com assigned.
- Staging: `3YxhtgC8E8piWn8JjwmcUY5d9bUi`, Ready, staging.tournibase.com assigned.
- Vercel production checkout switch was visibly false; no fee-policy variable
  existed in production. Only staging's fee policy, fixed fee and percentage
  changed; the Sandbox QA override remains false.
- Both home/login/legal/support pages return 200. Signed-out dashboard requests
  redirect to login; staging signup redirects to production. Staging retains
  noindex headers. robots.txt is absent (404); noindex does not depend on it.
- Current staging account refresh succeeded: Express dashboard,
  fees=application, losses=stripe, charges/payouts active. The old account remains
  stored but is not current. Fresh checkout used the new account.
- Sandbox order TB-002045: $46.24 base + $3.85 buyer fee = $50.09.
  Stripe's payment breakdown confirms $46.24 net for the director and $3.85
  application fee. Two unique passes were issued; the receipt delivery is sent.
  Single-pass refund returned $19.19 ($17.49 base + $1.70 fee), disabled only
  the Sunday pass and left $28.75 director net. After the user cleared the browser
  confirmation, the existing remaining-order refund was verified without retry:
  Stripe refunded $30.90 at 21:06 UTC. Total refunded is $50.09, including all
  $3.85 of the buyer/application fee; pending/failed amounts are zero and both
  passes are refunded. Stripe shows $0 director net. This verifies pass and full
  refunds, but does not by itself prove every pending/failure/low-balance branch.
  This is Sandbox evidence, not a live payout verification.
- Documentation/migration-identity commit `1992c64` subsequently reached Ready
  on both branches: production `H6bLbtgSFJdcDJQiQ53uYnzTrNxK` and staging
  `DV23RRc8tFwboK44FD4Tmh6j8Fxg`. Runtime code is unchanged from `7ea3a1b`.
- Post-transition security advisor adds only an expected RLS-with-no-policy
  informational notice for the private admin-only audit table. Existing
  leaked-password and intentional metrics-wrapper notices remain as above.
- Build warnings: npm's unknown cache-dir configuration warning, twice in staging.
  No build failure. Development advisory is separate from these warnings.
- [Braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): no published
  patched release as of this check; npm registry latest remains 3.0.3.

## Rules

Work only in the canonical TourniBase root and apps/tournibase-web-app. Commit
completed changes; never push the app without explicit permission. Pricing
main/staging deployment was authorized, but live checkout activation remains
gated. Root auto-push is overview-only; other unpushed root work needs permission.
Keep staging/production application code identical. Preserve these rules in
compaction. No camera and no fabricated live payments.

Sources: [preview risk configuration](https://docs.stripe.com/connect/risk-management),
[Express login links](https://docs.stripe.com/connect/integrate-express-dashboard),
[immutable account responsibilities](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration).
