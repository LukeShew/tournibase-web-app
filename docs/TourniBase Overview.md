# TourniBase Web App Overview

## Product boundary

TourniBase is a web-first youth basketball tournament admission system. The MVP focuses on selling spectator admission, validating passes at the gate, blocking invalid or duplicate use, and showing directors sales and gate activity.

The web app is separate from the existing TourniBase waitlist website:

- Separate GitHub repository
- Separate Vercel project
- Separate Supabase project
- Separate local checkout

## Web app MVP status

Last updated: July 4, 2026

- Current progress: Phases 1–14 of 19 are complete.
- Available now: director authentication, event creation, ticket management,
  public event pages, Stripe test checkout, paid-order fulfillment, and secure
  individual mobile passes with QR codes, plus secure scanner-link creation and
  revocation for gate staff, a mobile camera scanner, authoritative admission
  decisions, duplicate blocking, overrides, check-in undo, and permission-gated
  buyer and order lookup with manual pass check-in, plus persisted recent scan
  history for each scanner session, in-person gate sale tracking, and
  director-facing sales, revenue, admission, and gate-activity dashboards,
  plus a coach sharing flow with a parent-ready message and ticket QR code.
- Next planned phase: UI copy updates.
- Remaining launch work: final copy and documentation, demo data, quality
  checks, and release preparation.
- Payment mode: Stripe test mode. Live keys should be enabled only when the
  complete purchase and gate-entry flow is ready for real customers.
- Known launch dependency: production pass-link email delivery still needs a
  transactional email provider.

Keep this section updated whenever a phase is completed, scope changes, or a
launch dependency is added or resolved.

## Phase 1 status

Completed:

- Next.js App Router foundation
- Supabase server and browser clients
- Cookie-backed session refresh through `proxy.ts`
- Password login for invited directors
- Protected dashboard with server-side authorization
- Director profile role handling
- MVP tables, enum values, constraints, indexes, explicit Data API grants, and RLS policies

Database tables:

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

## Phase 2 status

Completed:

- Protected `/dashboard/tournaments/new` event creation route
- Server-validated tournament, date, venue, organizer, contact, description, and public-slug fields
- Youth basketball default enforced in both the app and database
- Automatic internal organization setup for a director's first event
- Collision-safe public slug generation
- Draft tournament creation through the signed-in director's RLS-protected Supabase session
- Redirect to `/dashboard/tournaments/[id]` after creation
- Tournament overview with dates, venue, public link, ticket-page status, sales setup status, and scanner-link count
- Working copy-ticket-link action
- Dashboard event links and empty-state creation flow

New tournaments stay in `draft` status. The public ticket page is not live until
the ticket-management and publishing phases are complete.

## Phase 3 status

Completed:

- Protected `/dashboard/tournaments/[id]/tickets` route
- Ticket type creation with name, price, date range, description, optional quantity limit, and status
- Ticket date validation against the tournament's own date range
- Prices normalized to two decimal places for future Stripe use
- Inline ticket editing
- One-click ticket activation and deactivation
- Ticket type counts and clear empty states
- App-level ownership checks plus existing RLS enforcement on every ticket mutation
- Event overview link to ticket management

The `sold_out` status remains available in the database for a later automated
inventory flow. Directors currently manage `active` and `inactive` states.

## Phase 4 status

Completed:

- Public buyer route at `/e/[event-slug]`
- Published-event lookup by public slug
- Active-ticket filtering enforced by explicit application filters and RLS
- Event dates, venue, address, organizer, description, and contact information
- Ticket pricing, validity, descriptions, quantity controls, and running order total
- Buyer first name, last name, email, phone, and optional team fields
- Admission and organizer support information
- Director publish and return-to-draft controls
- Publishing blocked until at least one active ticket exists
- Public metadata and no-index metadata for missing events

## Phase 5 status

Completed:

- Server-created Stripe Checkout Sessions using server-validated prices
- Pending order creation before redirecting to Stripe
- Immutable order-item snapshots for ticket name, price, quantity, and validity
- Stripe metadata linking the Checkout Session and PaymentIntent to the order
- Raw-body webhook signature verification
- Handling for immediate and delayed successful payments
- Failed status updates for expired and failed asynchronous Checkout Sessions
- Idempotent one-pass-per-ticket fulfillment
- Secure random pass tokens generated by Postgres
- `/order/success` payment confirmation and generated pass-link list
- Clear missing-configuration errors instead of crashes
- Server-only Supabase secret-key client; the key is never sent to browsers

