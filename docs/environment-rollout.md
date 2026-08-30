# Staging and Production Rollout

TourniBase uses one Vercel project and one Supabase project. The application,
database, and Stripe checks keep test and live data separate.

This environment split is implemented locally. It has not been deployed, the
additive migration has not been applied, and the post-deploy contract is not in
migration history yet.

## Environment contract

| Setting | Staging | Production |
| --- | --- | --- |
| Stable URL | `https://staging.tournibase.com` | `https://tournibase.com` |
| Git target | `staging` branch | `main` branch |
| Vercel target | Branch-scoped Preview | Production |
| `TOURNIBASE_APP_ENVIRONMENT` | `test` | `live` |
| Stripe | TourniBase onboarding Sandbox | Live Connect platform |
| Paid checkout | Enabled for testing | Disabled until the real-money test passes |
| TourniBase fee | `0` bps + `0` cents | Exactly `200` bps + `30` cents |
| Transactional recipient | Forced to `lsautomates@gmail.com` | Actual buyer |
| Email subject | Starts with `[TEST]` | Normal subject |
| Public entrance | Same public homepage and sign-in design as production; no test data is listed | Normal public homepage and sign-in |
| Public signup | Disabled | Enabled |
| Search indexing | Disabled | Enabled |

Both targets must use the canonical Supabase project
`khwaafsdtgiymucppkmo`. Do not create a second Supabase or Vercel project for
staging.

The staging host is intentionally reachable because Stripe must be able to send
webhooks and return directors from hosted onboarding. Its signed-out homepage
and login page use the normal TourniBase design and contain no staging label or
test-event listing. Every staging signup link goes to the production signup
page, while a direct request to staging `/signup` redirects there. Protected
director pages still require the staging account, test ticket pages require
their direct URL, and every staging application response carries a no-index
header. Static asset URLs do not expose director or event data.

## Existing-data classification

The August 28, 2026 audit found one existing director workspace:

- Director: `lsautomates@gmail.com`
- Organization: `Luke Events`
- Stripe connected account: `acct_1Tui4qBDCykX1MuY`
- Connected-account mode: test
- Tournaments: 2
- Orders: 39 test and 0 live

The additive migration classifies that organization and everything belonging to
it as test-only. The records remain in the one shared database but are surfaced
only through the staging application environment. New production signups create
live organizations. During the pilot, each director owns one organization in
one immutable environment.

## Vercel variables

Both targets require the canonical Supabase URL, publishable key, server secret,
and working Resend settings. Scope all Stripe values, the site URL, fee, app
environment, checkout switch, and email override to the correct target.

In Vercel, open **Project Settings → Environment Variables** and confirm
**Automatically expose System Environment Variables** is enabled. The runtime
guard requires `VERCEL`, `VERCEL_ENV`, and `VERCEL_GIT_COMMIT_REF` to verify
that `main` serves production and `staging` serves only the branch-scoped
Preview target. Stop the rollout if those values are unavailable in a deployed
function.

### Staging branch

The block below is the final staging configuration. For the first staging
deployment, set `TOURNIBASE_PAID_CHECKOUT_ENABLED=false` and omit the two new
webhook secrets until the stable staging domain and Stripe destinations exist.
After adding both secrets, redeploy once, then change the switch to `true` and
redeploy staging again.

```text
TOURNIBASE_APP_ENVIRONMENT=test
TOURNIBASE_PAID_CHECKOUT_ENABLED=true
NEXT_PUBLIC_SITE_URL=https://staging.tournibase.com
NEXT_PUBLIC_SUPABASE_URL=https://khwaafsdtgiymucppkmo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
STRIPE_SECRET_KEY=sk_test_...
TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID=acct_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET=whsec_...
TOURNIBASE_PLATFORM_FEE_BPS=0
TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=0
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
EMAIL_FROM=TourniBase <passes@tournibase.com>
TOURNIBASE_EMAIL_OVERRIDE_TO=lsautomates@gmail.com
```

Of the 39 test orders, 19 are old Test-mode platform-account orders and 20 are
newer onboarding-Sandbox connected-account sample orders. The 19 legacy orders
remain historical reporting data. Do not configure their old webhook secret in
staging: the onboarding Sandbox API key cannot retrieve or refund old Test-mode
payment objects.

### Production

Production starts and remains at
`TOURNIBASE_PAID_CHECKOUT_ENABLED=false` through deployment, webhook setup,
live onboarding, and every check before the controlled real-money test.

```text
TOURNIBASE_APP_ENVIRONMENT=live
TOURNIBASE_PAID_CHECKOUT_ENABLED=false
NEXT_PUBLIC_SITE_URL=https://tournibase.com
NEXT_PUBLIC_SUPABASE_URL=https://khwaafsdtgiymucppkmo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
STRIPE_SECRET_KEY=sk_live_...
TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID=acct_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET=whsec_...
TOURNIBASE_PLATFORM_FEE_BPS=200
TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=30
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
EMAIL_FROM=TourniBase <passes@tournibase.com>
```

