# TourniBase Web App

Separate web-first application for TourniBase tournament admission. This repository does not deploy or modify the existing waitlist website.

## Completed phases

Phase 1:

- Next.js App Router with TypeScript and Tailwind CSS
- Supabase password authentication with cookie-backed server sessions
- Server-side director authorization on every dashboard request
- Protected `/dashboard` route
- Complete MVP database schema with explicit grants, RLS policies, constraints, and indexes

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
- Honest pre-checkout state until Stripe Checkout is connected in Phase 5

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

3. Add the separate web-app Supabase URL and publishable key.

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

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
