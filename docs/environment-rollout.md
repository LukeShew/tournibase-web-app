# Staging and Production Rollout

TourniBase uses one Vercel project and one Supabase project. The application,
database, and Stripe checks keep test and live data separate.

The split is deployed on both stable hosts. The additive migration
`20260829002309_add_app_environment_isolation` and contract migration
`20260831003839_finalize_app_environment_isolation` are applied to the shared
Supabase project. Staging checkout is active in the Stripe onboarding Sandbox;
production paid checkout remains disabled while live Stripe setup and pilot
validation are unfinished.

## Current rollout status

Status checkpoint: October 17, 2026, after the matching `7425b18` deployments
reached Ready and the authorized Sandbox fee/refund cases below passed.
Staging's zero-fee variables, restoration deployment, and stable-host display
are verified restored. Production paid
checkout remains disabled. The user deferred real director onboarding to a
later session; no onboarding action is requested now.

The earlier `f6be6cd` follow-up corrected the director Stripe Dashboard URL
ordering and failed-refund guidance. Those changes are included in the latest
matching deployments identified in the receipt below.

Follow-up source `7425b18` fixes a refund synchronization race found in the
final Vercel log review. It passed 295 tests across 35 files, ESLint, TypeScript,
and the production webpack build. Its matching production and staging
deployments are verified Ready. Production checkout remains off and staging
retains its normal zero-fee configuration.

Completed:

- The `staging` branch is deployed at `staging.tournibase.com` with branch-only
  credentials, a $0 TourniBase fee, and forced test-email delivery.
- `main` is deployed at `tournibase.com` with the live application boundary and
  its paid-checkout kill switch off.
- Existing Luke Events data is classified as `test` and is available only
  through staging.
- Both environment-isolation migrations are applied.
- The Sandbox connected-payment and account-status destinations target the
  staging host.
- Production Supabase Auth signup is enabled (`disable_signup: false`) and the
  trusted `service_role` organization-creation path is independently verified;
  direct browser inserts remain blocked.
- Live API keys and both production webhook destinations are configured. The
  October 17 production redeploy `F3EzhFuXuguPDQV96YPymp9tmDPh` returned HTTP
  200 for the homepage and the signed Accounts v2 destination ping.
- Both dedicated Checkout payment-method configurations are created in Stripe
  and saved in the correctly scoped Vercel variables: Production uses
  `pmc_1URhTpBdjbPEH1ElDNVNmv70`; Preview restricted to branch `staging` uses
  `pmc_1URhX7BDCyF6XjOynzkBpyUD`. Both allow cards and eligible Apple Pay/Google
  Pay only, with connected-account customization disabled.
- Buyer-fee migration `20261017234245` and refund-lifecycle migration
  `20261018000545` are applied to the shared Supabase project. The latter UTC
  version was applied October 17 US Eastern. Hosted counts remained 2,037
  orders, 4,910 passes, and six events; new refund-lifecycle fields were zero.
  Anonymous/authenticated order UPDATE access remains denied.
- Local verification passed all 30 migrations, the rollback SQL regression,
  277 application tests across 34 files, ESLint, TypeScript, and the webpack
  production build at source `f6be6cd`. The subsequent `7425b18` application
  regression passed 295 tests across 35 files, lint, TypeScript, and the
  production webpack build; hosted verification is recorded separately below.
- The fee/refund/receipt/layout fixes and dedicated card-only Checkout handling
  are deployed from `f00e242` to both environments. Production deployment
  `3Yxq635djvsDSHVMYq8kNKVCotwE` and staging deployment
  `3uhRp7H99bmWUKBah5es5jNWheXb` both reached Ready.
- The subsequent strict Sandbox-fee maintenance guard in `5590ac4` reached
  Ready in both environments. It does not permit the override in live mode.
- Both connected-payment destinations now have all eight required event types,
  including `refund.created`, `refund.updated`, and `refund.failed`; the saved
  Stripe configuration was verified.

Future live launch work (deferred by the user; no action needed now):

- Complete live onboarding for the pilot director and verify account readiness.
- Explicitly authorize enabling production paid checkout when ready to launch.
- Use a genuine authorized pilot purchase for a real admission—not a fabricated
  live transaction. Observe the payment, application fee, receipt, admission,
  director proceeds, and eventual payout; handle a real refund only when
  authorized and needed.

