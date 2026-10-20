# Pending Pricing and Next-Phase Handoff

Checkpoint: October 20, 2026. This is a continuation record, not a launch
approval or published refund/dispute policy.

## Latest scope: research only for Express

The user chose the simpler Express Dashboard as the target, then instructed
**“Only research it for now.”** Do not create a new Sandbox account, convert or
replace an account, enroll in a preview, or change Stripe/provider settings.
No such account or provider change has been made. Neither Sandbox-preview nor
live eligibility, preview activation, processing-payer settings, or loss
protection has been verified for TourniBase.

## Current state

- Staging and production remain on deployed source `ab2db87`. The pending
  per-ticket application changes are local only, not pushed or deployed.
- Production still uses the legacy 2% plus $0.30-per-order configuration.
  `TOURNIBASE_PAID_CHECKOUT_ENABLED=false`; there is no live connected
  organization. Do not enable live sales.
- Staging still uses its legacy $0 fee. No hosted new-tier purchase/refund
  acceptance has occurred.
- Shared Supabase migration
  `20261020001124_add_tiered_buyer_fee_snapshots.sql` is applied. There are 31
  hosted migrations and 32 local migrations. The additional
  `20261020064938_exclude_buyer_fee_refund_advances_from_director_proceeds.sql`
  is local only and has not been applied to hosted Supabase. The earlier draft timestamp
  `20261020000747` was replaced by the hosted version; it is not a second
  migration.
- The hosted read found 2,041 orders, zero `per_ticket_v2` orders, zero
  platform-payer orders, zero unit-fee snapshots, and no live connected
  accounts. The one Sandbox connected account's `fees_collector` is `NULL`
  (unverified). No account was changed or replaced.

## Approved price formula

The buyer fee is calculated separately for every paid ticket:

| Base ticket price | Buyer fee | Buyer total |
| --- | --- | --- |
| $0 | $0 | $0 |
| $5 | $1 | $6 |
| $10 | $1 | $11 |
| $15 | $1 + 4% of $15 = $1.60 | $16.60 |
| $20 | $1 + 4% of $20 = $1.80 | $21.80 |

Above $10, apply 4% to the whole base price, not only the part exceeding $10.
Round each unit fee to cents, then multiply by quantity. The user accepted
using the same $1 tier for inexpensive child tickets; no child-ticket discount
was requested.

The intended ordinary-sale result is that directors retain the full base price,
with processing charged to TourniBase. TourniBase's buyer fee is gross revenue,
not profit after processing and other Stripe/platform costs.

Both sites will use the same tiers after the coordinated activation. Staging
remains Sandbox-only, including its forced test-email recipient. The pending
opt-in configuration is:

```text
TOURNIBASE_PLATFORM_FEE_POLICY=per_ticket_v2
TOURNIBASE_PLATFORM_FEE_BPS=400
TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=100
TOURNIBASE_SANDBOX_FEE_QA_ENABLED=false
```

The $10 threshold is enforced in code and SQL. These variables are **not**
currently activated on either hosted site. An unset policy preserves the
legacy configuration during the additive rollout.

## Express preview research

Stripe documents this intended combination for Accounts v2 direct charges:
`dashboard=express`, `defaults.responsibilities.fees_collector=application`,
and `defaults.responsibilities.losses_collector=stripe`. The documented
creation API version is `2026-09-30.preview`. The current application does not
enable this preview or implement the Express lifecycle.

