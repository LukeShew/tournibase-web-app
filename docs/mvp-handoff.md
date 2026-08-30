# TourniBase Web MVP Handoff

Last verified against the local repository: August 30, 2026

## Handoff status

All 19 numbered web MVP phases are complete. Stripe Connect direct charges are
deployed against the current test configuration.

The one-Vercel-project, one-Supabase-project staging/production split is
implemented locally but is not deployed. Its additive migration is prepared but
not applied, and the post-deploy contract remains outside migration history.
The app is not ready to accept real customer payments until the ordered
[environment rollout](./environment-rollout.md), live onboarding, and controlled
real-money test are complete.

Production app:
[tournibase.com](https://tournibase.com)

## Repositories and services

| Item | Location |
| --- | --- |
| Web app repository | [LukeShew/tournibase-web-app](https://github.com/LukeShew/tournibase-web-app) |
| Local web app | `apps/tournibase-web-app` |
| Production hosting | Vercel project `tournibase-web-app` |
| Production database | Supabase project `khwaafsdtgiymucppkmo` |
| Payments | Direct charges to organizer accounts; onboarding Sandbox for staging and live Connect for production after rollout |
| Transactional email | Resend from `passes@tournibase.com` |
| Refund support | TourniBase full-order and pass-specific refunds with connected-account webhook synchronization |

The postponed waitlist website remains in the separate
[LukeShew/TourniBase](https://github.com/LukeShew/TourniBase) repository.

## Required environment variables

Never commit real values. Use `.env.local` for local development and encrypted
Vercel environment variables for hosted deployments.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `TOURNIBASE_APP_ENVIRONMENT` | Server and build | `test` for staging or `live` for production |
| `TOURNIBASE_PAID_CHECKOUT_ENABLED` | Server only | Hosted paid-checkout kill switch |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Web-app Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Supabase publishable key protected by RLS |
| `SUPABASE_SECRET_KEY` | Server only | Fulfillment, pass lookup, and gate operations |
| `STRIPE_SECRET_KEY` | Server only | Connect platform key for Accounts v2 and connected payment API calls |
| `TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID` | Server only | Expected platform account for this exact Sandbox or live target |
| `STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET` | Server only | Verifies connected-account payment and refund events |
| `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET` | Server only | Verifies Accounts v2 onboarding, requirement, capability, and closure events |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser-safe | Stripe key matching the configured mode and account |
| `TOURNIBASE_PLATFORM_FEE_BPS` | Server only | `0` in staging and exactly `200` in production |
| `TOURNIBASE_PLATFORM_FEE_FIXED_CENTS` | Server only | `0` in staging and exactly `30` in production |
| `NEXT_PUBLIC_SITE_URL` | Browser and server | Base URL for checkout, pass, scanner, and success links |
| `EMAIL_PROVIDER` | Server only | `disabled` locally; every hosted target requires `resend` |
| `RESEND_API_KEY` | Server only | Sending-only Resend API key |
| `EMAIL_FROM` | Server only | Verified TourniBase sender address |
| `TOURNIBASE_EMAIL_OVERRIDE_TO` | Server only | Staging-only forced recipient; must be `lsautomates@gmail.com` and must never exist in production |

`NEXT_PUBLIC_SITE_URL` is `http://localhost:3000` locally,
`https://staging.tournibase.com` on the staging branch, and
`https://tournibase.com` in production.

## Route inventory

### Public and buyer routes

| Route | Purpose |
| --- | --- |
| `/` | Product entry page |
| `/signup` | Production director signup; staging redirects here on production |
| `/login` | Director sign-in |
| `/email-confirmed` | Production email-confirmation result |
| `/e/[event-slug]` | Public event page and ticket selection |
| `/share/[event-slug]` | Parent and coach sharing page |
| `/order/success` | Paid-order confirmation and pass links |
| `/p/[pass-token]` | Individual mobile QR pass |
| `/p/[pass-token]/save` | Buyer-friendly offline save page |
| `/p/[pass-token]/offline-pass.png` | Private downloadable offline pass PNG |

### Director routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Director tournament list |
| `/dashboard/tournaments/new` | Create a tournament |
| `/dashboard/tournaments/[id]` | Tournament overview and publishing |
| `/dashboard/tournaments/[id]/edit` | Event detail editing |
| `/dashboard/tournaments/[id]/tickets` | Ticket type management |
| `/dashboard/tournaments/[id]/gate` | Scanner-link management |
| `/dashboard/tournaments/[id]/orders` | Searchable order details and connected-payment refunds |
| `/dashboard/tournaments/[id]/scans` | Gate-activity dashboard |
| `/dashboard/tournaments/[id]/share` | Sharing tools |
| `/dashboard/settings` | Profile and organization Stripe Connect onboarding/status |
| `/print/tournaments/[id]/gate-poster` | Legacy printable public-checkout poster |

### Scanner routes

Scanner URLs contain temporary credentials and should be shared only with
authorized gate staff.

| Route | Purpose |
| --- | --- |
| `/scan/[scanner-token]` | Camera scanner and manual token entry |
| `/scan/[scanner-token]/lookup` | Buyer and order lookup |
| `/scan/[scanner-token]/recent` | Persisted recent scanner activity |
| `/scan/[scanner-token]/sale` | Optional external gate-sale recording |

### Server routes

| Route | Purpose |
| --- | --- |
| `POST /api/checkout` | Validates a cart and creates Stripe Checkout |
| `POST /api/stripe/webhook` | Verifies connected-account payment events, fulfills paid orders, and syncs refunds |
| `GET/POST /api/stripe/connect/start` | Creates an authorized organization's account and opens hosted onboarding |
| `GET/POST /api/stripe/connect/refresh` | Synchronizes account status |
| `POST /api/stripe/connect/dashboard` | Opens the exact connected account in Stripe Dashboard |
| `POST /api/stripe/connect/webhook` | Synchronizes account status, requirements, capabilities, and closure |
| `POST /api/stripe/dashboard-payment` | Opens a connected order's payment in Stripe Dashboard |
| `GET /dev/email-preview` | Local-only branded pass-email preview; returns 404 in production |

## Database handoff

Production matches the 25 committed product migrations, including Stripe
Connect. The additive environment-isolation migration is prepared locally as
`20260829002309_add_app_environment_isolation.sql` but has not been applied.
The contract SQL stays under `supabase/post-deploy` until the same
environment-aware build is verified on both stable hosts.

The current 13 public application tables are:

- `users`
- `organizations`
- `organization_stripe_accounts`
- `tournaments`
- `ticket_types`
- `orders`
- `order_items`
- `passes`
- `scanner_sessions`
- `check_ins`
- `manual_sales`
- `order_email_deliveries`
- `rate_limit_buckets`

RLS is enabled on all 13 tables. Anonymous access is currently limited to published
tournaments and active ticket types. Orders, passes, scanner records, and buyer
data remain private. Email delivery records and their atomic claim function are
available only to the server-side service role. The post-deploy contract removes
the remaining anonymous Data API path after both stable hosts are environment
aware.

`supabase/seed.sql` contains local service-role grants but no demo records. The
guarded `npm run seed` command creates demo data only when the Supabase URL uses
a local hostname. Existing hosted sample records are classified into the
permanent staging environment by the additive migration.

See [Database Schema](./database-schema.md) for tables, functions, policies, and
migration history.

## Local demo

Docker is needed only for the private local Supabase database. It is not needed
to use the live website.

1. Open Docker Desktop.
2. Start local Supabase:

   ```bash
   npx supabase start
   ```

3. Rebuild the local database when a clean copy is needed:

   ```bash
   npx supabase db reset --local
   ```

4. Put the local API URL, publishable key, and secret key from
   `npx supabase status` in `.env.local`.
5. Keep the Stripe variables in the same Stripe Sandbox.
6. Create or refresh the demo:

   ```bash
   npm run seed
   ```

7. Start the website:

   ```bash
   npm run dev
   ```

Demo director:

```text
Email: demo.director@tournibase.test
Password: TourniBaseDemo123!
```

Demo event:
`http://localhost:3000/e/dmv-summer-tip-off-classic`

## Pre-Connect verification

Verified July 5, 2026:

- Both Git repositories matched their GitHub `main` branches before Phase 19
  changes.
- No real Supabase, Stripe, database, or private-key secrets were found in
  tracked files or Git history.
- Private `.env*` files and `.vercel` are ignored; only the placeholder
  `.env.example` is tracked.
- `npm install` completed with the lockfile already current.
- ESLint passed with zero warnings.
- TypeScript passed with zero errors.
- The optimized Next.js production build passed.
- Ten automated email and pass-display tests passed.
- `npm audit --omit=dev` found zero vulnerabilities.
- The production URL returned HTTP 200 from Vercel.
- At that time, production and local Supabase had all 12 migrations and RLS on
  all 11 public tables. Production now matches 25 migrations and all 13 public
  application tables have RLS enabled.
- The email delivery table blocks anonymous and signed-in browser access while
  allowing only the service role to claim deliveries.
- A transaction-only database test confirmed the first email claim succeeds and
  a simultaneous second claim is blocked.
- A clean local database reset applied all migrations and local grants.
- The local demo seed completed after the clean reset using temporary local
  Supabase variables without changing `.env.local`.
- Supabase advisors reported no database security errors.
- A real Stripe test purchase delivered the TourniBase pass email through
  Resend.
- A local paid-pass test generated a private 900 × 1200 PNG with the expected
  filename, no-store headers, and QR encoding the expected pass token.
- Refund webhook code maps full Stripe refunds to refunded orders and passes,
  and sends the buyer a TourniBase refund confirmation email.

## Known limitations

- The branded order email, plain-text fallback, delivery tracking, duplicate
  protection, retry states, and Resend delivery are active in production.
- The permanent staging workspace remains in the onboarding Sandbox. Sandbox
  onboarding does not carry into live mode.
- One organization supports one connected account per environment. Account
  switching and self-service disconnection are intentionally unavailable
  during the pilot.
- Stripe controls the director's payout schedule. TourniBase does not hold
  tournament proceeds.
- Staging takes no application fee. Production is configured for exactly 2%
  plus 30 cents after its launch gate passes.
- Directors create accounts from the production signup page. Staging signup is
  disabled.
- Supabase leaked-password protection is disabled because it is unavailable on
  the current plan. Use strong, unique passwords for invited directors. Enable
  it when the plan supports it. See
  [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Gate-sale recording tracks cash, Venmo, external-card, or comp payments but
  does not process those payments.
- Full Stripe refunds automatically mark the order refunded, invalidate active
  or checked-in passes for that order, and send a buyer refund email.
- Pass-specific partial refunds are available from TourniBase order details;
  generic partial refunds created directly in Stripe remain order-level only.
- Disputes are not automated.
- Ticket quantity limits use an atomic pending checkout reservation so
  simultaneous buyers cannot oversell the remaining inventory.
- Saved pass PNGs work without buyer internet, but scanner devices require an
  internet connection for database validation.
- Apple Wallet and Google Wallet passes are postponed.

## Requirements before real customer payments

1. Complete the ordered [staging and production rollout](./environment-rollout.md),
   including its additive migration, dual environment-aware deployments, and
   post-deploy contract migration.
2. Configure live Connect settings and separate connected-payment and
   account-status webhook endpoints while production checkout is disabled.
3. Have the pilot director complete Stripe-hosted onboarding in live mode.
4. Enable production checkout only for the controlled gate and run one
   low-value purchase with a real card.
5. Confirm the live connected-payment webhook marks the order paid and creates
   every pass.
6. Confirm the buyer receives the Resend email and can save every offline pass.
7. Open and scan every issued pass through a production scanner link.
8. Confirm gross sales, Stripe fees, the 2% plus 30-cent TourniBase fee,
   director proceeds, and TourniBase reporting match Stripe.
9. Fully refund the test order, confirm the buyer receives the refund email,
   and confirm the scanner blocks the refunded pass.
10. Follow the basic tournament-day support and refund process in
   [Refund and Support Process](./refund-support.md).

Do not mix Stripe accounts or modes. The secret key, publishable key, expected
platform account, connected-payment destination, and Accounts v2 destination
must all belong to the same exact live platform.
