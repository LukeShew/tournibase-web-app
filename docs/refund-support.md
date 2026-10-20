# TourniBase Refund and Support Process

> October 20 launch work: Express creation and authenticated dashboard access
> are deployed on both hosts at `d44431a`. Both fee and loss responsibility are checked; no
> existing account is replaced automatically. All 33 migrations are applied.
> The isolated Sandbox account now has active payments and payouts, but remains
> unlinked to TourniBase. New-tier payment/refund acceptance and live eligibility
> remain open. Production checkout stays disabled. Onboarding UI work is on hold
> at the user's request. See [current launch checklist](launch-readiness-2026-10-20.md).

Last updated: October 20, 2026

## Pending pricing change — not activated

The October 20 per-ticket/Express code is deployed to both hosts at `d44431a`;
the new fee configuration is not activated. Its additive migration `20261020001124` is applied, but no
order uses the new policy and no new-pricing
hosted Sandbox purchase/refund has been validated. Production retains legacy
2% plus $0.30-per-order configuration with paid checkout disabled; staging
retains $0 fees. The acceptance evidence below is from the October 17 release.

The pending buyer fee is $1 for each paid ticket through $10, or $1 plus 4% of
the **whole base ticket price** above $10, rounded per unit. Free tickets have
no fee. New `per_ticket_v2` orders save the unit fee on each order item and
record the processing payer. A pass-specific refund uses that saved fee, not
today's configuration and not a proportional share of the total order fee.
For example, a $15 ticket plus $5 ticket carries fees of $1.60 and $1.00:
refunding only the $5 pass returns $6.00. Legacy orders retain their existing
proportional allocation and original processing-payer treatment.

Express configuration acceptance is verified only on the isolated Sandbox
account. Hosted onboarding, payment allocation and live eligibility remain
unverified. Local tiered Checkout checks both platform-paid processing and
Stripe-owned losses; existing account routing is preserved. Express login
links and account creation are now deployed.

### Local work; hosted blocker: insufficient connected-account balance

The previous release returned its application fee only after the buyer
refund succeeded. A director's connected balance may contain only the base
ticket proceeds, while a full buyer refund also needs the fee held by the
platform. An insufficient-funds refund can therefore remain pending. The
new-model early-funding path is deployed and locally tested, but its low-balance
Sandbox acceptance remains outstanding.

The deployed path advances only the saved order/pass fee for Stripe-reported
`pending_reason=insufficient_funds`, with idempotent retries. Buyer-refunded
amounts and pass cancellation still depend on actual refund success. Actual fee
advances remain recorded after a failed/canceled buyer refund for manual review;
the app does not recover the advance or automatically retry the buyer refund.
Any fee advanced before success must not be counted as director ticket
proceeds. Before activation, an isolated low-balance Sandbox case must
prove completion without duplicate fee reversals or incorrect reporting.
Local tests do not establish provider completion for this new funding path.

All 33 local migrations are applied to hosted Supabase. Reporting correction
`20261020195327` excludes fee advances from director proceeds, even after a
failed buyer refund, while preserving historical treatment. Both SQL suites
pass. The application passed 434 tests, ESLint, TypeScript and a production
webpack build. These checks do not prove provider funding or refund completion.
Keep historical orders routed to their original connected account during any
future account migration; never replace old refund routing with a new Express
account.

### Refund/dispute policy remains a decision

The new ordinary-sale goal is that directors retain their full base ticket
revenue and TourniBase pays processing. That is not yet an active or verified
promise. Refund eligibility, responsibility for non-returned processing costs,
dispute principal/fees, and the wording of any free-director offer still require
an approved policy. No new Terms or refund/dispute promise has been published
by this implementation. Cost-affecting conditions must be clear near the offer,
not only in Terms. See the
[pricing handoff](pricing-handoff-2026-10-20.md).

## Historical deployed release — October 17

Release checkpoint: the buyer-fee and refund-lifecycle database migrations are
applied. Matching `7425b18` staging/production deployments are Ready, and both
connected-payment destinations have all eight required event types. Hosted
Sandbox cases below are verified; production paid checkout remains disabled.
Staging's zero-fee restoration is verified in the saved variables, Ready
deployment, and stable ticket-page total.
The final URL-ordering/refund-guidance follow-up `f6be6cd` passed local
verification and is deployed on both hosts. The Sandbox acceptance below was
observed during the preceding fee/refund releases and remains recorded evidence,
not a guarantee of live payment or payout behavior.
See
[Staging and Production Rollout](environment-rollout.md) for deployment evidence.

