# TourniBase Web App

TourniBase is a digital gate system for youth basketball tournaments. This
web-first MVP lets directors sell spectator passes, issue mobile tickets, scan
guests, stop duplicate entry, and monitor sales and gate activity.

The web app is the current main TourniBase product. The separate waitlist
website and a future native mobile app are postponed and are not part of this
repository.

Production app:
[tournibase.com](https://tournibase.com)

## Current status

- All 19 numbered web MVP phases complete
- Stripe test mode
- Final repository review and MVP handoff complete
- Transactional pass email is live through Resend and passed a real test order
- Buyers can download each QR pass as a PNG for offline access

Current progress and remaining work:
[Implementation Roadmap](docs/implementation-roadmap.md)

## Documentation

- [TourniBase Overview](docs/TourniBase%20Overview.md)
- [Web MVP Product Plan](docs/mvp-product-plan.md)
- [MVP Architecture](docs/mvp-architecture.md)
- [Database Schema](docs/database-schema.md)
- [Local Demo Data](docs/demo-data.md)
- [Implementation Roadmap](docs/implementation-roadmap.md)
- [Transactional Email](docs/transactional-email.md)
- [Final MVP Handoff](docs/mvp-handoff.md)

## What the MVP does

### Directors

- Sign in to a protected dashboard
- Create and publish tournaments
- Create and manage ticket types
- Create expiring, revocable scanner links
- Share parent and coach ticket pages
- Review sales, revenue, attendance, and gate activity

### Parents and spectators

- Buy passes from a public tournament page
- Pay through Stripe-hosted Checkout
- Open an individual mobile QR pass for each admission
- Receive every pass by email
- Save pass images to Photos or Files before arriving

### Gate staff

- Scan QR passes with a phone camera
- Enter a pass manually when the camera fails
- Block duplicate, invalid, inactive, and wrong-day passes
- Look up buyers and orders when permitted
- Record in-person sales when permitted

## Requirements

- Node.js 20.9 or newer
- npm
- A separate Supabase project for the web app
- A Stripe account in test mode
- Stripe CLI for local webhook testing
- Docker only if you want to run the full Supabase stack locally

## Local setup

1. Clone or open this repository.

2. Install pinned dependencies:

   ```bash
   npm install
   ```

3. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

4. Fill in `.env.local` using the environment-variable table below.

5. Link and migrate the Supabase project as described in
   [Supabase setup](#supabase-setup).

6. Create the first director account as described in
   [First director account](#first-director-account).

7. Start the app:

   ```bash
   npm run dev
   ```

8. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Web-app Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Supabase publishable key protected by RLS |
| `SUPABASE_SECRET_KEY` | Server only | Paid-order fulfillment, pass lookup, and gate operations |
| `STRIPE_SECRET_KEY` | Server only | Creates and verifies Stripe Checkout Sessions |
| `STRIPE_WEBHOOK_SECRET` | Server only | Verifies signed Stripe webhook requests |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser-safe configuration | Matching Stripe mode and account |
| `NEXT_PUBLIC_SITE_URL` | Browser and server | Base URL used for pass, scanner, success, and cancel links |
| `EMAIL_PROVIDER` | Server only | `disabled` locally; use `resend` only after production activation |
| `RESEND_API_KEY` | Server only | Sending-only Resend API key |
| `EMAIL_FROM` | Server only | Verified sender, such as `TourniBase <passes@tournibase.com>` |

Local values must use:

```text
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Use the Supabase **publishable** key in the browser variable and the
**secret** key only in `SUPABASE_SECRET_KEY`. Never put a secret or legacy
service-role key in a `NEXT_PUBLIC_` variable.

Do not commit `.env.local`.

## Transactional email

TourniBase has a branded order email containing every pass link, a plain-text
fallback, protected delivery tracking, atomic duplicate protection,
retryable/permanent failure states, and a Resend transport.

Keep local sending disabled unless you are intentionally running a delivery
test:

```text
EMAIL_PROVIDER=disabled
```

Production uses the verified `tournibase.com` domain with
`EMAIL_PROVIDER=resend`, a sending-only `RESEND_API_KEY`, and:

```text
EMAIL_FROM=TourniBase <passes@tournibase.com>
```

With the development server running, preview the email at:

```text
http://localhost:3000/dev/email-preview
```

That route uses sample data and returns 404 in production. See
[Transactional Email](docs/transactional-email.md) for delivery details.

## Supabase setup

The schema is managed by the SQL files in `supabase/migrations`.

### Apply migrations to a hosted project

1. Log in to the CLI:

   ```bash
   npx supabase login
   ```

2. Link the separate TourniBase web-app project:

   ```bash
   npx supabase link --project-ref <project-ref>
   ```

3. Review which migrations would be applied:

   ```bash
   npx supabase db push --linked --dry-run
   ```

4. Apply them:

   ```bash
   npx supabase db push --linked
   ```

5. Confirm local and remote migration history:

   ```bash
   npx supabase migration list --linked
   ```

The current production project ref is `khwaafsdtgiymucppkmo`. Do not link this
repository to the waitlist project.

### Optional full local Supabase stack

Docker is required for this option.

```bash
npx supabase start
npx supabase db reset
```

`db reset` reapplies every migration and then runs `supabase/seed.sql`. The seed
file intentionally remains empty so demo data cannot be pushed to a hosted
project.

Use the local Supabase URL and keys printed by `npx supabase status` in
`.env.local`.

Create the local demo tournament after the reset:

```bash
npm run seed
```

See [Local Demo Data](docs/demo-data.md) for its safety guard, records, login,
and repeatable setup.

## First director account

Self-service sign-up is disabled.

1. Open the web-app project in Supabase.
2. Go to **Authentication → Users**.
3. Click **Add user**.
4. Enter the director’s email and password.
5. Create the user.

The database trigger creates the matching protected `public.users` profile with
the `director` role.

## Stripe setup

Keep all Stripe values in the same mode. During development, use only
`sk_test_...`, `pk_test_...`, and a webhook attached to the same test account.

### Production test-mode endpoint

Create a Stripe webhook endpoint at:

```text
https://tournibase.com/api/stripe/webhook
```

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Copy that endpoint’s `whsec_...` signing secret into the Vercel
`STRIPE_WEBHOOK_SECRET` variable.

### Local webhook forwarding

1. Start the app with `npm run dev`.

2. In another terminal, sign in to Stripe:

   ```bash
   stripe login
   ```

3. Forward test events:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Copy the displayed `whsec_...` value into the local
   `STRIPE_WEBHOOK_SECRET`.

5. Restart `npm run dev` after changing `.env.local`.

Test card:

```text
4242 4242 4242 4242
```

Use any future expiration date, any three-digit CVC, and any valid postal code.

Do not switch to live keys until the complete flow passes the final launch
checks.

## End-to-end test flow

### 1. Create a tournament

1. Open `/login` and sign in as the director.
2. From `/dashboard`, choose **Create tournament**.
3. Enter the tournament, venue, organizer, contact, dates, and public slug.
4. Submit the form.
5. Confirm the tournament overview opens in draft status.

### 2. Create ticket types

1. Open **Ticket types** from the tournament overview.
2. Add at least one ticket with a price and valid date.
3. Confirm its status is active.
4. Return to the overview and publish the tournament.

### 3. Buy a pass

1. Open the public link at `/e/[event-slug]`.
2. Select a quantity and enter buyer details.
3. Continue to Stripe Checkout.
4. Pay with the Stripe test card.
5. Confirm `/order/success` shows a paid order and one pass link per admission.

### 4. Verify Stripe fulfillment

1. Confirm the local Stripe listener received
   `checkout.session.completed`.
2. In Supabase, confirm:
   - `orders.payment_status` is `paid`
   - `order_items` contains the ticket snapshots
   - `passes` contains one row per purchased admission
3. Reload the success page and confirm it does not create duplicate passes.

Fulfillment is idempotent because each pass is unique by order item and sequence
number.

### 5. Open a mobile pass

1. Open a pass link from the success page.
2. Confirm the event, ticket, buyer, valid date, and QR code appear.
3. Choose **Save pass to phone**.
4. Confirm a PNG is saved and can be opened from Photos or Files.
5. Turn off that phone’s internet connection and confirm the saved QR remains
   visible.
6. Keep the saved image open on one device for the scanner test.

When `EMAIL_PROVIDER=disabled`, the pass-email foundation records the order as
pending without sending. With the verified Resend production configuration,
the buyer receives one email containing every issued pass and a separate
offline-download link for each pass. The success page remains the backup
pass-delivery screen.

### 6. Create and use a scanner

1. Return to the director’s tournament overview.
2. Open **Gate tools**.
3. Create a temporary scanner link with the permission level you want to test.
4. Copy the one-time link and open it on another phone or browser.
5. Start the camera and allow camera access.
6. Scan the pass QR.
7. Confirm a green **VALID** result and a new `check_ins` row.

### 7. Verify duplicate blocking

1. Scan the same pass again.
2. Confirm the scanner returns **ALREADY SCANNED** instead of admitting it.
3. If testing a permitted override, enter a reason and confirm the audit record.
4. If testing undo, undo the eligible check-in and confirm the pass can be
   admitted again.

### 8. Verify lookup and manual check-in

1. Open **Manual lookup** from a scanner with lookup permission.
2. Search by buyer name, email, phone, or formatted order number.
3. Confirm only orders for that scanner’s tournament appear.
4. Manually check in an eligible unused pass.

### 9. Record a manual gate sale

1. Open **Gate sale** from a full-access scanner.
2. Select an active ticket, quantity, and payment method.
3. Add optional buyer and note details.
4. Record the sale.
5. Confirm the sale appears in director reporting.

This records external payment only. It does not charge a card or create a
digital pass.

### 10. Review dashboards

1. Open the tournament’s **Sales** page.
2. Confirm online and manual totals match the test actions.
3. Open **Gate activity**.
4. Confirm successful, duplicate, invalid, manual, and override counts.

## Stripe success and pass creation

`POST /api/checkout` creates a pending order and immutable order-item snapshots
before redirecting to Stripe. Stripe sends a signed success event to
`POST /api/stripe/webhook`. The server retrieves the Checkout Session from
Stripe, requires a paid status, upserts one pass per purchased admission, and
marks the order paid.

The success page calls the same fulfillment function before displaying pass
links. Webhook retries and page reloads therefore do not create duplicate
passes.

## Scanner validation

The scanner token is hashed on the server and matched to an active,
non-revoked scanner session. Postgres then validates the pass, paid order,
tournament, date, status, and remaining uses inside one transaction.

The pass row is locked during admission. Two devices cannot both consume the
same remaining use. Every attempt is recorded; invalid raw tokens are stored
only as SHA-256 attempt hashes.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Known limitations

- Stripe is in test mode.
- Director accounts are invite-only.
- Refunds and disputes are not automated.
- Gate-sale recording does not process payment.
- Saved pass images work without internet on the buyer’s phone, but the gate
  scanner still needs internet to validate current status and prevent reuse.
- Apple Wallet and Google Wallet passes are postponed.
- Native apps and the waitlist site are postponed.

## Connected services

- GitHub: `LukeShew/tournibase-web-app`
- Vercel: `lukes-projects-0503cdb7/tournibase-web-app`
- Supabase project ref: `khwaafsdtgiymucppkmo`
