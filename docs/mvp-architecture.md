# TourniBase Web MVP Architecture

Last verified: July 6, 2026

## System overview

```mermaid
flowchart LR
  Director["Tournament director"] --> Web["Next.js web app on Vercel"]
  Buyer["Parent or spectator"] --> Web
  Staff["Gate staff"] --> Web
  Web --> Auth["Supabase Auth"]
  Web --> DB["Supabase Postgres + RLS"]
  Web --> Stripe["Stripe Checkout"]
  Stripe --> Webhook["Signed webhook route"]
  Webhook --> DB
  Webhook --> Email["Resend transactional email"]
```

The application is a Next.js App Router project deployed on Vercel. Supabase
provides password authentication and Postgres storage. Stripe hosts the payment
form. The browser never receives the Supabase secret key or Stripe secret keys.

## Main components

### Next.js and Vercel

- Server Components load protected director data and public event/pass data.
- Server Actions handle authenticated director and scanner mutations.
- Route Handlers create Stripe Checkout Sessions and receive Stripe webhooks.
- Client Components are limited to interactive forms, QR scanning, copying, and
  mobile gate controls.
- `proxy.ts` refreshes Supabase authentication cookies. Protected pages also
  re-check authorization on the server.

### Supabase

- Supabase Auth stores director identities.
- The `public.users` row is created from an Auth user through a private trigger.
- Postgres stores organizations, tournaments, tickets, orders, passes, scanner
  sessions, check-ins, and manual sales.
- Row Level Security limits directors to organizations they own.
- Anonymous access is limited to published tournaments and their active ticket
  types.
- Sensitive gate functions are callable only by the server-side Supabase secret
  key.

### Stripe

- TourniBase uses Stripe-hosted Checkout in payment mode.
- The app calculates prices on the server from current ticket records.
- Stripe webhook signatures are verified against the raw request body.
- Full Stripe refunds sync back into TourniBase and invalidate active or
  checked-in passes for the refunded order.
- Partial Stripe refunds mark the order as partially refunded but do not
  automatically void a specific pass.
- Test mode remains active until production launch checks are complete.

### Transactional email

- React Email renders one branded order email containing every mobile pass
  link plus a plain-text fallback.
- The provider-neutral delivery layer uses the Resend SDK in production.
- The sending-only key stays server-side, and `tournibase.com` is the verified
  sender domain.
- Production sends through Resend from `passes@tournibase.com`.
- `EMAIL_PROVIDER=disabled` keeps local development from sending real email.
- Postgres tracks delivery status and atomically claims each order so concurrent
  webhook requests cannot send duplicates.
- Provider errors do not undo payment or pass creation. Temporary failures can
  be retried; permanent failures remain recorded for support.

## Route map

### Public and buyer routes

| Route | Purpose |
| --- | --- |
| `/` | Product introduction |
| `/login` | Director password login |
| `/e/[event-slug]` | Public tournament pass purchase |
| `/share/[event-slug]` | Coach and parent sharing page |
| `/order/success` | Payment confirmation and pass links |
| `/p/[pass-token]` | Individual mobile pass |
| `/p/[pass-token]/offline-pass.png` | Downloadable offline QR pass image |

### Director routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Director tournament list |
| `/dashboard/tournaments/new` | Create a tournament |
| `/dashboard/tournaments/[id]` | Tournament overview |
| `/dashboard/tournaments/[id]/tickets` | Manage ticket types |
| `/dashboard/tournaments/[id]/gate` | Create and revoke scanner links |
| `/dashboard/tournaments/[id]/sales` | Sales dashboard |
| `/dashboard/tournaments/[id]/scans` | Gate-activity dashboard |
| `/dashboard/tournaments/[id]/share` | Coach and parent sharing tools |
| `/print/tournaments/[id]/gate-poster` | Printable buyer checkout poster |

### Gate routes

| Route | Purpose |
| --- | --- |
| `/scan/[scanner-token]` | Camera scanner and pass validation |
| `/scan/[scanner-token]/lookup` | Buyer/order lookup and manual check-in |
| `/scan/[scanner-token]/recent` | Persisted activity for that scanner |
| `/scan/[scanner-token]/sale` | Record an in-person sale |

### API routes

| Route | Purpose |
| --- | --- |
| `POST /api/checkout` | Validate an order and create Stripe Checkout |
| `POST /api/stripe/webhook` | Verify Stripe events, fulfill paid orders, and sync refunds |

## Tournament setup flow

1. A signed-in director submits the create-tournament Server Action.
2. If the director has no organization, the app creates one owned by that
   director.
3. The tournament is inserted as `draft` with a collision-safe public slug.
4. Ticket Server Actions create or edit ticket types after ownership and date
   checks.
5. Publishing is blocked until at least one active ticket type exists.
6. Only published tournaments and active ticket types are visible to anonymous
   buyers.

