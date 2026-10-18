# TourniBase Web MVP Handoff

Last verified against the local repository: October 17, 2026

## Handoff status

All 19 numbered web MVP phases are complete. Stripe Connect direct charges are
deployed against the current test configuration.

The one-Vercel-project, one-Supabase-project staging/production split is
deployed. The additive and contract migrations are applied, and organizations
are isolated as `test` or `live`. Staging uses the onboarding Sandbox with a $0
TourniBase fee and forced test-email delivery. Production uses the live data
boundary with paid checkout disabled.

Production Supabase Auth signup and the trusted server organization-creation
path are enabled and independently verified. Live keys and both live webhook
destinations are configured. Dedicated card-only Checkout configurations are
created and saved in the correct Vercel scopes. The buyer-fee and refund-lifecycle
migrations are applied to the shared database.

The matching `7425b18` staging/production deployments are Ready, and the
eight-event connected-payment subscriptions are saved and verified in both
Stripe environments. Sandbox orders `2040`–`2043` verified normal partial/full,
pending-to-success, later-failed, and buyer-fee-inclusive refunds, with delivered
receipts. The nonzero fee run verified collection and full return of the $1.22
application fee. Staging is verified restored to `0`/`0`/`false` on Ready
deployment `4Xbukpk3HjwijJGkc6MvmVs3SvFk`; the stable $46.24 basket again has no
TourniBase fee. Production paid
checkout remains disabled. The user deferred real director onboarding to later;
this is future launch work, not a manual action needed from the user now.
The pilot director must complete live onboarding; genuine pilot payment and
payout evidence are not yet recorded. Do not describe local or Sandbox success
as a 100% guarantee of real payments. The current deployment receipt is tracked
in [Staging and Production Rollout](environment-rollout.md).

The final URL-ordering/refund-guidance source follow-up `f6be6cd` is deployed
and verified Ready on both hosts; the linked rollout receipt identifies them.
Local QA passed 277 tests across 34 files, ESLint, TypeScript, the production
webpack build, all 30 migrations, and the rollback SQL regression. Deployment status is verified
separately; local tests and a Ready deployment are not a completed hosted-QA
sign-off. See [Payment readiness QA](qa-payment-readiness-2026-10-17.md) and
[Public-site QA](qa-public-sites-2026-10-17.md) for observed results and limits.

The subsequent synchronization fix `7425b18` passed 295 tests across 35 files,
ESLint, TypeScript, and the production webpack build; matching deployments are
verified Ready. It allows at most five attempts with fresh snapshots and bounded
delays for competing refund updates, returns HTTP 202 when Stripe accepted a refund but local state
is still synchronizing, and refreshes an open order modal from the current
order by ID. Failed/pending/action-required outcomes remain distinct. No new
migration is needed. The triggering order-2043 webhook recovered automatically
after about 17 seconds; final refund amounts and emails were correct. See the
rollout receipt for deployment status and the QA report for provider evidence.