Stripe-hosted Checkout is used so TourniBase does not collect card details.
The webhook and success page both call the same idempotent fulfillment path so
pass creation remains safe when Stripe retries or redirects quickly.

Production pass-link email delivery remains a documented TODO until
transactional email infrastructure is configured.

## Phase 6 status

Completed:

- Mobile-first `/p/[pass-token]` route for each individually issued pass
- Secure server-only lookup by UUID token
- Paid-order verification before any pass details are returned
- No anonymous database access to orders or passes
- QR codes containing only a secure validation token
- Tournament, ticket type, validity day, buyer, order, venue, and support details
- Active, upcoming, checked-in, refunded, voided, and expired display states
- No-index metadata on all pass pages
- Direct mobile-pass buttons from the payment confirmation page
- Fraud-protection guidance for buyers and gate staff

## Phase 7 status

Completed:

- Protected `/dashboard/tournaments/[id]/gate` route
- Event-specific gate name and staff assignments
- Scan-only, standard-gate, and full-gate permission levels
- Four-hour, eight-hour, twelve-hour, twenty-four-hour, and three-day expiration choices
- Cryptographically random 256-bit scanner tokens
- SHA-256 token hashing before database storage
- One-time display and copy flow for raw scanner links
- Active, expired, and revoked scanner-session history
- Immediate link revocation
- Database constraints for token hashes, expiration, revocation, labels, and permissions
- Existing director ownership checks and RLS enforcement on every scanner-session mutation

## Phase 8 status

Completed:

- Mobile-first `/scan/[scanner-token]` route
- Server-only scanner-token hashing and database lookup
- Active, expired, revoked, invalid, and unavailable scanner-link handling
- Scanner-session authorization before tournament or gate details are shown
- Tournament, venue, gate, staff, expiration, and readiness information
- Rear-camera QR scanning through pinned `@zxing/browser` packages
- Explicit camera start and stop controls
- Camera permission, missing-camera, in-use-camera, and insecure-context errors
- Manual pass-link and UUID entry fallback
- Shared pass-token parsing for mobile passes and the gate scanner
- Large pass-detected, invalid-QR, and camera-error result states
- Permission-aware manual lookup, recent-capture, and gate-sale controls
- Recent pass-code captures held only in the current browser session
- No raw scanner token or Supabase secret key is sent as component data

## Phase 9 status

Completed:

- Bound Server Actions connect each active scanner link to pass validation
- Atomic Postgres validation prevents concurrent duplicate admissions
- Scanner authorization, tournament ownership, payment, pass status, valid
  date, and prior-admission checks
- Large `VALID`, `ALREADY SCANNED`, `NOT VALID TODAY`, `INVALID PASS`, and
  `PASS NOT ACTIVE` gate results
- Ticket, tournament, gate, admit-count, and check-in-time details
- Every attempted scan recorded in `check_ins`
- Invalid attempts recorded with a nullable `pass_id` and SHA-256 attempt hash
  so raw scanned tokens are never stored
- Manual token entry recorded distinctly from camera scans
- Duplicate overrides require and store a reason
- Successful admissions can be undone from the scanner that created them
- Undo recalculates admissions and restores an eligible pass to active status
- Validation functions use atomic row locks and service-role-only execution
- Anonymous and authenticated browser roles cannot execute validation functions

The `check_ins.pass_id` column is nullable only for invalid scans where no pass
exists or where a pass belongs to another tournament. A database constraint
allows a missing pass only when the recorded result is `invalid`.

## Phase 10 status

Completed:

- Permission-gated `/scan/[scanner-token]/lookup` route
- Buyer search by name, email, phone, or formatted order number
- Tournament-scoped results limited to orders with issued passes
- Buyer, order, ticket, validity, payment, unused-pass, and scanned-pass details
- Manual check-in actions for eligible unused passes
- Manual admissions recorded through the same atomic validation engine as QR scans
- Immediate lookup-result refresh after successful manual admission
- Scanner authorization rechecked for every search and check-in action
- Private pass tokens resolved only on the server and never returned in lookup results
- Service-role-only lookup function with anonymous and authenticated execution revoked

