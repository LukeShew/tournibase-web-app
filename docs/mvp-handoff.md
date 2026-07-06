# TourniBase Web MVP Handoff

Last verified: July 6, 2026

## Handoff status

All 19 numbered web MVP phases are complete.

The app is deployed, remains in Stripe test mode, and is suitable for product
demos and controlled testing. It is not ready to accept real customer payments
until the launch requirements in this document are complete.

Production app:
[tournibase.com](https://tournibase.com)

## Repositories and services

| Item | Location |
| --- | --- |
| Web app repository | [LukeShew/tournibase-web-app](https://github.com/LukeShew/tournibase-web-app) |
| Local web app | `apps/tournibase-web-app` |
| Production hosting | Vercel project `tournibase-web-app` |
| Production database | Supabase project `khwaafsdtgiymucppkmo` |
| Payments | Stripe test mode |
| Transactional email | Resend from `passes@tournibase.com` |
| Refund support | Manual Stripe refunds with automatic full-refund pass invalidation |

The postponed waitlist website remains in the separate
[LukeShew/TourniBase](https://github.com/LukeShew/TourniBase) repository.

## Required environment variables

Never commit real values. Use `.env.local` for local development and encrypted
Vercel environment variables for hosted deployments.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Web-app Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Supabase publishable key protected by RLS |
| `SUPABASE_SECRET_KEY` | Server only | Fulfillment, pass lookup, and gate operations |
| `STRIPE_SECRET_KEY` | Server only | Creates and verifies Stripe Checkout Sessions |
| `STRIPE_WEBHOOK_SECRET` | Server only | Verifies signed Stripe webhook requests |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser-safe | Stripe key matching the configured mode and account |
| `NEXT_PUBLIC_SITE_URL` | Browser and server | Base URL for checkout, pass, scanner, and success links |
| `EMAIL_PROVIDER` | Server only | `disabled` locally; `resend` after production activation |
| `RESEND_API_KEY` | Server only | Sending-only Resend API key |
| `EMAIL_FROM` | Server only | Verified TourniBase sender address |

`NEXT_PUBLIC_SITE_URL` is `http://localhost:3000` locally and
`https://tournibase.com` in production.

## Route inventory

### Public and buyer routes

| Route | Purpose |
| --- | --- |
| `/` | Product entry page |
| `/login` | Director sign-in |
| `/e/[event-slug]` | Public event page and ticket selection |
| `/share/[event-slug]` | Parent and coach sharing page |
| `/order/success` | Paid-order confirmation and pass links |
| `/p/[pass-token]` | Individual mobile QR pass |
| `/p/[pass-token]/offline-pass.png` | Private downloadable offline pass PNG |

### Director routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Director tournament list |
| `/dashboard/tournaments/new` | Create a tournament |
| `/dashboard/tournaments/[id]` | Tournament overview and publishing |
| `/dashboard/tournaments/[id]/tickets` | Ticket type management |
| `/dashboard/tournaments/[id]/gate` | Scanner-link management |
| `/dashboard/tournaments/[id]/sales` | Sales dashboard |
| `/dashboard/tournaments/[id]/scans` | Gate-activity dashboard |
| `/dashboard/tournaments/[id]/share` | Sharing tools |
| `/print/tournaments/[id]/gate-poster` | Printable public-checkout poster |

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
| `POST /api/stripe/webhook` | Verifies Stripe events, fulfills paid orders, and syncs refunds |
| `GET /dev/email-preview` | Local-only branded pass-email preview; returns 404 in production |

## Database handoff

Production has 12 applied product migrations. The local repository contains the
same 12 migrations, so there is no migration drift.

The 11 public application tables are:

- `users`
- `organizations`
- `tournaments`
- `ticket_types`
- `orders`
- `order_items`
- `passes`
- `scanner_sessions`
- `check_ins`
- `manual_sales`
- `order_email_deliveries`

RLS is enabled on all 11 tables. Anonymous access is limited to published
tournaments and active ticket types. Orders, passes, scanner records, and buyer
data remain private. Email delivery records and their atomic claim function are
available only to the server-side service role.

`supabase/seed.sql` contains local service-role grants but no demo records.
The guarded `npm run seed` command creates demo data only when the Supabase URL
uses a local hostname.

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
5. Keep the Stripe variables in test mode.
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

## Final verification

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
- Production and local Supabase have all 12 migrations and RLS on all 11 public
  tables.
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
- Refund webhook code maps full Stripe refunds to refunded orders and passes.

## Known limitations

- The branded order email, plain-text fallback, delivery tracking, duplicate
  protection, retry states, and Resend delivery are active in production.
- Stripe remains in test mode.
- Director accounts are invite-only and created through Supabase.
- Supabase leaked-password protection is disabled because it is unavailable on
  the current plan. Use strong, unique passwords for invited directors. Enable
  it when the plan supports it. See
  [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Gate-sale recording tracks cash, Venmo, external-card, or comp payments but
  does not process those payments.
- Full Stripe refunds automatically mark the order refunded and invalidate
  active or checked-in passes for that order.
- Partial refunds are tracked at the order level, but pass-specific partial
  refund handling is not automated.
- Disputes are not automated.
- Ticket quantity limits are not a reserved-inventory system for heavy
  simultaneous demand.
- Saved pass PNGs work without buyer internet, but scanner devices require an
  internet connection for database validation.
- Apple Wallet and Google Wallet passes are postponed.

## Requirements before real customer payments

1. Switch the Stripe secret key, publishable key, and webhook to live mode
   together.
2. Run one low-value purchase with a real card.
3. Confirm the live webhook marks the order paid and creates every pass.
4. Confirm the buyer receives the Resend email and can save every offline pass.
5. Open and scan every issued pass through a production scanner link.
6. Confirm TourniBase sales totals match Stripe.
7. Fully refund one test order and confirm the scanner blocks the refunded
   pass.
8. Follow the basic tournament-day support and refund process in
   [Refund and Support Process](./refund-support.md).

Do not switch only one Stripe key to live mode. All Stripe variables and the
production webhook must use the same account and mode.