Production app:
[tournibase.com](https://tournibase.com)

## Repositories and services

| Item | Location |
| --- | --- |
| Web app repository | [LukeShew/tournibase-web-app](https://github.com/LukeShew/tournibase-web-app) |
| Local web app | `apps/tournibase-web-app` |
| Production hosting | Vercel project `tournibase-web-app` |
| Production database | Supabase project `khwaafsdtgiymucppkmo` |
| Payments | Direct charges to organizer accounts; onboarding Sandbox for staging and live Connect for production after final live setup |
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
| `STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION` | Server only | Required dedicated parent Checkout configuration: live `pmc_1URhTpBdjbPEH1ElDNVNmv70`, Sandbox `pmc_1URhX7BDCyF6XjOynzkBpyUD` |
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

The live payment-method configuration belongs only in Vercel Production. The
Sandbox configuration belongs in Preview restricted to branch `staging`, not
generic Preview. Both parent configurations enable cards plus eligible Apple
Pay/Google Pay, disable other methods, and disallow connected-account
customization. Wallet display depends on buyer eligibility/device. A new
configuration must be deployed before it affects Checkout.

Buyers see fee-inclusive one-pass offers and an updated full-order total before
entering contact information. Production adds 2% of ticket value plus $0.30 once
per paid order, not once per pass; staging and free orders remain fee-free.
Director ticket revenue excludes that buyer fee, but Stripe processing still
reduces director proceeds. Director price fields are base admission values, not
promises that buyers will pay that amount after mandatory fees.

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
| `POST /api/stripe/refund-order` | Requests and reconciles an authorized full remaining-order refund |
| `POST /api/stripe/refund-pass` | Requests a paid-pass refund including its allocated buyer fee |
| `GET /dev/email-preview` | Local-only branded pass-email preview; returns 404 in production |

## Database handoff

Hosted Supabase matches the 30 product and rollout migrations. The environment
split is recorded by:

- `20260829002309_add_app_environment_isolation.sql`
- `20260831003839_finalize_app_environment_isolation.sql`
- `20260831024917_restore_trusted_organization_creation.sql`
- `20261017234245_add_buyer_paid_tournibase_fees.sql`
- `20261018000545_track_refund_lifecycle.sql`

The environment-aware application split and latest buyer-fee/refund release
`7425b18` are deployed to both environments, with both deployments Ready and
the documented hosted refund cases verified. The last migration uses an October 18 UTC version but was
applied October 17 US Eastern. Hosted counts remained 2,037 orders, 4,910
passes, and six events, with zero initial lifecycle amounts and no new browser
order-write permission.

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

RLS is enabled on all 13 tables. Anonymous Data API access to tournaments and
ticket types is removed; public buyer pages use the server-side,
environment-aware data layer. Orders, passes, scanner records, and buyer data
remain private. Email delivery records and their atomic claim function are
available only to the server-side service role.

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
  all 11 public tables. Hosted Supabase now matches 30 migrations and all 13 public
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
  of admission subtotal plus 30 cents added for the buyer once per paid order
  after its launch gate passes. Director Stripe processing remains separate.
- Staging signup is disabled and redirects to production. Production Supabase
  Auth signup is enabled and independently verified, while direct authenticated
  organization inserts remain blocked.
- Supabase leaked-password protection is disabled because it is unavailable on
  the current plan. Directors must use strong, unique passwords. Enable
  it when the plan supports it. See
  [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Gate-sale recording tracks cash, Venmo, external-card, or comp payments but
  does not process those payments.
- Successful full Stripe refunds mark the order refunded, invalidate active
  or checked-in passes for that order, and send a buyer refund email.
- Pass-specific partial refunds are available from TourniBase order details;
  generic partial refunds created directly in Stripe remain order-level only.
- Pending/requires-action and failed/canceled refunds are tracked separately
  from successfully refunded money. Failed attempts need direct Stripe/support
  review, never automatic retry or automatic reactivation of blocked passes.
  An already-returned application fee is not automatically reversed.
- Both connected-payment destinations need `refund.created`, `refund.updated`,
  and `refund.failed` as well as `charge.refunded` and the four Checkout Session
  events. See [Refund and Support Process](refund-support.md).
- Disputes are not automated.
- Ticket quantity limits use an atomic pending checkout reservation so
  simultaneous buyers cannot oversell the remaining inventory.
- Saved pass PNGs work without buyer internet, but scanner devices require an
  internet connection for database validation.
- Apple Wallet and Google Wallet passes are postponed.

## Requirements before real customer payments

1. Finish the remaining [staging and production rollout](./environment-rollout.md)
   Sandbox and host-isolation regression.
2. Verify the already-configured live Connect keys, separate payment/account
   webhooks, eight payment event types, and dedicated card-only configuration
   on the new deployment while production checkout is disabled.
3. Have the pilot director complete Stripe-hosted onboarding in live mode.
4. Enable production checkout only for an authorized genuine pilot launch and
   observe a real admission purchase. Do not create a fabricated live payment
   solely for QA; repeatable purchase/refund tests belong in Sandbox.
5. Confirm the live connected-payment webhook marks the order paid and creates
   every pass.
6. Confirm the buyer receives the Resend email and can save every offline pass.
7. Open and scan every issued pass through a production scanner link.
8. Confirm ticket sales, the buyer's full charge, Stripe processing, the
   separately added 2% plus 30-cent TourniBase fee, director proceeds, and
   TourniBase reporting match Stripe; verify the director's real payout.
9. Refund a live purchase only when legitimately requested and authorized.
   Verify refund email and pass invalidation for that real refund; cover
   synthetic full/partial/pending/failed refund scenarios in Sandbox.
10. Follow the basic tournament-day support and refund process in
   [Refund and Support Process](./refund-support.md).

Do not mix Stripe accounts or modes. The secret key, publishable key, expected
platform account, connected-payment destination, and Accounts v2 destination
must all belong to the same exact live platform.
