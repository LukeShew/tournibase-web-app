# TourniBase Refund and Support Process

Last updated: July 7, 2026

## Current MVP policy

Refunds are initiated manually in Stripe. TourniBase automatically syncs Stripe
refund status back into the app when Stripe sends a refund webhook, then sends
the buyer a TourniBase refund confirmation email.

This is intentionally simple for the MVP:

- Full refund: TourniBase marks the order as refunded and invalidates active or
  checked-in passes for that order. The refund email tells the buyer those
  passes are no longer valid for entry.
- Partial refund: TourniBase marks the order as partially refunded but does not
  automatically void a specific pass. The refund email tells the buyer to
  confirm remaining pass access with the organizer.

Partial refunds are not pass-specific yet. If one pass in a multi-pass order
needs to be voided, handle the money in Stripe and make a separate operational
note until a director-facing pass refund tool exists.

## Buyer support wording

Buyer-facing pages and emails tell spectators to contact the event organizer and
include their order number for admission help or refund requests.

Refund confirmation emails are sent by TourniBase after the refund webhook is
processed. Stripe may also send its own receipt if that is enabled in the Stripe
account, but TourniBase should not depend on Stripe's customer email settings
for pass-validity messaging.

## Manual refund steps

1. Open the Stripe Dashboard in the same mode as TourniBase.
2. Search for the buyer email, Stripe payment, or TourniBase order number.
3. Open the payment.
4. Click **Refund**.
5. Choose the refund amount.
6. Submit the refund.
7. Confirm Stripe records the refund.
8. Confirm TourniBase updates:
   - Full refund: order is `refunded`; passes scan as refunded/not active.
   - Partial refund: order is `partial_refund`; passes remain usable unless
     manually handled.
9. Confirm the buyer receives the TourniBase refund confirmation email.

## Required Stripe webhook event

The production Stripe webhook endpoint must include:

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
3. Refund the payment fully in Stripe test mode.
4. Open the Stripe webhook delivery and confirm `charge.refunded` returned
   `200`.
5. Confirm the buyer receives the TourniBase refund confirmation email.
6. Scan the same pass again.
7. Confirm the scanner blocks it as refunded/not active.

Then repeat this once in live mode with a low-value real transaction before
using TourniBase for a real tournament.
