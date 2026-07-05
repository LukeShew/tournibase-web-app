# Local Demo Data

Last updated: July 4, 2026

Phase 17 adds a repeatable demo tournament for local development only.

## Safety

`npm run seed` refuses to connect unless `NEXT_PUBLIC_SUPABASE_URL` uses one of
these local hostnames:

- `localhost`
- `127.0.0.1`
- `::1`

The automatic `supabase/seed.sql` file contains only the server-role grants
needed by the local Supabase stack. It contains no demo accounts, tournaments,
tickets, orders, or passes. The guarded JavaScript seed remains the only process
that creates demo records.

## Demo records

- Director: **TourniBase Demo Director**
- Organization: **TourniBase Demo Events**
- Tournament: **DMV Summer Tip-Off Classic**
- Venue: **Capital Sports Complex**
- Time zone: **America/New_York**
- Status: **Published**
- Dates: the next Saturday and Sunday each time the seed runs

Ticket types:

- Saturday Pass — $20
- Sunday Pass — $20
- Weekend Pass — $30
- Student/Child Pass — $10

## Preview without changing data

```bash
npm run seed:preview
```

This prints the records and calculated dates without reading environment
variables or connecting to Supabase.

## Create the local demo

1. Start the local Supabase stack:

   ```bash
   npx supabase start
   ```

2. Apply all migrations to a clean local database:

   ```bash
   npx supabase db reset --local
   ```

3. Run `npx supabase status` and copy the local API URL, publishable key, and
   secret key into `.env.local`.

4. Confirm the URL starts with `http://127.0.0.1:54321` or another local
   hostname.

5. Create or refresh the demo records:

   ```bash
   npm run seed
   ```

6. Start the web app:

   ```bash
   npm run dev
   ```

## Demo login

```text
Email: demo.director@tournibase.test
Password: TourniBaseDemo123!
```

Public event page:

```text
http://localhost:3000/e/dmv-summer-tip-off-classic
```

## Repeat behavior

The command can be run again safely:

- It reuses the same demo Auth user and organization.
- It updates the demo tournament to the next Saturday and Sunday.
- It updates the four named ticket types instead of duplicating them.

For a completely clean local database, run:

```bash
npx supabase db reset --local
npm run seed
```

Never use `--linked`, a hosted Supabase URL, or production environment values
for this demo flow.