The [payment-readiness report](qa-payment-readiness-2026-10-17.md) and
[public-site QA report](qa-public-sites-2026-10-17.md) record observed checks
and limits. Passing cases are not a guarantee of every provider/network outcome.

Deployment receipt:

- Matching deployed source revision: `7425b18`.
- Production: `AivAja1aKZkakKYuJuUYvCL9ex9R`, Ready;
  `TOURNIBASE_PAID_CHECKOUT_ENABLED=false`.
- Staging: `GvpLfjjMw4BvKxuHzhJZSNYQbvcM`, Ready, with normal zero-fee configuration.
- Historical restoration evidence: deployment `4Xbukpk3HjwijJGkc6MvmVs3SvFk`
  on `5590ac4` reached Ready. Its stable ticket page showed Sunday $17.49,
  Weekend $28.75, and a
  $46.24 combined order with no TourniBase fee, versus $47.46 during fee QA.
- Both connected-payment eight-event subscriptions: saved and verified.
- Normal zero-fee order `2040`: $46.24 purchase and delivered receipt, followed
  by successful $17.49 individual-pass and $28.75 remaining-order refunds.
- Pending-refund order `2041`: zero completed refund, $17.49 pending, and active
  pass persisted while pending; subsequent provider success synchronized
  automatically and the refund email was delivered.
- Later-failing refund order `2042`: completed refund corrected to $0, failed
  amount $17.49, and the previously blocked pass stayed blocked. Repeating the
  app refund was rejected for manual Stripe/support review.
- Authorized nonzero-fee order `2043`: $46.24 admission plus $1.22 buyer fee
  charged $47.46 and issued two passes. Refunds of $17.95 and then $29.51
  returned the complete charge. Stripe verified collection and full reversal
  of the $1.22 application fee; receipts were delivered.
- Verified staging restoration: fee `0` bps, fixed fee `0` cents, maintenance
  flag `false`, redeployed and checked on the stable host. The authorized
  maintenance run is closed; Production configuration was unchanged.
- Genuine pilot payment and director payout evidence: not yet recorded.

### Refund synchronization follow-up

Order `2043` ultimately refunded correctly and delivered its emails, but the
log review found a competing-update race: one webhook returned HTTP 500 and the
director refund route returned HTTP 502. The exact webhook retried and returned
HTTP 200 about 17 seconds later. This was a transient synchronization failure,
not evidence of an additional charge or a missing final refund.

Source `7425b18` makes at most five attempts at competing versioned updates,
using a fresh authoritative snapshot each time and bounded, randomized delay.
Once Stripe accepts
a refund, a temporary local-sync failure returns HTTP 202 with a synchronizing
status instead of a false HTTP 502. Genuine failed/canceled attempts retain
their review-required HTTP 409 behavior; pending and action-required states
remain distinct. The open order view reads the current order by ID so refreshed
totals replace stale modal data. No database migration is required.

## Buyer-paid fee rollout — October 17, 2026

Hosted migration `20261017234245_add_buyer_paid_tournibase_fees` is applied.
It adds immutable buyer-fee snapshots and exact refunded-fee accounting, plus
the service-role-only `reserve_checkout_order_with_buyer_fee` RPC. The old
reservation RPC remains compatible with the current hosted application.
Existing 2,037 orders and 4,910 passes were unchanged; all historical buyer-fee
fields remain zero. Only the new application code uses additive buyer pricing.

For a $10 admission with the production fee configuration, checkout collects
$10.50, transfers $0.50 to TourniBase, and leaves the director $10 before Stripe
processing. Ticket-revenue reports exclude the service fee. Full and pass-level
refunds include the corresponding buyer fee, with exact cent allocation across
passes. Old orders retain their original pricing and refund treatment.

The public ticket selector advertises the fee-inclusive total for one pass,
then recalculates the complete order total as quantities change. The fixed fee
is charged once per order, not once per pass. The total appears before buyer
information, with ticket value and fee itemized separately. Free orders and the
zero-fee staging environment stay fee-free. Directors enter base admission
prices and are warned not to advertise prices that omit mandatory fees.

Refund reconciliation distinguishes succeeded, pending/requires-action, and
failed/canceled refunds. Only succeeded amounts count as refunded money. A
failed refund needs Stripe/support review; previously blocked passes do not
automatically become usable again.

