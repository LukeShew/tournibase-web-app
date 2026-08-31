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
- Stripe Connect hosted onboarding and direct-charge payments
- Final repository review and MVP handoff complete
- Transactional pass email is live through Resend and passed a real test order
- Buyers can download each QR pass as a PNG for offline access
- Full Stripe refunds sync back into TourniBase and invalidate active passes
- Tournament organizers are the sellers and receive online proceeds in their
  connected Stripe accounts
- The one-Vercel-project, one-Supabase-project staging/production split is
  deployed, and both environment-isolation migrations are applied
- Staging uses the onboarding Sandbox with a $0 TourniBase fee and forced test
  email delivery; production is isolated to live data with paid checkout off
- Production Supabase Auth signup is enabled and independently verified; the
  trusted server organization-creation grant remains server-only
- Live Stripe keys and webhook destinations still must be configured before
  the controlled real-money launch test

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
- [Refund and Support Process](docs/refund-support.md)
- [Final MVP Handoff](docs/mvp-handoff.md)
- [Staging and Production Rollout](docs/environment-rollout.md)

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
- The canonical TourniBase Supabase project
- A Stripe platform account with Connect enabled in a Sandbox and live mode
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
| `TOURNIBASE_APP_ENVIRONMENT` | Server and build | `test` for staging or `live` for production |
| `TOURNIBASE_PAID_CHECKOUT_ENABLED` | Server only | Hosted paid-checkout kill switch |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Web-app Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Supabase publishable key protected by RLS |
| `SUPABASE_SECRET_KEY` | Server only | Paid-order fulfillment, pass lookup, and gate operations |
| `STRIPE_SECRET_KEY` | Server only | TourniBase Connect platform key used for Accounts v2 and direct-charge API calls |
| `TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID` | Server only | Expected Stripe platform account for this target; API calls fail if the key belongs to another Test mode, Sandbox, or live account |
| `STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET` | Server only | Verifies connected-account Checkout and refund events |
| `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET` | Server only | Verifies Accounts v2 onboarding, requirement, capability, and closure events |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser-safe configuration | Matching Stripe mode and account |
| `TOURNIBASE_PLATFORM_FEE_BPS` | Server only | `0` in staging and exactly `200` in production |
| `TOURNIBASE_PLATFORM_FEE_FIXED_CENTS` | Server only | `0` in staging and exactly `30` in production |
| `NEXT_PUBLIC_SITE_URL` | Browser and server | Base URL used for pass, scanner, success, and cancel links |
| `EMAIL_PROVIDER` | Server only | `disabled` locally; all hosted targets require `resend` |
| `RESEND_API_KEY` | Server only | Sending-only Resend API key |
| `EMAIL_FROM` | Server only | Verified sender, such as `TourniBase <passes@tournibase.com>` |
| `TOURNIBASE_EMAIL_OVERRIDE_TO` | Server only | Staging-only forced recipient; must be `lsautomates@gmail.com` |

Local values must use:

