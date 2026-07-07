# TourniBase Transactional Email

Last verified: July 7, 2026

## Current status

The email foundation and Resend adapter are complete. `tournibase.com` is
verified in Resend, the sending-only API key is stored in Vercel, and production
delivery is active. A real Stripe test purchase successfully delivered the
buyer pass email on July 5, 2026.

| Capability | Status |
| --- | --- |
| One branded email per paid order | Built |
| Refund confirmation email after Stripe refund webhook | Built |
| Every mobile pass link in that email | Built |
| Offline PNG link for every pass | Built |
| Refund/support instructions with order number | Built |
| Plain-text fallback | Built |
| Event, venue, order, total, and organizer details | Built |
| Protected database delivery tracking | Built |
| Atomic duplicate-send protection | Built |
| Temporary and permanent failure states | Built |
| Local visual preview | Built |
| Sending domain | `tournibase.com` verified |
| Provider adapter | Resend active in production |
| Provider API key | Sending-only key stored in Vercel |
| Real buyer delivery | Active and end-to-end tested |

Stripe may separately send its standard payment or refund receipts. TourniBase
emails have a different job: delivering the actual mobile pass links created
after payment and giving buyers a clear TourniBase refund/pass-validity message
after a refund webhook.

## Delivery flow

1. Stripe confirms a paid Checkout Session.
2. TourniBase creates one pass per purchased admission.
3. The webhook creates one pending `order_email_deliveries` record.
4. If `EMAIL_PROVIDER=disabled`, the record stays pending and no email is sent.
5. Once a provider is configured, the server atomically claims the order.
6. TourniBase renders HTML and plain-text versions containing every mobile pass
   link and offline PNG download.
7. The provider receives a deterministic idempotency key based on the order ID.
8. A successful send records the provider message ID and sent time.
9. Temporary failures remain eligible for a Stripe webhook retry. Permanent
   failures are recorded without changing the paid order or issued passes.

The success page remains a backup delivery method even when email sending
fails.

## Refund email flow

1. An operator refunds a payment in Stripe.
2. Stripe sends `charge.refunded` to the TourniBase webhook.
3. TourniBase retrieves the latest Stripe charge before deciding whether the
   refund is full or partial.
4. TourniBase updates the order refund status.
5. Full refunds also mark active or checked-in passes as refunded.
6. TourniBase sends a buyer refund confirmation email through Resend.
7. Temporary email failures return a webhook error so Stripe can retry.

## Delivery statuses

| Status | Meaning |
| --- | --- |
| `pending` | Ready when a provider is configured |
| `sending` | Claimed by one request |
| `sent` | Accepted by the email provider |
| `retryable_failure` | Temporary error; another webhook attempt may retry |
| `permanent_failure` | Invalid or incomplete data that should not retry automatically |

A `sending` claim becomes eligible again after 10 minutes so a crashed request
cannot leave an order locked forever.

## Local preview and tests

Start the app and open:

```text
http://localhost:3000/dev/email-preview
```

The preview route uses sample data and returns 404 in production.

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Production configuration

- `NEXT_PUBLIC_SITE_URL=https://tournibase.com`
- `EMAIL_FROM=TourniBase <passes@tournibase.com>`
- `EMAIL_PROVIDER=resend`
- A sending-only `RESEND_API_KEY`

Do not log buyer email addresses, pass tokens, rendered HTML, or provider API
keys. Keep the success page available as the backup retrieval method.
