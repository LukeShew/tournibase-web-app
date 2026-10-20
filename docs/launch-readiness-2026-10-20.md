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
  migration `20261020195330`. Shared Supabase and local schema have 33 migrations.
  The old local reporting timestamp `20261020064938` was renamed to match its
  hosted identity; do not apply it twice.
- Verified new columns, invoker reporting, denied direct metric execution for
  anon/authenticated, and unchanged 2,041 orders (zero new-tier orders).
- Full application suite passed 434 tests across 40 files. TypeScript, lint,
  production webpack build, all migrations and both SQL suites passed.

## Provider state and immediate dependency

Separate Sandbox account `acct_1USX6aBDCy7Cmb69` accepts Express, Application
fee collection and Stripe loss collection. It is unlinked to TourniBase,
has no payments, and has incomplete requirements. The user approved the
Sandbox agreement and fake identity submission; phone and identity steps are
complete. Business/bank setup remains, and embedded form controls currently
require a manual browser handoff. This verifies
configuration acceptance only, not fee settlement, refunds, payouts or live
eligibility. No existing connected account has been changed.

Existing `acct_1Tui4qBDCykX1MuY` remains the original staging connection.
Incompatible accounts are not automatically replaced. A transition needs a
ready replacement and an explicit switch for future orders, preserving all
historical order IDs/routing. That transition has not happened.

## Pricing and deployment gates

Approved buyer fee per paid pass: $1 through $10, otherwise $1 plus 4% of the
entire base price, rounded per unit. Free passes stay free. This fee includes
TourniBase's allowance for processing; do not add processing again. The
director retains base ticket value before refunds/disputes once Stripe bills
processing to the platform. Platform fee revenue is not net profit.

Last verified hosted source is `ab2db87`; pricing/Express changes are pending
deployment. Production still has legacy 2% + $0.30 per order and checkout off;
staging has legacy $0 fees. New pricing has not been activated.

When ready, use matching code and these settings on both environments:
`TOURNIBASE_PLATFORM_FEE_POLICY=per_ticket_v2`,
`TOURNIBASE_PLATFORM_FEE_BPS=400`,
`TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=100`,
`TOURNIBASE_SANDBOX_FEE_QA_ENABLED=false`.
Keep production `TOURNIBASE_PAID_CHECKOUT_ENABLED=false` during QA.

## Remaining checklist

- [ ] Finish isolated Sandbox business/bank onboarding and verify readiness.
- [ ] Deploy matching reviewed application code; verify both builds/hosts.
- [ ] Validate compatible organization setup and safe historical routing.
- [ ] Activate new tiers in coordinated environment rollout.
- [ ] Sandbox mixed-tier/free/boundary purchases; verify processing payer,
      platform fee, director proceeds, receipt and individual passes.
- [ ] Pass/full/low-balance refunds; pending/failure/retry and exact accounting.
      Local funding code is not Stripe acceptance evidence.
- [ ] New-director onboarding UI: on hold at the user's request; do not build yet.
- [ ] Full public/authenticated/mobile/gate QA, without camera.
- [ ] Final refund/dispute/cancellation policy and clear offer conditions.
- [ ] Operational security review. Supabase leaked-password protection remains
      disabled; confirm plan support before enabling. Existing service-only
      RLS notices and the authenticated metrics wrapper require contextual
      review, not indiscriminate permission changes.
- [ ] Real director completes live Stripe setup; verify fees/payments/payouts.
- [ ] Explicit live checkout activation; observe first genuine purchase and
      bank payout before wider rollout.

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
