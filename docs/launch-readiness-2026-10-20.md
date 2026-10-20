# Launch readiness — October 20, 2026

This is the current continuation record. Historical October 17 tests do not
verify the new pricing model. Production checkout stays disabled.

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
  `20261020204507` is also applied (34 hosted); the post-deploy transition
  migration `20261020204532` remains pending below.
  The old local reporting timestamp `20261020064938` was renamed to match its
  hosted identity; do not apply it twice.
- Verified new columns, invoker reporting, denied direct metric execution for
  anon/authenticated, and unchanged 2,041 orders (zero new-tier orders).
- Full application suite passed 434 tests across 40 files. TypeScript, lint,
  production webpack build, all migrations and both SQL suites passed.

## Provider state and immediate dependency

Separate Sandbox account `acct_1USX6aBDCy7Cmb69` accepts Express, Application
fee collection and Stripe loss collection. It is unlinked to TourniBase,
has no payments, and now shows Enabled with payments and payouts active.
The user completed hosted onboarding and selected Stripe's test bank. A fresh
Dashboard check confirms Express, Application fee collection and Stripe negative
balance collection. This verifies account readiness and configuration, not
fee settlement, refunds, actual payouts or live
eligibility. No existing connected account has been changed.

Existing `acct_1Tui4qBDCykX1MuY` remains the original staging connection.
Incompatible accounts are not automatically replaced. A transition needs a
ready replacement and an explicit switch for future orders, preserving all
historical order IDs/routing. That transition has not happened.

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

Apply in order: additive migration `20261020204507` (done), deploy matching app
code on both hosts, then `20261020204532`. The latter adds an admin-only Sandbox
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
restore it. Staging's switch and tiered purchase/refund acceptance are still pending.

## Pricing and deployment gates

Approved buyer fee per paid pass: $1 through $10, otherwise $1 plus 4% of the
entire base price, rounded per unit. Free passes stay free. This fee includes
TourniBase's allowance for processing; do not add processing again. The
director retains base ticket value before refunds/disputes once Stripe bills
processing to the platform. Platform fee revenue is not net profit.

Matching pricing/Express source `d44431a` is deployed and Ready on both hosts. Production still has legacy 2% + $0.30 per order and checkout off;
staging has legacy $0 fees. New pricing has not been activated.

When ready, use matching code and these settings on both environments:
`TOURNIBASE_PLATFORM_FEE_POLICY=per_ticket_v2`,
`TOURNIBASE_PLATFORM_FEE_BPS=400`,
`TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=100`,
`TOURNIBASE_SANDBOX_FEE_QA_ENABLED=false`.
Keep production `TOURNIBASE_PAID_CHECKOUT_ENABLED=false` during QA.

## Remaining checklist

- [x] Finish isolated Sandbox business/bank onboarding and verify readiness.
- [x] Deploy matching reviewed application code; both builds and public smoke checks pass.
- [ ] Validate compatible organization setup and safe historical routing.
- [ ] Activate new tiers in coordinated environment rollout.
- [ ] Sandbox mixed-tier/free/boundary purchases; verify processing payer,
      platform fee, director proceeds, receipt and individual passes.
- [ ] Pass/full/low-balance refunds; pending/failure/retry and exact accounting.
      Local funding code is not Stripe acceptance evidence.
- [ ] New-director onboarding UI: on hold at the user's request; do not build yet.
- [ ] Full public/authenticated/mobile/gate QA, without camera.
- [ ] Final refund/dispute/cancellation policy and clear offer conditions.
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

- Source: `d44431aa5dfc579f131d1c8b6df7b17ed0c7039d` on main and staging.
- Production: `FZH892j5YLpi5GnRYG3L8dJ1qnTq`, Ready, tournibase.com assigned.
- Staging: `7UdxPL95LkJQasjgsne17a9Tu1Vq`, Ready, staging.tournibase.com assigned.
- Vercel production checkout switch was visibly false; no fee-policy variable
  existed. No deployment environment variables were changed.
- Both home/login/legal/support pages return 200. Signed-out dashboard requests
  redirect to login; staging signup redirects to production. Staging retains
  noindex headers. robots.txt is absent (404); noindex does not depend on it.
- Existing staging account refresh succeeded on deployed code and remained Ready.
  Fresh cache: full dashboard, fees=stripe, losses=stripe, charges/payouts active.
  This confirms it is still legacy; it is NOT compatible with director-free tiers.
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
