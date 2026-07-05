# TourniBase Transactional Email

Last verified: July 5, 2026

## Current status

The provider-neutral email foundation is complete. Real email sending is
disabled until TourniBase has a domain and a selected provider.

| Capability | Status |
| --- | --- |
| One branded email per paid order | Built |
| Every mobile pass link in that email | Built |
| Plain-text fallback | Built |
| Event, venue, order, total, and organizer details | Built |
| Protected database delivery tracking | Built |
| Atomic duplicate-send protection | Built |
| Temporary and permanent failure states | Built |
| Local visual preview | Built |
| Sending domain | Not selected |
| Provider adapter and API key | Not selected |
| Real buyer delivery | Disabled |

Stripe may separately send its standard payment receipt. The TourniBase email
has a different job: delivering the actual mobile pass links created after
payment.

## Delivery flow

1. Stripe confirms a paid Checkout Session.
2. TourniBase creates one pass per purchased admission.
3. The webhook creates one pending `order_email_deliveries` record.
4. If `EMAIL_PROVIDER=disabled`, the record stays pending and no email is sent.
5. Once a provider is configured, the server atomically claims the order.
6. TourniBase renders HTML and plain-text versions containing every pass link.
7. The provider receives a deterministic idempotency key based on the order ID.
8. A successful send records the provider message ID and sent time.
9. Temporary failures remain eligible for a Stripe webhook retry. Permanent
   failures are recorded without changing the paid order or issued passes.

The success page remains a backup delivery method even when email sending
fails.

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

## Activation steps for later

1. Buy the TourniBase domain.
2. Choose a transactional provider such as Resend or Postmark.
3. Verify a sending subdomain with the provider using its DNS records.
4. Add a provider adapter behind the existing `EmailProvider` interface.
5. Add its server-only API key and sender address to Vercel.
6. Change `EMAIL_PROVIDER` from `disabled` to that provider.
7. Make one Stripe test purchase using an email inbox you control.
8. Confirm the email arrives, every pass link opens, and only one email is sent
   if Stripe retries the webhook.

Do not enable real sending until the domain is verified. Do not log buyer email
addresses, pass tokens, rendered HTML, or provider API keys.