Never define `TOURNIBASE_EMAIL_OVERRIDE_TO` in production. Generic Preview
deployments get no Stripe, Supabase, Resend, or webhook secrets. Scope the test
credentials only to the `staging` branch.

Set `TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID` to the platform account shown by
Stripe for that exact environment, not to a director's connected account. The
staging value must identify the TourniBase onboarding Sandbox; the production
value must identify the live TourniBase platform. TourniBase retrieves the
current Stripe account before Connect, checkout, webhook, or refund work and
fails closed if the secret key belongs to a different Test mode, Sandbox, or
live platform.

## Supabase Auth URLs

Before testing production signup or email confirmation, confirm the shared
Supabase Auth URL configuration includes this exact redirect:

```text
https://tournibase.com/email-confirmed
```

Keep the Supabase Auth Site URL as `https://tournibase.com`. Staging public
signup and confirmation resend are disabled, so a staging redirect is not
needed. Add `https://staging.tournibase.com/email-confirmed` only if controlled
staging signup is intentionally enabled later.

## Migration files

The only new rollout migration currently under `supabase/migrations` is the
additive file:

```text
20260829002309_add_app_environment_isolation.sql
```

The contract SQL stays outside migration history at:

```text
supabase/post-deploy/finalize_app_environment_isolation.sql
```

Do not apply the contract file directly. Only after the same environment-aware
build is deployed successfully to staging and production, copy it into a new
timestamped file under `supabase/migrations`, review the diff, and apply it.

This checkout is not currently linked to Supabase CLI. Authenticate, link the
one approved project, and verify the generated reference before any migration
command:

```bash
npx supabase login
npx supabase link --project-ref khwaafsdtgiymucppkmo
cat supabase/.temp/project-ref
```

The last command must print exactly `khwaafsdtgiymucppkmo`. Stop if it prints
anything else. Then run:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

The dry run must show `20260829002309_add_app_environment_isolation.sql` as the
only pending migration. Stop if it lists anything else. Apply it with:

```bash
npx supabase db push --linked
```

After both deployments pass their checks, create the contract migration:

```bash
npx supabase migration new finalize_app_environment_isolation
```

Copy the complete contents of
`supabase/post-deploy/finalize_app_environment_isolation.sql` into the new empty
migration, review it, then run another dry run before the final `db push`.

## Maintenance gate

The currently deployed build predates the environment kill switches. Merely
changing a new Vercel variable does not pause that old build. Before applying
the additive migration:

1. In **Supabase → Authentication → Providers → Email**, disable new user
   signups.
2. In the Supabase SQL editor, run:

   ```sql
   begin;

   revoke execute on function public.reserve_checkout_order(
     text, text, text, text, text, jsonb, text, integer, integer
   ) from service_role;

   revoke insert on table public.organizations
     from authenticated, service_role;
   revoke usage, select on sequence public.organizations_id_seq
     from authenticated, service_role;

   commit;
   ```

   This blocks the old checkout RPC and every old organization-insert path.
3. Verify the gate with this read-only query. All three results must be `false`:

   ```sql
   select
     has_function_privilege(
       'service_role',
       'public.reserve_checkout_order(text,text,text,text,text,jsonb,text,integer,integer)',
       'EXECUTE'
     ) as old_checkout_open,
     has_table_privilege(
       'service_role', 'public.organizations', 'INSERT'
     ) as service_org_insert_open,
     has_table_privilege(
       'authenticated', 'public.organizations', 'INSERT'
     ) as browser_org_insert_open;
   ```

If the rollout is abandoned before the additive migration succeeds, restore the
old build before ending maintenance:

```sql
begin;

grant execute on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer
) to service_role;

grant insert on table public.organizations
  to authenticated, service_role;
grant usage, select on sequence public.organizations_id_seq
  to authenticated, service_role;

commit;
```

Then re-enable Supabase Auth signups. Do not run that rollback after the
environment-aware deployment is active.

After both deployments pass, the contract migration is applied, and production
signup is ready to reopen, restore only the trusted server insert path:

```sql
begin;
grant insert on table public.organizations to service_role;
grant usage, select on sequence public.organizations_id_seq to service_role;
commit;
```

Verify `service_role` can insert while `authenticated` still cannot, then
re-enable Supabase Auth signups. Never restore direct authenticated organization
inserts or the old nine-argument checkout RPC.

## Safe rollout order

1. Finish local verification, make the local `staging` branch point at the same
   verified commit as `main`, and take a current Supabase backup.
2. Authenticate and link Supabase CLI to exactly `khwaafsdtgiymucppkmo`. Run the
   migration list and additive dry run described above.
3. Start the maintenance gate above. Disable Supabase Auth signups, revoke the
   old checkout and organization-insert paths, and verify all three permissions
   report `false`.
4. Apply only `20260829002309_add_app_environment_isolation.sql`.
5. Confirm Vercel automatically exposes its System Environment Variables.
6. Before the first staging deployment, remove Preview scope from every existing
   production secret or configuration value. Generic Preview deployments must
   have no Supabase, Stripe, Resend, or webhook credentials.