```text
TOURNIBASE_APP_ENVIRONMENT=test
TOURNIBASE_PAID_CHECKOUT_ENABLED=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID=acct_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
TOURNIBASE_PLATFORM_FEE_BPS=0
TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=0
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

Both hosted targets use the verified `tournibase.com` domain with
`EMAIL_PROVIDER=resend`, a sending-only `RESEND_API_KEY`, and:

```text
EMAIL_FROM=TourniBase <passes@tournibase.com>
```

Staging additionally forces all deliveries to `lsautomates@gmail.com` and adds
`[TEST]` to every subject. Production sends to the actual buyer and must not
define an override recipient.

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

The shared staging/production project ref is `khwaafsdtgiymucppkmo`. Hosted
runtime validation rejects a different project URL. Do not link this repository
to the waitlist project.

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

## Director accounts

The public signup flow is enabled only on production and creates a live
organization for the new director. Supabase Auth reports
`disable_signup: false`, and the trusted server database path was independently
verified on August 31, 2026.
Staging signup stays disabled; the existing `lsautomates@gmail.com` test account
remains the permanent staging workspace.
The signed-out staging entrance uses the normal public design, lists no test
data, sends account-creation links to production, and disables search indexing.
Hosted staging submits only the permanent test email to Supabase Auth; other
emails receive a generic rejection before password authentication.

The database trigger creates the matching protected `public.users` profile with
the `director` role. Confirm the shared Supabase Auth redirect allowlist contains
the production `/email-confirmed` URL listed in
[Staging and Production Rollout](docs/environment-rollout.md).

## Stripe setup

Keep every Stripe key, account, and webhook secret in its matching environment.
Staging uses the TourniBase onboarding Sandbox. Production uses the Connect
platform's live mode.

TourniBase is the Connect platform. Each organization creates one connected
Stripe account from **Settings → Payments** and completes Stripe-hosted
onboarding. The organizer is the seller and merchant of record. Paid Checkout
Sessions use direct charges on that organizer's connected account, so Stripe
deducts its processing fees and pays out the remaining balance according to
the organizer's Stripe payout schedule.

The application fee is calculated as
`round(order total × basis points / 10,000) + fixed cents`.

Staging must use:

```text
TOURNIBASE_PLATFORM_FEE_BPS=0
TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=0
```

Production must use exactly:

```text
TOURNIBASE_PLATFORM_FEE_BPS=200
TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=30
```

### Hosted endpoints

Create a connected-account payment webhook endpoint at:

```text
https://<environment-host>/api/stripe/webhook
```

Set **Events from** to **Connected accounts** and use **Snapshot** payloads.

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Enable delivery for events from connected accounts. Copy each endpoint's
`whsec_...` signing secret into that target's
`STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET`. The 19 old Test-mode
platform-account orders are historical reporting data. Do not configure their
old webhook secret against the new onboarding Sandbox.

Create a second Accounts v2 webhook endpoint at:

```text
https://<environment-host>/api/stripe/connect/webhook
```

Set **Events from** to **Your account** and use **Thin** payloads. Accounts v2
status notifications belong to the Connect platform account even though they
describe connected-account onboarding and capability changes.

Use the exact Accounts v2 subscriptions and rollout order in
[Staging and Production Rollout](docs/environment-rollout.md). Put that
endpoint's signing secret in `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET`.

TourniBase syncs full Stripe refunds back into order and pass statuses. See
[Refund and Support Process](docs/refund-support.md).

### Local webhook forwarding

1. Start the app with `npm run dev`.

2. In another terminal, sign in to Stripe:

   ```bash
   stripe login
   ```

3. Forward connected-account payment events:

   ```bash
   stripe listen --forward-connect-to localhost:3000/api/stripe/webhook
   ```

4. Copy the displayed `whsec_...` value into the local
   `STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET`.

5. Restart `npm run dev` after changing `.env.local`.

Test card:

```text
4242 4242 4242 4242
```

Use any future expiration date, any three-digit CVC, and any valid postal code.

Keep production paid checkout disabled until the complete real-money launch
test passes.

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
3. Choose **Save to device**.
4. Confirm the save page opens with a pass image and device-save actions.
5. Turn off that phone’s internet connection and confirm the saved QR remains
   visible.
6. Keep the saved image open on one device for the scanner test.

When `EMAIL_PROVIDER=disabled`, the pass-email foundation records the order as
pending without sending. With the verified Resend production configuration,
the buyer receives one email containing every issued pass and a separate
device-save link for each pass. The success page remains the backup
pass-delivery screen.

### 6. Create and use a scanner

1. Return to the director’s tournament overview.
2. Open **Gate tools**.
3. Expand **Create scanner link** and create a temporary scanner link with the
   permission level you want to test.
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

`POST /api/checkout` creates a pending order and immutable order-item and
payment-routing snapshots before redirecting to Stripe. For connected orders,
the Checkout Session is a direct charge on the organizer's account. Stripe
sends a signed connected-account success event to
`POST /api/stripe/webhook`. The server requires the event account and
environment to match the order before retrieving the Checkout Session from the
connected account, fulfilling passes, and marking the order paid.

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

- The environment split is deployed on `staging.tournibase.com` and
  `tournibase.com`, and migrations `20260829002309` and `20260831003839` are
  applied. Migration `20260831024917` restores trusted server-only organization
  creation. Production paid checkout remains disabled while live Stripe keys,
  webhooks, onboarding, and the controlled real-money test are unfinished.
- Existing Sandbox accounts do not become live accounts. Every production
  director must complete live onboarding before accepting real payments.
- Staging signup is disabled and redirects to production. Production Supabase
  Auth signup is enabled and independently verified, while direct authenticated
  organization inserts remain blocked.
- Directors initiate refunds in TourniBase. Stripe refund events then
  synchronize order and pass status, reverse the application fee when
  applicable, and trigger the buyer refund email. Dispute handling is not
  automated.
- Gate-sale recording does not process payment.
- Saved pass images work without internet on the buyer’s phone, but the gate
  scanner still needs internet to validate current status and prevent reuse.
- Apple Wallet and Google Wallet passes are postponed.
- Native apps and the waitlist site are postponed.

## Connected services

- GitHub: `LukeShew/tournibase-web-app`
- Vercel: `lukes-projects-0503cdb7/tournibase-web-app`
- Supabase project ref: `khwaafsdtgiymucppkmo`
