# TourniBase Web App

Separate web-first application for TourniBase tournament admission. This repository does not deploy or modify the existing waitlist website.

## Phase 1

- Next.js App Router with TypeScript and Tailwind CSS
- Supabase password authentication with cookie-backed server sessions
- Server-side director authorization on every dashboard request
- Protected `/dashboard` route
- Complete MVP database schema with explicit grants, RLS policies, constraints, and indexes

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
