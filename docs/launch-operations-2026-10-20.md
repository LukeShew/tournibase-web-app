# Launch operations and final follow-up — October 20, 2026

This is the current checkpoint, superseding earlier October 20 rollout notes.
Production paid checkout remains OFF. This report does not certify live payments.

## Configuration deployed

18:25 EDT follow-up: the user authorized publication of the mobile fixes.
Both `main` and `staging` were pushed at `e752035`; Vercel reports both Ready
(production `tournibase-web-bbo3mfu80`, staging `tournibase-web-n62kp9k6p`).
The configuration-only deployment below is the earlier checkpoint, not the
latest source revision. No checkout activation occurred.

Production redeployed existing source `105536d` as
`7xueMzU89efWHMYtwvqhZsthMeb8`, Ready in 1m 45s, assigned to tournibase.com.
Staging remains on the same source. Only Production configuration changed:

- `TOURNIBASE_PLATFORM_FEE_POLICY=per_ticket_v2`
- `TOURNIBASE_PLATFORM_FEE_BPS=400`
- `TOURNIBASE_PLATFORM_FEE_FIXED_CENTS=100`
- `TOURNIBASE_SANDBOX_FEE_QA_ENABLED=false`
- Existing `TOURNIBASE_PAID_CHECKOUT_ENABLED=false` preserved and inspected.

Both environments now have the approved tiers: free passes have no fee;
paid passes through $10 add $1 each; above $10 add $1 plus 4% of the whole
base ticket price, rounded per unit. Historical orders retain their snapshots.
No live director connection, customer charge, payout, or paid-plan upgrade occurred.

## QA closed and limitations

Stripe event `evt_3USkSABDCy7Cmb690CVbhzO2` confirms order 2046's $19.19
refund was created with `status=pending` and
`pending_reason=insufficient_funds`. The staging webhook returned 200 at
21:24:02 UTC. Its $1.70 application fee was returned early, and the previously
verified final state is $19.19 refunded, $1.70 fees returned, no pending or failed
amount, and the pass blocked. This closes the previously missing provider-reason
evidence. The case used Stripe's controlled Sandbox pending-refund card; no
separate payout/balance-draining experiment or live bank test was performed.

Stripe's filtered refund-created history has one refund for order 2048, matching
the later failed object. No duplicate was created by the rejected app retry.
Its failure remains Sandbox review evidence, not a real customer debt.

Responsive browser review: staging event graph and buyer page at 320px,
event page and pass at 390px, production homepage at 390px and login at 320px.
Checked page widths matched their viewport widths. The seven-bar graph remains
ordered and fits; pass QR and information fit. Mobile navigation opens and
Settings is reachable. This is browser emulation, not physical iPhone/Android QA.

Found small 320px header crowding on public checkout and login. Local changes
allow header wrapping/gaps and prevent logo shrinkage (including signup).
Local login was visually verified at 320px. Local event preview could not render
because the local Supabase server secret is absent; no secret was copied just
for this check. These CSS fixes are now deployed to both environments at
`e752035`; both hosted branches use identical application code.

iOS follow-up: an actual iPhone 17 simulator running iOS 26.5/Safari rendered
the production homepage and login, and the staging Queen City Fall Classic
buyer page. Headers and text fit the portrait viewport; sign-in navigation
worked. Screenshots are saved in the root project's design evidence directory.
Scrolling reached the buyer form and footer. Selecting one $28.75 weekend pass
updated its buyer fee to $2.15 and total to $30.90 correctly. No order was
submitted. The test simulator was shut down after review.
This is iOS Safari simulation, not a physical device, camera test, authenticated
director session, or proof of venue Wi-Fi/cellular performance.

439 tests passed across 41 files. Final TypeScript, ESLint and production
webpack build passed, including all three header adjustments.

## Operator runbook

Luke confirmed he will personally monitor lsautomates@gmail.com and handle
urgent support during the first event. A backup contact remains unassigned.
The production support form accepted one clearly labeled QA message; Resend
reported it delivered at 22:24:12 UTC (email ID
`01a15b6a-3ff9-7432-a8ee-c067360eff31`). This proves receiving-server delivery,
not inbox placement or a human response time. Existing public
support form is the technical-help channel; event-specific refund requests go
to the organizer shown on the event page. Do not advertise staffed hours or a
response-time guarantee before assigning and testing coverage.

### Before each event

1. Confirm organizer contact, event/pass dates, timezone, final buyer totals,
   live connected-account readiness and payout details. Never substitute the
   staging account. Verify the correct domain and environment.
2. Confirm the support inbox is monitored and designate the event-day contact
   and backup. Agree on event-day coverage with the organizer.
