# TourniBase Web App

Separate web-first application for TourniBase tournament admission. This repository does not deploy or modify the existing waitlist website.

## Completed phases

Phase 1:

- Next.js App Router with TypeScript and Tailwind CSS
- Supabase password authentication with cookie-backed server sessions
- Server-side director authorization on every dashboard request
- Protected `/dashboard` route
- Complete database foundation with explicit grants, RLS policies, constraints, and indexes

Phase 2:

- Protected admission-event creation at `/dashboard/tournaments/new`
- Server-side validation and RLS-protected Supabase inserts
- Automatic organization setup for a director's first event
- Draft event overview at `/dashboard/tournaments/[id]`
- Public ticket-link reservation and copy action
- Event status, venue, sales-setup, and scanner-link summaries

Phase 3:

- Ticket type management at `/dashboard/tournaments/[id]/tickets`
- Create and edit ticket names, prices, validity dates, descriptions, and quantity limits
- Activate and deactivate ticket types
- Server-side validation, ownership checks, and RLS-protected mutations

Phase 4:

- Buyer-facing event pages at `/e/[event-slug]`
- Public event, venue, organizer, admission-policy, and support information
- Active ticket options with pricing, validity dates, descriptions, and quantity controls
- Buyer contact form with order total calculation
- Director publishing controls that require at least one active ticket

Phase 5:

- Stripe-hosted Checkout Sessions created from server-validated ticket prices and quantities
- Pending orders and immutable order-item snapshots before payment
- Signed Stripe webhook handling at `/api/stripe/webhook`
- Idempotent creation of one secure pass per paid ticket
- Payment confirmation and generated pass links at `/order/success`
- Clear configuration errors when required Stripe or Supabase server keys are missing

Phase 6:

- Mobile-first individual passes at `/p/[pass-token]`
- Server-only lookup by secure UUID with no anonymous order or pass access
- QR codes containing only a secure validation token
- Event, ticket, validity, guest, order, venue, and organizer support details
- Clear active, upcoming, used, refunded, voided, and expired pass states
- Direct mobile-pass buttons on the order confirmation page

Phase 7:

- Director-only scanner access management at `/dashboard/tournaments/[id]/gate`
- Cryptographically random scanner tokens with only SHA-256 hashes stored
- Scan-only, standard-gate, and full-gate permission levels
- Automatic expiration choices from four hours to three days
- One-time scanner-link display and copy flow
- Active, expired, and revoked scanner-session history
- Immediate scanner-link revocation

Phase 8:

- Mobile gate scanner at `/scan/[scanner-token]`
- Server-only scanner-token hashing and active-session authorization
- Event, venue, gate, staff, expiration, and readiness information
- Rear-camera QR scanning with the pinned ZXing browser library
- Manual pass-link and UUID entry when camera scanning is unavailable
- Large pass-detected, invalid-QR, and camera-error states
- Permission-aware manual lookup, recent-capture, and gate-sale controls

Phase 9:

- Atomic server-side pass validation and admission recording
- Scanner, tournament, paid-order, pass-status, valid-date, and duplicate checks
- Large valid, already-scanned, wrong-day, invalid, and inactive-pass results
- Every scan attempt recorded without storing raw scanned tokens
- Invalid attempts supported through nullable `check_ins.pass_id` values
- Manual token entry recorded as a manual check-in
- Duplicate admission overrides with required reasons
- Check-in undo with pass-status restoration
- Service-role-only validation functions with no anonymous or director execution

Phase 10:

- Permission-gated manual lookup at `/scan/[scanner-token]/lookup`
- Buyer search by name, email, phone, or order number
- Tournament-scoped order results with ticket and pass status details
- Unused-pass and already-scanned counts
- Manual check-in of eligible passes through the same validation engine as QR scans
- Server-only pass-token handling and service-role-only lookup access

Phase 11:

- Persisted recent scanner activity at `/scan/[scanner-token]/recent`
- Time, result, ticket type, buyer, gate, source, override, and undo details
- Activity restricted to the active scanner session and its permissions
- Mobile refresh and empty states
- Service-role-only recent-scan function

Phase 12:

- Permission-gated gate-sale tracking at `/scan/[scanner-token]/sale`
- Active ticket, quantity, cash, Venmo, external-card, and comp recording
- Optional buyer name and notes
- Server-calculated totals with zero-dollar comps
- Public ticket QR code and printable parent self-checkout poster
- Service-role-only gate-sale function

Phase 13:

- Live sales and admission snapshot on each tournament overview
- Sales dashboard at `/dashboard/tournaments/[id]/sales`
- Gate activity dashboard at `/dashboard/tournaments/[id]/scans`
- Gross online sales, estimated Stripe fees and payout, ticket totals, manual sales, and total estimated revenue
- Sales breakdowns by ticket type and tournament-local sale date
- Scan attempts, successful check-ins, duplicate, invalid, wrong-day, manual, and override totals
- Active scanner-link counts and online-pass check-in progress
- RLS-protected database aggregation available only to the owning director

Phase 14:

- Director sharing workspace at `/dashboard/tournaments/[id]/share`
- Public coach page at `/share/[event-slug]` with no coach account required
- Exact parent-ready admission message with one-click copy
- Share-by-text and share-by-email actions
- Public ticket link, copy action, and direct ticket-page access
- Parent ticket QR code on the coach page
- Coach-page link and access QR for the tournament director
- Unpublished events remain unavailable on the public coach route

Time-zone handling:

- Tournament dates are anchored to the tournament's IANA time zone
- New events currently default to `America/New_York`
- Admission windows and gate timestamps do not change with device location or VPN use

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Add the separate web-app Supabase URL, publishable key, and server-only
   secret key.

4. Add Stripe test keys and the webhook signing secret shown in
   `.env.example`.

5. Apply the Supabase migrations.

6. Start the app:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

## Stripe setup

Create a Stripe webhook endpoint for:

```text
https://tournibase-web-app.vercel.app/api/stripe/webhook
```

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

For local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use Stripe test card `4242 4242 4242 4242`, any future expiration date,
any three-digit CVC, and any postal code.

Production confirmation email delivery is intentionally left as a TODO until
transactional email infrastructure is configured.

## First director account

Create the first account in the Supabase dashboard under **Authentication → Users → Add user**. The database trigger automatically creates its protected `public.users` director profile.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Connected services

- GitHub: `LukeShew/tournibase-web-app`
- Vercel: `lukes-projects-0503cdb7/tournibase-web-app`
- Supabase project ref: `khwaafsdtgiymucppkmo`
