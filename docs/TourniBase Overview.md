# TourniBase Web App Overview

## Product boundary

TourniBase is a web-first youth basketball tournament admission system. The MVP focuses on selling spectator admission, validating passes at the gate, blocking invalid or duplicate use, and showing directors sales and gate activity.

The web app is separate from the existing TourniBase waitlist website:

- Separate GitHub repository
- Separate Vercel project
- Separate Supabase project
- Separate local checkout

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

The form deliberately does not create orders or collect payment yet. Until
Phase 5 connects Stripe Checkout, submission shows a clear message confirming
that no order was created and no charge occurred.

## Security model

- The publishable Supabase key is used by the web app.
- Secret and service-role keys are never exposed to the browser.
- Dashboard authorization is verified in Server Components and is not delegated only to Proxy.
- Directors can access data only through organizations they own.
- User roles are database-protected; a director can update only their own name.
- Published tournaments and active ticket types are the only records currently readable by anonymous users.
- Passes, orders, scanner sessions, check-ins, and manual sales are not anonymously readable.

## Next phase

Phase 5 connects the buyer form to Stripe Checkout, stores a pending order,
handles the payment webhook, creates secure individual passes after payment,
and adds the order success page.