## Time-zone handling

- Every tournament has a fixed IANA time zone.
- New tournaments currently default to `America/New_York`.
- Ticket validity is converted from the tournament's calendar dates to exact
  UTC instants using the tournament time zone.
- Buyer, director, pass, lookup, scanner, and recent-scan screens display event
  times in the tournament time zone rather than the viewer's device time zone.
- Device location and VPN usage cannot change a pass's admission window.
- Existing test-event tickets, order snapshots, and passes were re-anchored to
  full Eastern calendar days.

## Phase 11 status

Completed:

- Permission-gated `/scan/[scanner-token]/recent` route
- Persisted database history instead of browser-only recent results
- Activity restricted to the active scanner session represented by the link
- Time, validation result, ticket type, buyer, and gate details
- Manual-source, override, override-reason, and undone indicators
- Empty, error, and refresh states designed for mobile gate staff
- Tournament-time-zone display for every recorded scan
- Composite scanner-session and scan-time index for recent activity queries
- Security-invoker lookup function executable only by the server-side service role
- Anonymous and authenticated browser roles cannot execute the recent-scan function

## Phase 12 status

Completed:

- Permission-gated `/scan/[scanner-token]/sale` route
- Active ticket selection, quantity, payment method, optional buyer, and notes
- Cash, Venmo, external-card, and comp payment methods
- Server-calculated totals using the current ticket price
- Comp admissions recorded at zero dollars
- Clear success screen showing how many guests to admit
- Explicit notice that gate-sale tracking does not charge a card or issue a digital pass
- Atomic scanner authorization and ticket ownership validation in Postgres
- Gate sales stored with tournament, scanner session, ticket, quantity, method, amount, buyer, notes, and time
- Service-role-only gate-sale function with anonymous and authenticated execution revoked
- Public parent-checkout QR code on the director gate page
- Printable letter-size admission poster linking to the public ticket page

## Phase 13 status

Completed:

- Tournament overview with ticket-page status, sales status, scanner-link
  status, and a live event snapshot
- Sales dashboard at `/dashboard/tournaments/[id]/sales`
- Gate activity dashboard at `/dashboard/tournaments/[id]/scans`
- Gross online sales, estimated Stripe fees, estimated net payout, online
  tickets sold, manual gate sales, and total estimated admission revenue
- Sales breakdowns by ticket type and tournament-local sale date
- Total scan attempts, successful check-ins, duplicate attempts, invalid
  attempts, wrong-day attempts, manual check-ins, and overrides
- Live online-pass check-in progress, unscanned-pass totals, active scanner
  links, and estimated revenue
- Database-side aggregation to keep reporting work out of the browser
- Security-invoker metrics function restricted to authenticated users and
  protected by ownership checks plus existing row-level security

## Phase 14 status

Completed:

- Director sharing workspace at `/dashboard/tournaments/[id]/share`
- Public coach page at `/share/[event-slug]`
- Coach link that works without a TourniBase login
- Exact parent-ready admission message with one-click copying
- Share-by-text and share-by-email actions
- Public ticket link with direct open and copy actions
- Parent ticket QR code on the public coach page
- Coach-page access QR on the director page
- Published-event requirement for all public coach pages
- Director ownership checks for the protected sharing workspace

## Security model

- The publishable Supabase key is used by the web app.
- The Supabase secret key is used only in protected server routes and is never exposed to the browser.
- Stripe secret and webhook keys are server-only.
- Dashboard authorization is verified in Server Components and is not delegated only to Proxy.
- Directors can access data only through organizations they own.
- User roles are database-protected; a director can update only their own name.
- Published tournaments and active ticket types are the only records currently readable by anonymous users.
- Passes, orders, scanner sessions, check-ins, and manual sales are not anonymously readable.
- Validation, override, undo, gate-lookup, recent-scan, and gate-sale functions
  are security-invoker functions executable only by the server-side service
  role.
- The dashboard metrics function runs as the signed-in director, requires
  tournament ownership, and remains subject to row-level security.

## Next phase

Phase 15 updates product language across director, parent, and gate-staff
surfaces.
