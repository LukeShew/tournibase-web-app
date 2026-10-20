# Launch operations and final follow-up — October 20, 2026

This is the current checkpoint, superseding earlier October 20 rollout notes.
Production paid checkout remains OFF. This report does not certify live payments.

## Configuration deployed

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
for this check. These CSS fixes are committed locally, NOT pushed/deployed.
Both hosted sites therefore remain on identical existing code.

439 tests passed across 41 files. Final TypeScript, ESLint and production
webpack build passed, including all three header adjustments.

## Operator runbook

Owner before launch: Luke, until a named backup is assigned. Existing public
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
- [ ] Approve/push both branches for local narrow-header fix; verify after deploy.
- [ ] Physical phone review (no camera use claimed).
- [ ] Commercial hosting plan decision; suitable backups and a successful restore
  drill; leaked-password protection when available. No subscription purchased.
- [ ] Name support backup/coverage, verify inbox routing, and fund refund reserve.
- [ ] Legal/policy review, particularly cancellation and dispute cost recovery.
- [ ] Near the end: real director completes live Stripe onboarding; verify charges,
  payouts, processing payer, loss responsibility, preview eligibility and bank setup.
- [ ] Explicit checkout activation, genuine pilot sale/receipt/admission, then
  actual payout verification before broad rollout.

Guided onboarding implementation remains on hold.

Vercel Hobby's restriction concerns commercial project use, not whether each
deployment moves real money. Staging supports this business and shares the
production Vercel project/team; it is not a separate subscription per URL.
See [Vercel fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines).
See also [Stripe testing](https://docs.stripe.com/testing) and
[refunds](https://docs.stripe.com/refunds). No claim of legal certification.