Local checks cover checkout, receipts, fee allocation, refunds, reporting,
historical compatibility, free orders, inventory, environment isolation, and
database function permissions. All 30 migrations and the rollback regression
file `supabase/tests/buyer_paid_fees.sql` passed in isolated PostgreSQL. The
hosted post-migration checks confirmed unchanged record counts and restricted
RPC permissions. Security advisors produced no new findings; existing
intentional service-only RLS notices, the owner/environment-checked metrics
wrapper notice, and disabled leaked-password protection remain unchanged.

The full application suite at source `f6be6cd` passed 277 tests across 34 files,
TypeScript, and ESLint. A production
build passed using `npm run build -- --webpack`; the default Turbopack build
could not bind its internal worker port in the local execution sandbox.
Generated duplicate `.next/types` cache files were cleared for the standalone
TypeScript check. No production build configuration was changed.

Identical source `7425b18` is deployed to main/production and staging. Keep
`TOURNIBASE_PAID_CHECKOUT_ENABLED=false` in production until
the remaining live validation is approved. No real-money payment was made for
this implementation.

## Environment contract

| Setting | Staging | Production |
| --- | --- | --- |
| Stable URL | `https://staging.tournibase.com` | `https://tournibase.com` |
| Git target | `staging` branch | `main` branch |
| Vercel target | Branch-scoped Preview | Production |
| `TOURNIBASE_APP_ENVIRONMENT` | `test` | `live` |
| Stripe | TourniBase onboarding Sandbox | Live Connect platform |
| Paid checkout | Enabled for testing | Currently disabled; enable only after technical checks and authorized pilot launch |
| Checkout methods | Dedicated Sandbox card configuration, eligible card wallets | Dedicated live card configuration, eligible card wallets |
| TourniBase fee | `0` bps + `0` cents | Exactly `200` bps of ticket subtotal + `30` cents, added to the buyer total once per paid order |
| Sandbox fee QA override | Normally unset/`false`; temporary authorized maintenance only | Unset/`false`; enabling it is rejected |
| Transactional recipient | Forced to `lsautomates@gmail.com` | Actual buyer |
| Email subject | Starts with `[TEST]` | Normal subject |
| Public entrance | Same public homepage and sign-in design as production; no test data is listed | Normal public homepage and sign-in |
| Public signup | Disabled; `/signup` redirects to production | Enabled and independently verified (`disable_signup: false`) |
| Search indexing | Disabled | Enabled |

Both targets must use the canonical Supabase project
`khwaafsdtgiymucppkmo`. Do not create a second Supabase or Vercel project for
staging.

The zero-fee staging policy has one narrowly scoped maintenance exception,
described below. It is not the normal staging experience and never permits live
data, live payment credentials, or real money in staging.

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
- Orders: hosted test orders only; no live orders

The additive migration classified that organization and everything belonging
to it as test-only. The records remain in the one shared database but are
surfaced only through the staging application environment. New production
signups create live organizations. During the pilot, each director owns one
organization in one immutable environment.

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

The block below is the deployed staging configuration. Both Sandbox webhook
secrets are installed as branch-scoped Vercel variables, and checkout is
enabled for repeatable testing.