7. Create the complete staging variable set as Preview values restricted
   specifically to the `staging` branch. Set checkout to `false` and omit the
   two new webhook secrets for now. Confirm no broader Preview value can be
   inherited by the branch.
8. Following the repository's explicit push rule, push the verified `staging`
   branch. Verify its first deployment uses only the branch-scoped staging
   values and leaves checkout disabled.
9. Attach `staging.tournibase.com` to the staging branch. Create both onboarding
   Sandbox webhook destinations below, add their secrets to the branch-scoped
   variables, and redeploy with checkout still `false`.
10. Configure production with live keys and checkout `false`. Verify the live
    expected platform account ID, then push the exact same commit to `main` only
    under the repository's explicit push rule.
11. Inventory every Stripe event destination in old Test mode, the onboarding
    Sandbox, and live mode. Record its URL, event source, payload style, events,
    and mode. Disable or delete every old Test/Sandbox destination that targets
    `https://tournibase.com`; no non-live destination may still call the
    production host before staging checkout is enabled.
12. Create both live webhook destinations, add their secrets to production, and
    redeploy production with checkout still `false`.
13. Confirm the exact same environment-aware commit is active on both stable
    hosts, both runtime target checks pass, and each environment has only its
    intended webhook destinations.
14. Set staging checkout to `true`, redeploy, and run the complete onboarding
    Sandbox and host-isolation regression. Set it back to `false` immediately if
    any request reaches the production host or another Stripe environment.
15. Copy the reviewed post-deploy contract SQL into a new timestamped migration,
    dry-run it, and apply it.
16. Restore only the `service_role` organization insert permission described
    above, verify authenticated browser inserts remain blocked, and re-enable
    Supabase Auth signups. The old checkout RPC stays revoked.
17. Have the pilot director create the production account and complete live
    Stripe onboarding while production checkout remains disabled.
18. When every other live check is ready, set
    `TOURNIBASE_PAID_CHECKOUT_ENABLED=true`, redeploy, and immediately run one
    controlled small real-money purchase, email, scan, duplicate-scan, and
    refund test. Confirm Stripe recorded a 2% plus 30-cent TourniBase
    application fee.
19. If any part fails, set the switch back to `false` and redeploy. If every
    part passes, leave it enabled for the pilot.

Never roll production back to a build that predates environment isolation after
live charges begin. The safe rollback is the environment-aware build with paid
checkout disabled.

## Webhook destinations

Create both endpoints separately in the Stripe Sandbox and live platform.

Before creating or enabling them, inventory all existing destinations. The
Sandbox endpoints below must target only `staging.tournibase.com`, and the live
endpoints must target only `tournibase.com`. Disable or delete old Test-mode or
Sandbox destinations that target the production URL. A signing secret verifies
the sender; it does not make payment objects accessible across Stripe Test mode,
another Sandbox, or live mode.

Connected payments:

```text
https://<environment-host>/api/stripe/webhook
```

Set **Events from** to **Connected accounts** and use **Snapshot** payloads.
Do not choose **Your account** for this destination; TourniBase creates direct
charges on each director's connected account.

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

Connect account status:

```text
https://<environment-host>/api/stripe/connect/webhook
```

Set **Events from** to **Connected accounts** and use **Thin** payloads. This
endpoint parses Accounts v2 event notifications rather than Snapshot event
objects.

Subscribe to exactly:

- `v2.core.account.created`
- `v2.core.account.updated`
- `v2.core.account.closed`
- `v2.core.account[configuration.merchant].capability_status_updated`
- `v2.core.account[configuration.merchant].updated`
- `v2.core.account[requirements].updated`
- `v2.core.account[future_requirements].updated`
- `v2.core.account_link.returned`

Each destination gets its own signing secret. Never reuse a Sandbox secret for
the live destination.

## Acceptance checks

- `lsautomates@gmail.com`, Luke Events, both existing tournaments, and all 39
  orders appear only on staging.
- Staging cannot create public director accounts.
- Hosted staging sends only `lsautomates@gmail.com` to Supabase password
  authentication; every other email receives the same generic local rejection.
- The signed-out staging homepage and login page show no staging, Sandbox, MVP,
  or test-data label, and their account-creation links go to the production
  signup page.
- Staging application responses include `X-Robots-Tag: noindex, nofollow,
  noarchive, nosnippet`, and page metadata also disables indexing.
- A test event, pass, scanner link, order, refund, Stripe link, or lifetime total
  cannot be read or changed through production, and the reverse is also true.
- Sandbox checkout charges no TourniBase application fee.
- The 19 historical old Test-mode orders show no refund or Stripe Dashboard
  actions, and direct refund requests for them are rejected without calling
  Stripe.
- A key from Stripe's old Test mode, another Sandbox, or the wrong live
  platform is rejected before Connect, checkout, webhook, or refund work.
- Every staging order and refund email goes only to `lsautomates@gmail.com` and
  starts with `[TEST]`.
- Production signup creates a live organization.
- Production sends transactional email to the actual buyer.
- Production cannot start paid checkout while its kill switch is off.
- After the real-money gate, production charges exactly 200 basis points plus
  30 cents per paid order.
