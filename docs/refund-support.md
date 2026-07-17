# TourniBase Refund and Support Process

Last updated: July 16, 2026

## Current MVP policy

Tournament organizers are the sellers and merchants of record. Connected
orders are direct charges on each organizer's Stripe account. Directors can
refund a full order or one paid pass from the TourniBase order detail view.
TourniBase scopes the refund to the order's immutable connected account,
reverses any application fee, syncs the refunded amount, updates revenue
totals, invalidates the affected pass or passes, and sends the buyer a refund
confirmation email.

This is intentionally simple for the MVP:

- Full refund: TourniBase marks the order as refunded and invalidates active or
  checked-in passes for that order. The refund email tells the buyer those
  passes are no longer valid for entry.
- Partial refund: when a director refunds a specific pass from TourniBase, that
  pass is invalidated and the remaining passes stay active.

For a generic partial refund created directly in Stripe, TourniBase can update
the refunded amount but cannot infer which pass was intended. Use the
director-facing pass refund action when a specific pass must be invalidated.

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
6. Confirm TourniBase updates:
   - Full refund: order is `refunded`; passes scan as refunded/not active.
   - Pass refund: order is `partial_refund`; the selected pass is refunded
     while remaining passes stay usable.
7. Confirm the buyer receives the TourniBase refund confirmation email.

Stripe can still send a refund event for a refund initiated directly in the
connected account. TourniBase reconciles that amount, but a generic partial
refund created in Stripe cannot identify which pass should be invalidated.

## Required Stripe webhook event

The connected-payment webhook endpoint must include:

```text
charge.refunded
```

The full test-mode event list is:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
```

Endpoint:

```text
https://tournibase.com/api/stripe/webhook
```

## Before real customer payments

Run one test-mode refund before switching to live mode:

1. Buy a test pass.
2. Scan it successfully.
3. Refund the remaining order from the TourniBase order detail view.
4. Open the Stripe webhook delivery and confirm `charge.refunded` returned
   `200`.
5. Confirm the buyer receives the TourniBase refund confirmation email.
6. Scan the same pass again.
7. Confirm the scanner blocks it as refunded/not active.

Then have the director complete live Connect onboarding and repeat this once in
live mode with a low-value real transaction before using TourniBase for a real
tournament. Confirm the gross charge, Stripe fee, $0 pilot TourniBase fee,
director proceeds, refund, and dashboard totals.