```text
TOURNIBASE_APP_ENVIRONMENT=test
TOURNIBASE_PAID_CHECKOUT_ENABLED=true
NEXT_PUBLIC_SITE_URL=https://staging.tournibase.com
NEXT_PUBLIC_SUPABASE_URL=https://khwaafsdtgiymucppkmo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION=pmc_1URhX7BDCyF6XjOynzkBpyUD
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

The hosted test workspace contains 19 old Test-mode platform-account orders as
well as newer onboarding-Sandbox connected-account sample and regression
orders. The 19 legacy orders remain historical reporting data. Do not configure
their old webhook secret in staging: the onboarding Sandbox API key cannot
retrieve or refund old Test-mode payment objects.

### Temporary Sandbox fee acceptance procedure

Implementation status: the strict `TOURNIBASE_SANDBOX_FEE_QA_ENABLED` guard is
deployed in `5590ac4`, with both environments Ready. The approved nonzero-fee
acceptance used order `2043` and verified the $1.22 application fee and its full
refund. The flag `false`, fee `0` bps, and fixed fee `0` cents were restored and
verified on Ready deployment `4Xbukpk3HjwijJGkc6MvmVs3SvFk` and the stable ticket
page. No SQL migration was needed for the guard.

The user approved a temporary staging-only 200-basis-point plus 30-cent fee for
one Sandbox purchase/refund, followed by restoration to zero. Repeat this
maintenance operation only with explicit authorization; it is not a standing
permission to leave fees enabled or change production behavior.

The guard accepts only `true` or `false` when the flag is configured. Unset or
`false` preserves mandatory zero-fee staging. `true` requires the test
environment and exactly `200` basis points plus `30` cents; hosted execution
must still be the `staging` branch, Preview target, and staging URL. Other fee
values, an invalid flag, a wrong target, or a live-environment override fail
closed. All existing database, Stripe-mode, email-recipient, and host checks
remain active.

1. Confirm the guard release is Ready on both targets, production checkout is
   unchanged, and staging uses the approved Sandbox key and Sandbox Checkout
   payment-method configuration. Record the current staging deployment and
   zero-fee variables before making changes.
2. In Vercel **Preview, restricted to branch `staging` only**, set:

   ```text
   TOURNIBASE_SANDBOX_FEE_QA_ENABLED=true
   TOURNIBASE_PLATFORM_FEE_BPS=200
   TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=30
   ```

   Do not apply these changes to generic Preview or Production. Redeploy
   staging and wait for Ready; saved variables alone do not change the running
   application.
3. Make the one authorized Sandbox purchase. Verify upfront fee-inclusive
   offers, mixed-pass order total, the single order-level fee, matching Stripe
   application fee, receipt itemization, and director reporting that excludes
   the buyer fee. Use only Sandbox payment details; no real money is involved.
4. Refund the authorized Sandbox order and verify the buyer-fee allocation,
   application-fee reversal, receipt/refund email, successful refund total, and
   affected pass states. Distinguish pending/failed attempts from completed
   refunds. Record the order and provider evidence in the QA report.
5. Restore all three branch-scoped values, **even if acceptance fails**:

   ```text
   TOURNIBASE_SANDBOX_FEE_QA_ENABLED=false
   TOURNIBASE_PLATFORM_FEE_BPS=0
   TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=0
   ```

   Redeploy staging, wait for Ready, and verify the stable ticket page no longer
   adds a fee and its total equals admission value. Confirm Production was not
   changed. An unresolved test order retains its original immutable fee
   snapshot for continued reconciliation; restoration must not reprice it.
6. Record the final zero-fee deployment ID, restored variables, and final
   acceptance outcome. The operation is incomplete until restoration is
   verified; do not leave the maintenance flag enabled between sessions.

### Production

Production is deployed with the live application boundary and remains at
`TOURNIBASE_PAID_CHECKOUT_ENABLED=false` through live key and webhook setup,
live onboarding, and every check before an authorized genuine pilot launch.
All four live API-key/signing-secret variables below are installed. On October
17 the corrected secret key was deployed in `F3EzhFuXuguPDQV96YPymp9tmDPh`;
the homepage and a signed live Accounts v2 ping returned HTTP 200. This verifies
the account-status secret and the expected platform identity, not a real payment.

The live connected-payment destination is `we_1URfxRBdjbPEH1ElMxINrRNY`
(`@accounts`, snapshot, `2026-04-22.dahlia`), and the account-status destination
is `ed_61Vb3yQgs90O2RBnZ16Uk91c3PSQnPu0SoFc4hKXYMjY` (`@self`, thin).
Both are enabled. The legacy snapshot endpoint `we_1TqL69BdjbPEH1Ela6YXcJBx`
still listens to `@self` at `/api/stripe/webhook`; it does not cover connected
direct charges. Live director onboarding and payment/refund delivery remain
launch checks.

```text
TOURNIBASE_APP_ENVIRONMENT=live
TOURNIBASE_PAID_CHECKOUT_ENABLED=false
NEXT_PUBLIC_SITE_URL=https://tournibase.com
NEXT_PUBLIC_SUPABASE_URL=https://khwaafsdtgiymucppkmo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION=pmc_1URhTpBdjbPEH1ElDNVNmv70
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

`STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION` is required for paid checkout.
It must identify the dedicated parent configuration belonging to that exact
platform and environment. Cards plus eligible Apple Pay and Google Pay are
enabled; other payment methods and connected-account customization are off.
Wallet availability still depends on the buyer's browser/device and Stripe
eligibility. Do not substitute a director's child configuration or enable
additional methods without separate fulfillment/refund QA. Saving a Vercel
variable does not update an existing deployment; redeploy and verify it.

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