## Purchase and pass-creation flow

1. `POST /api/checkout` validates the event, ticket IDs, quantities, inventory,
   and buyer fields.
2. The server creates a pending `orders` row and `order_items` snapshots.
3. The server creates a Stripe Checkout Session with the TourniBase order ID in
   metadata.
4. Stripe redirects the buyer to hosted Checkout.
5. Stripe sends a signed success event to `/api/stripe/webhook`.
6. `fulfillCheckoutSession` retrieves the Checkout Session directly from Stripe
   and continues only when Stripe reports `paid`.
7. The function upserts one `passes` row per purchased admission using the
   unique order-item and sequence-number pair.
8. The order changes to `paid`.
9. The webhook creates or claims the order’s protected email delivery record.
10. If a provider is active, TourniBase sends one email containing every pass
    link with a deterministic idempotency key.
11. `/order/success` calls the same idempotent fulfillment function before
   showing pass links. This safely handles a fast redirect or a webhook retry.

Supported webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

## Refund sync flow

1. An operator issues a refund in Stripe.
2. Stripe sends `charge.refunded` to `/api/stripe/webhook`.
3. The webhook verifies the Stripe signature.
4. TourniBase resolves the order ID from Stripe metadata on the charge or its
   PaymentIntent.
5. A full refund marks the order as `refunded` and marks active or checked-in
   passes as `refunded`.
6. A partial refund marks the order as `partial_refund` and leaves passes
   usable unless staff handle a specific pass manually.

## Mobile pass flow

Each pass has a random UUID `public_token`. Its page is
`/p/[pass-token]`, and its QR code represents that pass link/token.

The page is resolved on the server and is shown only when its related order is
paid. Orders and passes are not anonymously readable through the Supabase Data
API.

The success page displays every pass link. The branded email template, delivery
tracking, duplicate protection, and retry states are live through Resend.

The success page, mobile pass page, and order email each link to
`/p/[pass-token]/offline-pass.png`. The server verifies the paid order and
generates a private, no-store PNG containing the same pass token as the mobile
QR. The saved image remains available when the buyer’s phone has no internet.
The scanner still requires internet because current pass status, validity, and
prior use must be checked against the database.

## Scanner authorization

1. A director creates a scanner session for one tournament and gate.
2. The server generates a random 256-bit scanner token.
3. Only the SHA-256 hash is stored in `scanner_sessions`.
4. The raw scanner link is shown once to the director.
5. Each scanner request hashes the URL token and checks the matching session,
   expiration, revocation, tournament, and permission set.

Available permission levels combine:

- QR/pass scanning
- Buyer and order lookup
- Recent activity
- Gate-sale recording

## Pass validation and duplicate blocking

The scanner sends the parsed pass token to a Server Action. The server calls
`validate_pass_for_entry`, which runs inside Postgres and locks the pass row
during validation.

The function verifies:

- The scanner session exists, is active, and belongs to the tournament
- The pass belongs to that tournament
- The order is paid
- The pass status allows admission
- The pass is valid at the current tournament-local date and time
- The number of successful admissions is below `uses_allowed`

A successful admission inserts a `check_ins` row and updates the pass atomically.
Concurrent scans cannot both consume the same remaining use.

A later scan returns `already_used`. Authorized staff may call
`override_duplicate_pass_entry` with a required reason. An eligible check-in can
be undone by the same scanner session through `undo_pass_check_in`.

Invalid tokens are audited using a SHA-256 attempt hash; the raw invalid token is
not stored.

## Manual lookup and gate sales

The lookup flow searches only orders for the scanner’s tournament. Eligible
passes use the same validation function as camera scans, so manual check-in does
not bypass duplicate or date rules.

The gate-sale flow uses `record_gate_sale`. Postgres re-checks the scanner
session, permission, ticket ownership, ticket status, and quantity before
recording the sale. The amount is calculated from the current ticket price.
This is reporting-only and does not process payment.

## Time zones

- Each tournament stores an IANA time zone.
- New tournaments default to `America/New_York`.
- Ticket dates become exact UTC validity windows using the tournament time
  zone.
- Buyer, pass, scanner, lookup, recent-scan, and dashboard displays use the
  tournament time zone.
- Device location and VPN usage do not change admission validity.

## Security boundaries

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is safe for browser use because RLS
  controls accessible rows.
- `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, and
  `STRIPE_WEBHOOK_SECRET` are server-only.
- Email delivery records and the claim function have no anonymous or
  authenticated browser access.
- Director authorization is enforced in server code and RLS, not only in
  `proxy.ts`.
- Scanner URLs act as temporary gate credentials and can be expired or revoked.
- Stripe card information never passes through TourniBase.
- Pass pages and scanner pages are marked to avoid search indexing.

See [Database Schema](./database-schema.md) for the current tables, functions,
and access model.