3. Review available connected/platform balances and expected cancellation
   exposure. Keep funding available for full buyer refunds and TourniBase's
   nonreturned processing costs. Owner must choose and fund a reserve; this
   document does not establish a funded reserve or move money.
4. Confirm backups/recovery and provider alerts. Prepare a second internet
   connection and charged scanner devices. Saved buyer passes do not make the
   scanner work offline.

### Refund request

1. Verify requester, event, order and affected passes. Inspect existing refunds
   and disputes in the ORIGINAL connected account stored on the order.
2. Check eligibility under the published policy. Approved refunds return the
   ticket price plus its saved buyer fee. Use app pass/full-order actions;
   never calculate a historical refund using today's pricing.
3. Submit once and record refund ID, amounts, account, timestamp and operator.
   Pending is not completed. Reconcile Stripe status, app amount, pass state and
   receipt delivery. Do not promise a bank posting date.
4. If insufficient funds, inspect the saved application-fee advance and funding
   shortfall. Escalate funding to the owner; do not repeatedly submit refunds
   or transfer money without authorization. Watch the existing refund to completion.
5. If failed/canceled, retain the case for manual review. Account for any already
   returned application fee separately. Do not automatically retry or unblock
   a previously refunded pass. Resolve with Stripe and the buyer before a new action.

### Canceled event

Stop further sales, preserve all orders/audit records, have the organizer notify
buyers and coordinate full ticket-plus-fee refunds. Track each order until
reconciled; changing event status does NOT refund orders automatically.
TourniBase absorbs nonreturned processing under the new director-free plan.
Historical payment arrangements remain applicable to historical orders.

### Disputes

Record Stripe's response deadline immediately. Preserve purchase, policy,
delivery, admission, communications and cancellation evidence. Assign an owner
and respond before the deadline. Do not issue another refund while an open
dispute risks double repayment. Organizers cover valid event-related chargebacks;
TourniBase covers its own errors, as published. This policy is not an automated
organizer debit or a guarantee that Stripe's loss protection covers every cost.
Record recovery arrangements and final outcome separately; get legal review
before relying on contractual cost recovery.

### Incident/event-day outage

Check provider status and error logs; notify the organizer through the agreed
channel. Pause new sales if payment integrity is uncertain. Do not bypass pass
validation or share unrestricted director access with staff. Organizer-approved
manual admissions must be recorded and reconciled afterward. Keep an incident
record with timeline, affected orders, mitigation and resolution.

## Remaining launch checklist

- [x] Boundary/mixed/free Sandbox purchases, exact refunds, pending/failure
  handling, original-account routing and admission/revocation checks.
- [x] Stripe-confirmed insufficient-funds pending reason and eventual completion.
- [x] Production tier configuration deployed with checkout OFF.
- [x] Approved refund policy published; operational procedures documented here.
- [x] Publish narrow-header fixes to both branches; Vercel reports both Ready.
- [x] iOS Safari simulator review of public home/login/staging event pages.
- [ ] Physical phone review (no camera use claimed).
- [x] Hosted database export and isolated local restore; data and RLS policies match.
- [ ] Encrypt/copy backup off-site; choose recurring schedule and loss window.
- [ ] Enable leaked-password protection when available.
- [x] Luke confirmed first-event support coverage; support message delivered.
- [ ] Name support backup and fund refund reserve.
- [x] Operational policy/code consistency review; 82 targeted refund tests passed.
- [ ] Legal review of cancellation/dispute cost recovery; funded reserve confirmation.
- [ ] Near the end: real director completes live Stripe onboarding; verify charges,
  payouts, processing payer, loss responsibility, preview eligibility and bank setup.
- [ ] Final pre-sales gate, deferred until a pilot is secured: commercial hosting
  upgrade and final recovery/funding readiness confirmation. No upgrade purchased.
- [ ] Explicit checkout activation, genuine pilot sale/receipt/admission, then
  actual payout verification before broad rollout.

Guided onboarding implementation remains on hold.

## Hosting and recovery decision

The user deferred paid upgrades. Current public base pricing is Vercel Pro
$20/month and Supabase Pro from $25/month for one Micro project, before usage,
additional resources, and applicable taxes. No subscription was purchased.
Capacity is not certified: a small pilot may fit free quotas, but no peak-load
test was performed. Vercel Hobby's noncommercial restriction still blocks a
commercial pilot regardless of its size. Supabase Free is a separate capacity
and recovery-risk decision, not the same commercial-use restriction.

If remaining on Supabase Free, require an encrypted, owner-controlled off-site
backup plus an isolated restore drill before real orders. Include schema,
application/auth data and roles, account for Storage objects separately, and
document external configuration without putting credentials in Git. Never
restore into the shared live project as a test. Compare restored row counts,
relationships, permissions and representative orders; keep outbound email,
webhooks and payments disabled in the recovery target. A pre-event export alone
cannot recover sales created afterward: choose and verify a recurring schedule
and acceptable data-loss window. Daily Pro backups likewise do not guarantee
zero transaction loss.

