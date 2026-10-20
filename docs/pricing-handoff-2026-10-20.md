# Pending Pricing and Next-Phase Handoff

> October 20 launch work: matching account-transition code `7ea3a1b` is deployed
> on both hosts. All 35 migrations are applied. Staging now uses Express with
> platform-paid processing, Stripe-owned connected-account losses and the approved
> per-ticket fees. Historical orders keep their original account. Sandbox purchase
> and pass/full-order refund checks passed; remaining acceptance is tracked below.
> Production pricing is unchanged and checkout stays disabled. Onboarding UI is on hold
> at the user's request. See [current launch checklist](launch-readiness-2026-10-20.md).

Checkpoint: October 20, 2026. This is a continuation record, not a launch
approval or published refund/dispute policy.

Evening follow-up: boundary/mixed/free purchases, pass/full refunds, pending
completion, later failure, app retry rejection and admission/revocation passed.
The user approved the refund/dispute allocation; website wording is prepared
locally, not published. Latest suite: 439 tests/41 files plus typecheck/lint/build.
Both deployed branches remain `f3b1b2f`. The definitive remaining gates and test
limits are in [follow-up QA](qa-launch-follow-up-2026-10-20.md).

## Current continuation

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

The $10 threshold is enforced in code and SQL. These variables are active on
staging only. Production's unset policy preserves its legacy configuration
and paid checkout stays disabled during acceptance.

## Express preview research

Stripe documents this intended combination for Accounts v2 direct charges:
`dashboard=express`, `defaults.responsibilities.fees_collector=application`,
and `defaults.responsibilities.losses_collector=stripe`. The documented
creation API version is `2026-09-30.preview`. The local application now uses
this version only for Connect lifecycle requests; payment/refund calls keep
their existing SDK version and webhook contracts.

The exact combination is in public preview. Documentation establishes that
Stripe offers it, not that TourniBase is enrolled or eligible in either mode.
Stripe-owned losses do not remove directors' obligation to return refunded
ticket principal or cover disputes from their balances; nor do they remove
TourniBase's responsibility for its own expenses or negative balance.
[Risk configuration](https://docs.stripe.com/connect/risk-management),
[release phases](https://docs.stripe.com/release-phases).

Express offers payment, payout, bank-detail, refund, dispute, and reporting
workflows. Sandbox access requires a server-generated login link. The local dashboard and order routes now create fresh Express login links
and retain full-Dashboard deep links. Historical order account IDs remain
authoritative. Only the approved staging organization's future purchases were
switched; historical orders retain their original connection.
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

## Prepared implementation and acceptance gates

Per-ticket quotes, upfront totals, exact unit snapshots, pass refunds, and
legacy compatibility are implemented. The refund-advance path is idempotent,
capped to the original order/pass fee, and starts only after Stripe reports
insufficient funds. Pass cancellation and refunded totals remain success-only.
A failed/canceled refund preserves the advance for manual reconciliation;
there is no automatic recovery or buyer-refund retry.

The approved staging transition and mixed/free/boundary purchases are complete,
along with exact partial/full refunds, pending completion and failure handling.
A controlled low-balance/provider-reason check remains open. The October 20
evidence and limitations are recorded in the follow-up QA report; October 17
legacy orders are not acceptance of the new model.

Keep production checkout off until a real director is ready and the live
launch gates are satisfied. Refund/dispute policy and clear offer conditions
are approved and prepared locally. No new legal promise has been published.

## New-account introduction — on hold

Four concepts and workflows are complete. The user deferred implementation
on October 20. Do not build option D or force setup gating without resuming
that decision. Keep any eventual UI identical across staging and production.

## Repository rules for continuation

- Use only `/Users/lukeshewmaker/Documents/Codex Sandbox/TourniBase` and its
  canonical app at `apps/tournibase-web-app`; never create another checkout
  outside the project folder.
- Keep staging and production application code identical.
- Commit completed work, but do not push the web-app repo without the user's
  explicit push authorization. The authorized pricing/Express code deployment
  is complete; fee activation and live sales remain gated separately.
- Auto-push the original TourniBase repo only if its only changes are to the
  overview document. Other root changes require explicit permission.
- Preserve these rules in every compacted summary. Do not use the camera or
  create live payments for testing.

Related records:
[rollout](environment-rollout.md),
[refund support](refund-support.md),
[October 17 payment QA](qa-payment-readiness-2026-10-17.md).
