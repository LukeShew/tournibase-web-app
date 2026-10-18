# TourniBase Refund and Support Process

Last updated: October 17, 2026

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

## Deployed acceptance evidence

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

## Current MVP policy

Tournament organizers are the sellers and merchants of record. Connected
orders are direct charges on each organizer's Stripe account. Directors can
refund a full order or one paid pass from the TourniBase order detail view.
TourniBase scopes the refund to the order's immutable connected account,
reverses the applicable application fee, syncs successfully refunded amounts,
updates revenue totals, invalidates successfully refunded passes, and sends the
buyer a refund confirmation email. A submitted refund is not necessarily a
successful refund; pending and failed states are tracked separately.

New production orders add 2% of the admission subtotal plus $0.30 once per order
for the buyer. A full refund includes the remaining buyer fee. A pass refund
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

Have the real pilot director complete live Connect onboarding. After deployment
and technical checks, use a genuine authorized pilot purchase for real
admission—not a fabricated live transaction for testing. Confirm the total
charge, successful webhook, receipt, passes, 2% plus 30-cent buyer-funded
application fee, Stripe processing, director proceeds, and reporting. Refund a
live purchase only for a legitimate, authorized reason. A successful Sandbox
flow does not prove a director's real bank payout; verify that separately.

Paid Checkout is restricted to the dedicated environment-specific card
configuration, including eligible Apple Pay/Google Pay; extra delayed methods
are not approved for launch. See the rollout document for the required
`STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION` variable and scope.
