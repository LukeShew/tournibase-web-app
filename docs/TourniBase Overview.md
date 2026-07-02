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

## Security model

- The publishable Supabase key is used by the web app.
- Secret and service-role keys are never exposed to the browser.
- Dashboard authorization is verified in Server Components and is not delegated only to Proxy.
- Directors can access data only through organizations they own.
- User roles are database-protected; a director can update only their own name.
- Published tournaments and active ticket types are the only records currently readable by anonymous users.
- Passes, orders, scanner sessions, check-ins, and manual sales are not anonymously readable.

## Next phase

Phase 3 adds `/dashboard/tournaments/[id]/tickets`, where directors can create,
edit, activate, and deactivate admission ticket types with prices, validity
dates, descriptions, and optional quantity limits.