All three rollout migrations are in migration history and applied to the
canonical Supabase project:

```text
20260829002309_add_app_environment_isolation.sql
20260831003839_finalize_app_environment_isolation.sql
20260831024917_restore_trusted_organization_creation.sql
```

The contract migration was created from the reviewed SQL at
`supabase/post-deploy/finalize_app_environment_isolation.sql` after the same
environment-aware build reached staging and production. It removes the legacy
environment-unaware checkout and gate entry points, removes anonymous Data API
access to public tournament data, and keeps the environment-aware server paths.

Before any later database change, confirm the linked project reference is still
exactly `khwaafsdtgiymucppkmo`, inspect `npx supabase migration list --linked`,
and run `npx supabase db push --linked --dry-run` before applying a migration.

## Maintenance gate

The rollout maintenance gate was used before the additive migration to block
the old checkout and organization-insert paths. The environment-aware build and
both isolation migrations are now active. Do not restore the old nine-argument
checkout RPC or direct authenticated organization inserts.

Migration `20260831024917_restore_trusted_organization_creation` restored the
trusted server organization-creation path:

```sql
begin;
grant insert on table public.organizations to service_role;
grant usage, select on sequence public.organizations_id_seq to service_role;
commit;
```

Verification confirms `service_role` can insert while `authenticated` still
cannot. Supabase Auth signup was re-enabled and independently verified with
`disable_signup: false` on August 31, 2026. The original maintenance procedure
is retained below for incident history; it must not be rerun against the active
rollout.

Before the additive migration, the gate procedure was:

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

Never restore direct authenticated organization inserts or the old
nine-argument checkout RPC.

## Safe rollout order

This original ordered checklist is retained as the rollout runbook. Use
**Current rollout status** above as the authoritative record: the dual
deployment, all three migrations, and production signup restoration are
complete. Live keys, destinations, and dedicated payment-method configurations
are configured, and matching `7425b18` deployments are Ready. The documented
Sandbox payment/refund cases and zero-fee restoration passed. Real director
onboarding and genuine pilot payment/payout validation are deferred; production
paid checkout remains disabled until an explicit launch decision.

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
    genuine authorized pilot purchase for a real admission. Do not fabricate a
    live payment solely for QA; use Sandbox for repeatable refund/duplicate-scan
    tests. Confirm Stripe recorded a 2% plus 30-cent TourniBase
    application fee added on top of the ticket subtotal, a separate buyer fee
    line on checkout/receipt, and director ticket sales excluding that fee.
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
- `refund.created`
- `refund.updated`
- `refund.failed`

Connect account status:

```text
https://<environment-host>/api/stripe/connect/webhook
```

Set **Events from** to **Your account** and use **Thin** payloads. Stripe sends
Accounts v2 status notifications through the Connect platform account even
though the changes describe connected accounts. This endpoint parses Accounts
v2 notifications rather than Snapshot event objects.

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

- `lsautomates@gmail.com`, Luke Events, both existing tournaments, and all
  hosted test orders appear only on staging.
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
- Ordinary Sandbox checkout charges no TourniBase application fee. Any
  explicitly approved fee-acceptance maintenance run follows the procedure
  above and finishes with zero-fee restoration verified.
- The 19 historical old Test-mode orders show no refund or Stripe Dashboard
  actions, and direct refund requests for them are rejected without calling
  Stripe.
- A key from Stripe's old Test mode, another Sandbox, or the wrong live
  platform is rejected before Connect, checkout, webhook, or refund work.
- Every staging order and refund email goes only to `lsautomates@gmail.com` and
  starts with `[TEST]`.
- Production signup creates a live organization through the trusted server path
  while direct authenticated organization inserts remain blocked.
- Production sends transactional email to the actual buyer.
- Production cannot start paid checkout while its kill switch is off.
- Production's genuine pilot purchase charges exactly 200 basis points of the
  ticket subtotal plus 30 cents once per paid order, added for the buyer.
- Paid checkout uses its exact environment's dedicated card-only configuration.
- Pending and failed refunds are not counted as completed refunds; a failed
  attempt is visible for manual review and does not automatically reactivate
  blocked passes.