The exact combination is in public preview. Documentation establishes that
Stripe offers it, not that TourniBase is enrolled or eligible in either mode.
Stripe-owned losses do not remove directors' obligation to return refunded
ticket principal or cover disputes from their balances; nor do they remove
TourniBase's responsibility for its own expenses or negative balance.
[Risk configuration](https://docs.stripe.com/connect/risk-management),
[release phases](https://docs.stripe.com/release-phases).

Express offers payment, payout, bank-detail, refund, dispute, and reporting
workflows. Sandbox access requires a server-generated login link. Both current
dashboard links and per-order payment links assume the full Dashboard, so
replacing only the account-creation parameter would be incomplete. Preserve
historical account routing and support both account types during any future
migration.
[Express Dashboard](https://docs.stripe.com/connect/express-dashboard),
[account configuration](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration).

## Express cost research

Stripe's published US platform-managed pricing lists **$2 per monthly active
connected account** and **0.25% of payout volume plus $0.25 per payout**, in
addition to payment processing. “Active” means a month in which a payout is
sent to the account's bank/debit card. These are platform costs, not a promised
charge to directors. See [Stripe Connect pricing](https://stripe.com/connect/pricing)
and [Stripe's monetization guidance](https://support.stripe.com/questions/monetizing-payments-with-stripe-connect?locale=en-US).

These published rates inform planning; they do not confirm TourniBase's
eligibility, exact negotiated/preview terms, or all additional costs. Loss
protection is not assumed active or free. Keeping directors free means
TourniBase must budget Connect/payout costs as well as card processing from its
buyer-fee revenue.

## Prepared implementation and local evidence

- Per-ticket calculation, upfront buyer totals, Checkout line items, exact
  unit-fee snapshots, and pass-specific refund allocation.
- Separate service-only tiered reservation RPC; legacy callers and historical
  order pricing remain unchanged.
- Immutable order fee policy/processing payer and item fee snapshots; reporting
  does not deduct estimated processing from platform-payer orders.
- Account fee-collector synchronization and a fresh Stripe processing-payer
  check before a tiered paid Checkout Session. Unknown/director-paid
  processing fails closed.
- Paused-creation safety blocks `per_ticket_v2` from creating any new Stripe
  account before provider calls while Express remains research-only. Existing-account sync
  and legacy behavior remain; there is no speculative Full Dashboard fallback.
  Fresh paid-checkout verification also requires Stripe-owned losses.
- Early application-fee funding for provider-reported
  `pending_reason=insufficient_funds` refunds is implemented and tested locally.
  The advance is capped by the full order's original fee or exact saved
  pass-level fee. Buyer refund totals/pass states remain success-only;
  failures preserve the actual fee advance for manual reconciliation without
  recovery or automatic buyer-refund retry. This is not deployed or verified
  through Stripe.
- The local-only reporting migration prevents any fee advance from inflating
  director ticket proceeds, including after a later failed buyer refund.
- Final local validation passed 421 tests across 40 files, ESLint, TypeScript,
  the production webpack build, and diff checks.
- All 32 local migrations applied in isolated PGlite; both
  `supabase/tests/buyer_paid_fees.sql` and
  `supabase/tests/tiered_buyer_fees.sql` passed.

Local results and an applied migration do not prove Stripe platform-fee
allocation, hosted refunds, or live bank payouts. The October 17 orders
`2040`–`2043` and their deployment receipts remain historical evidence of the
legacy fee model only.

## Blockers before activation

1. **Selected Express model.** The user chose the simpler Express Dashboard
   and limited the current provider work to research into Stripe loss protection
   in public preview.
   Eligibility, preview activation, and actual fee/liability settings remain
   unverified. No account has been created or switched. Do not enroll, create
   test accounts, convert accounts, or change provider settings under this
   research-only instruction.
2. **Provider configuration.** After separate authorization and confirming support, verify the selected account
   actually has platform-paid processing. A database default or local guard is
   not provider confirmation. Keep live checkout off.
3. **Insufficient-balance refunds.** Deployed code returns application fees
   only after buyer refunds succeed. A connected account holding only ticket
   principal may lack the buyer-fee portion and leave a refund pending while
   TourniBase still holds that amount. Early funding, idempotent exact-fee
   handling, and the reporting correction are implemented and locally tested;
   neither is deployed. Hosted low-balance acceptance and provider
   reconciliation checks remain outstanding.
4. **Hosted new-policy QA.** Deploy matching code/configuration only after the
   blockers are addressed, then validate mixed tiers, free tickets, boundary
   rounding, multiple quantities, processing payer, application fees, director
   proceeds, receipts, exact partial/full refunds, low connected balances,
   failure/retry behavior, historical compatibility, and environment isolation
   using Sandbox only. Do not treat the old zero-fee restoration run as this
   acceptance.
5. **Policy and live launch.** Agree refund/dispute policy and prominent
   offer conditions before publishing a free-director claim. Terms have not
   been changed. Complete real director onboarding and the separately
   authorized genuine pilot payment/payout checks before live launch.

Future Express readiness also requires authenticated Express dashboard-login
links, correct configuration metadata and webhook synchronization, and an
explicit migration plan. Preserve historical order account IDs for refunds;
do not route existing payments through a replacement account. These are
remaining work, not an implemented Express preview integration.

## Queued next phase: new-account introduction

After the payment model is resolved, build the requested Canva-like guided
introduction to TourniBase and its important setup steps, including Stripe and
the first event. This is not implemented. The user has not decided that
directors must complete setup before doing anything else; do not introduce
forced gating by assumption.

Use the same guided UI, routes, and behavior on staging and production, with
only the intentional test/live, data, account, email, domain, indexing, and
access differences.

## Repository rules for continuation

- Use only `/Users/lukeshewmaker/Documents/Codex Sandbox/TourniBase` and its
  canonical app at `apps/tournibase-web-app`; never create another checkout
  outside the project folder.
- Keep staging and production application code identical.
- Commit completed work, but do not push the web-app repo without the user's
  explicit push authorization. This pricing checkpoint is being held locally
  until Express/preview verification and the refund-funding blocker are resolved.
- Auto-push the original TourniBase repo only if its only changes are to the
  overview document. Other root changes require explicit permission.
- Preserve these rules in every compacted summary. Do not use the camera or
  create live payments for testing.

Related records:
[rollout](environment-rollout.md),
[refund support](refund-support.md),
[October 17 payment QA](qa-payment-readiness-2026-10-17.md).