### Completed recovery drill

After Docker started, the existing linked Supabase CLI connection exported roles,
schema and data from `khwaafsdtgiymucppkmo`; no password entry was needed.
The dependency-ordered schema includes public, private, auth, storage, extensions
and vault. Backups are in the app's private Git-ignored `.env.recovery-20261020/`
directory (directory mode 700, files 600). Never commit or share these dumps:
they contain account and ticket information. These permissions are NOT encryption.

Restored schema and COPY data successfully with stop-on-error into the separate
`tournibase_recovery_20261020` database on local PostgreSQL 17.6. Existing local
cluster roles were reused; the exported roles were not applied to the shared
local cluster. This verifies database schema/data recovery, not rebuilding a
fresh infrastructure stack or authentication-provider configuration.

All 18 checked table counts and order-independent full-row digests matched the
hosted source: all public/private tables, auth users/identities, and storage
buckets/objects. Included 2,046 orders, 4,925 passes and 4,330 check-ins. All 14
public/private tables retained RLS; all 18 policy definitions matched by digest
`66448fed0202903bfd09b291e3dadbdb`. Storage currently has no buckets or objects.
The reusable read-only comparison is `scripts/recovery-manifest.sql`.

The disposable recovery database was dropped after verification. Existing local
services and the hosted project were not restored over or otherwise changed.
No mail, payments or web app were connected to the recovery target.

Remaining: encrypted owner-controlled off-site copy, recurring backup schedule,
acceptable data-loss window, and separate configuration/secret recovery plan.
Auth provider settings, SMTP, deployment secrets, Stripe configuration and future
Storage files are not a complete recoverable service merely because SQL restores.
Refresh the backup before a pilot; this snapshot cannot recover later sales.
Paying for Pro does not itself perform a recovery test or fund refunds.

Refund funding remains a business action: calculate potential canceled-event
ticket refunds from organizers, buyer-fee returns from TourniBase, and
nonreturned processing/dispute costs; confirm where each balance will come
from before sales. Do not treat a passing Sandbox refund as a funded live
reserve. No real funds were moved.

### Refund funding and policy review

Reviewed the published terms/refund policy against original-account routing,
saved buyer-fee allocation, zero-fee handling, pending/failed refunds and receipts.
All 82 tests across refund lifecycle, refund routes and refund email tests passed.
No policy/code inconsistency requiring a wording change was found in this review.
This is an operational review, not legal certification of enforceability.

Before the first pilot, Luke and the organizer must record:

1. Organizer's source for returning the full affected base ticket proceeds,
   including proceeds already paid to its bank. Bank payouts do not remove this
   obligation. Do not assume the connected Stripe balance covers cancellation.
2. TourniBase's source for returning all affected buyer fees. Keep fee revenue
   available until exposure ends; processing already paid to Stripe reduces it.
   If returned buyer fees total F and eligible uncommitted funds available are A,
   additional funding needed is at least max(0, F - A). If only net fees were
   retained, the gap includes nonreturned processing. Do not count processing
   twice or count money committed to other refunds as available.
3. Temporary balance needs while the full refund and application-fee return
   settle. Check the actual original account and pending advance rather than
   assuming both balances update simultaneously. Pending is not a second refund.
4. Separate contingency for valid event-related disputes (organizer) and
   TourniBase-caused errors (TourniBase), based on actual live Stripe terms.
   Do not assume preview loss protection pays every dispute fee or business cost.
5. Named funding owner, available amount, funding method and review date. Check
   before sales and daily during the event. If funds are inadequate, escalate
   and resolve before making refund timing promises; never duplicate a refund.

Luke is the support owner. No reserve amount, transfer or bank debit is authorized
by this document. Funding confirmation is deferred until the pilot is known but
remains required before paid sales. Published policy already discloses refunds
and chargeback exceptions; do not market an unconditional guarantee of no costs
under every circumstance. Obtain legal review before relying on cost recovery.

Sources: [Vercel pricing](https://vercel.com/pricing),
[Supabase pricing](https://supabase.com/pricing),
[Supabase backups](https://supabase.com/docs/guides/platform/backups).

Vercel Hobby's restriction concerns commercial project use, not whether each
deployment moves real money. Staging supports this business and shares the
production Vercel project/team; it is not a separate subscription per URL.
See [Vercel fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines).
See also [Stripe testing](https://docs.stripe.com/testing) and
[refunds](https://docs.stripe.com/refunds). No claim of legal certification.