Follow-up source `7425b18` passed 295 tests across 35 files, lint, TypeScript,
and a production webpack build. Its matching deployments are verified Ready;
it addresses the synchronization behavior described below. Production checkout
remains disabled, and staging's normal fee stays zero.

## October 17 deployed acceptance evidence — legacy pricing

- Order `2040`: zero-fee purchase and successful individual-pass/full remaining
  refund, with delivered receipts.
- Order `2041`: pending refund persisted without completed-refund money or pass
  cancellation, then synchronized automatically on success and delivered the
  refund email.
- Order `2042`: a later failed refund corrected completed refunds to $0 and
  recorded $17.49 failed. Its blocked pass stayed blocked and the app rejected
  another refund attempt for manual review.
- Order `2043`: the approved fee run charged $47.46 ($46.24 admission + $1.22
  fee), then refunded $17.95 and $29.51. Stripe confirmed the $1.22 application
  fee was collected and fully returned; receipts were delivered.

See [Payment readiness QA](qa-payment-readiness-2026-10-17.md) for evidence and
remaining limits. These are Sandbox results, not proof of live bank settlement.

## Currently deployed refund behavior — legacy pricing

Tournament organizers are the sellers and merchants of record. Connected
orders are direct charges on each organizer's Stripe account. Directors can
refund a full order or one paid pass from the TourniBase order detail view.
TourniBase scopes the refund to the order's immutable connected account,
reverses the applicable application fee, syncs successfully refunded amounts,
updates revenue totals, invalidates successfully refunded passes, and sends the
buyer a refund confirmation email. A submitted refund is not necessarily a
successful refund; pending and failed states are tracked separately.

The deployed production configuration adds 2% of the admission subtotal plus
$0.30 once per paid order for the buyer, but live checkout is still disabled.
A full refund includes the remaining buyer fee. A pass refund
includes its exact allocated share of that fee, with cents allocated
deterministically across the purchased passes. Historical orders keep their
original pricing treatment; zero-fee staging orders request no application-fee
refund. Stripe processing fees are separate from TourniBase's buyer fee.

The 19 historical orders created on Stripe's old Test-mode platform are
reporting-only. Their refund controls are hidden, and the server rejects refund
requests for them because the onboarding Sandbox cannot access old Test-mode
payment objects.

This is intentionally simple for the MVP:

- Successful full refund: TourniBase marks the order as refunded and invalidates active or
  checked-in passes for that order. The refund email tells the buyer those
  passes are no longer valid for entry.
- Successful partial refund: when a director refunds a specific pass from TourniBase, that
  pass is invalidated and the remaining passes stay active.

For a generic partial refund created directly in Stripe, TourniBase can update
the refunded amount but cannot infer which pass was intended. Use the
director-facing pass refund action when a specific pass must be invalidated.

## Pending, failed, or canceled refunds

- Pending or action-required refunds are shown separately and excluded from
  completed refund totals. Pending refunds do not cancel additional passes;
  existing pass statuses still apply.
- Failed/canceled attempts are not returned money. TourniBase shows a review
  notice, does not automatically submit another refund, and reconciles the
  latest authoritative Stripe status using a versioned update.
- Open the exact connected-account payment in Stripe and review the reason,
  refund history, and any required action. Contact TourniBase support before
  restoring admission or deciding whether to retry. Avoid duplicate refunds.
- A failed-attempt notice is historical and can remain after successful
  recovery; it is not proof a refund is still owed.
- Previously canceled/refunded passes remain blocked. A refund failure does
  **not** automatically restore their admission. Any application fee already
  returned is not automatically reversed either; reconcile it manually.

Only successful refund amounts belong in a refund confirmation or completed
refund total. A pending attempt must not be described as money already returned.

## Accepted refund still synchronizing

Final log review found a race while synchronizing Sandbox order `2043`: a
webhook returned HTTP 500 and the refund route returned HTTP 502 even though
Stripe had accepted the refund. The exact webhook recovered to HTTP 200 about
17 seconds later, and final amounts and emails were correct.

