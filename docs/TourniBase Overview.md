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

## Security model

- The publishable Supabase key is used by the web app.
- Secret and service-role keys are never exposed to the browser.
- Dashboard authorization is verified in Server Components and is not delegated only to Proxy.
- Directors can access data only through organizations they own.
- User roles are database-protected; a director can update only their own name.
- Published tournaments and active ticket types are the only records currently readable by anonymous users.
- Passes, orders, scanner sessions, check-ins, and manual sales are not anonymously readable.

## Next phase

Phase 2 adds director organization onboarding and `/dashboard/tournaments/new`, including tournament details, dates, venue, public slug, ticket types, and publish controls.