The `7425b18` follow-up makes at most five attempts at competing versioned updates,
reading a fresh provider/database snapshot each time with bounded randomized
delays. If Stripe accepted the request but local synchronization still fails,
the API returns HTTP 202 and reports that synchronization is in progress—not
that the refund failed. Do not submit a duplicate refund to clear this message.
Refresh the order, review the exact Stripe payment, and let signed webhook
retries reconcile it; escalate persistent mismatches to support. Failed/canceled
refunds still require manual review, and pending/action-required refunds remain
separate from completed refunds. The order modal now follows the latest order
by ID so a refresh also updates the visible totals.

## Director onboarding

Directors create an account at `/signup`, confirm their email when required,
sign in, and create their first admission event. The support form sends account
and setup questions to the configured TourniBase support inbox. Before a pilot,
TourniBase should still confirm the director, event dates, ticket setup, scanner
staffing, and refund contact.

## Buyer support wording

Buyer-facing pages and emails tell spectators to contact the event organizer and
include their order number for admission help or refund requests.

Refund confirmation emails are sent by TourniBase after the refund webhook is
processed. Stripe may also send its own receipt if that is enabled in the Stripe
account, but TourniBase should not depend on Stripe's customer email settings
for pass-validity messaging.

## Manual refund steps

1. Open the event's **Orders** page in TourniBase.
2. Search for the buyer or TourniBase order number and open the order.
3. Choose **Refund remaining order** for a full refund, or **Refund this pass**
   for a pass-specific partial refund.
4. Confirm the refund.
5. Use **View payment in Stripe** only to verify the connected-account payment,
   fee, and refund records.
6. Check whether Stripe reports success, pending, or failure. For success,
   confirm TourniBase updates:
   - Full refund: order is `refunded`; passes scan as refunded/not active.
   - Pass refund: order is `partial_refund`; the selected pass is refunded
     while remaining passes stay usable.
7. Confirm the buyer receives the TourniBase refund confirmation email for the
   successful refund. For pending/failure, follow the review process above.

Stripe can still send a refund event for a refund initiated directly in the
connected account. TourniBase reconciles that amount, but a generic partial
refund created in Stripe cannot identify which pass should be invalidated.

## Required Stripe webhook events

The connected-payment webhook endpoint must include:

```text
charge.refunded
refund.created
refund.updated
refund.failed
```

The full list is required on **both** the Sandbox and live connected-payment
destinations. Use connected-account events with snapshot payloads, not platform
account events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
refund.created
refund.updated
refund.failed
```

Endpoints:

```text
https://staging.tournibase.com/api/stripe/webhook
https://tournibase.com/api/stripe/webhook
```

## Before real customer payments

Resolve the October 20 Stripe account-model and insufficient-balance refund
blockers above first. Deploy and validate the selected per-ticket model in
Sandbox; the historical October 17 acceptance is not a substitute.

Run the Sandbox regression before enabling production checkout:

1. Buy a test pass.
2. Scan it successfully.
3. Refund the remaining order from the TourniBase order detail view.
4. Open the Stripe webhook delivery and confirm `charge.refunded` returned
   `200`.
5. Confirm the buyer receives the TourniBase refund confirmation email.
6. Scan the same pass again.
7. Confirm the scanner blocks it as refunded/not active.

Also verify pass-specific refunds, zero-fee orders, pending/failed refund
handling, duplicate/out-of-order deliveries, and an early partial refund before
initial receipt delivery. A failed refund must not produce a false completed
refund email or silently re-enable a blocked pass.

For the pending release, also verify mixed $10-or-less and above-$10 passes,
cent rounding, free passes, exact saved per-pass fees, processing charged to
TourniBase, full base-price director proceeds, and legacy-order refunds.
Use isolated connected-balance conditions to prove the buyer-fee portion can
be funded when the director balance has only ticket principal.

Have the real pilot director complete live Connect onboarding. After deployment
and technical checks, use a genuine authorized pilot purchase for real
admission—not a fabricated live transaction for testing. Confirm the total
charge, successful webhook, receipt, passes, the selected per-ticket buyer-funded
application fee, platform-paid Stripe processing, full base-price director
proceeds, and reporting. Refund a
live purchase only for a legitimate, authorized reason. A successful Sandbox
flow does not prove a director's real bank payout; verify that separately.

Paid Checkout is restricted to the dedicated environment-specific card
configuration, including eligible Apple Pay/Google Pay; extra delayed methods
are not approved for launch. See the rollout document for the required
`STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION` variable and scope.
