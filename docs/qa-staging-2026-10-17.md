# Staging volume and payment QA — October 17, 2026

> This is the original hosted QA snapshot. See
> [the local refund/layout fixes and live setup handoff](qa-refund-fixes-2026-10-17.md)
> for the subsequent corrections. Local fixes are not a deployed refund pass.
> Later user-requested sample-count adjustments are recorded in
> [Staging sample totals](qa-sample-variation-2026-10-17.md); the counts below remain
> the original QA snapshot.

## Result

Staging data setup is complete. Checkout, receipt delivery, and camera-free
admission checks passed. **Payments are not ready for a live launch:** both refund
controls have reproduced failures, and production lacks live Stripe credentials.
No application runtime code, production data, or deployment was changed in this
QA. The new offline generator and this report are local repository changes only.

## Approved staging data changes

Existing event dates, ticket prices, and historical records were preserved.
Carolina Hardwood Classic remained the comparison event and was not topped up.
Queen City Fall Classic was created and published through the staging UI for
October 17–18, 2026, with normal event copy and Saturday/Sunday/weekend passes.

| Event | All orders | All passes |
| --- | ---: | ---: |
| Example Tournament | 358 | 945 |
| July Slam Dunk Tournament | 437 | 982 |
| Carolina Fall Tip-Off | 392 | 1,005 |
| Carolina Hardwood Classic | 390 | 917 |
| Queen City Fall Classic | 378 | 880 |

Queen City's final totals include one actual Stripe Sandbox order with three
passes. Before that purchase it had 377 orders and 877 passes. Counts include
pre-existing failed/refunded orders where applicable; they are not all paid orders.

The guarded top-up inserted 1,522 orders and 3,757 passes. It varied buyer/team
names, one-to-four-pass quantities, mixed ticket types, and purchase times. Old
events use their original event weeks; the new event uses October 12–17, without
future-dated purchases. Seeded orders have no Stripe payment IDs and do not
represent charges or processor balances. They generated no emails or check-ins.

The script is `scripts/seed-staging-volume.mjs`; its reviewed historical input is
`scripts/fixtures/staging-volume-20261017.json`. Execution used the authenticated
Supabase connector, scoped to the test organization and connected account. SQL
was INSERT-only, transaction-guarded, and fingerprinted existing rows. A second
execution before transaction QA made no inserts. **Do not rerun it now:** later QA
intentionally changed the new event, so the old snapshot must fail closed.

Independent final read-only checks found:

- All nine pre-existing-row fingerprints for each old event (1, 3, 4) unchanged.
- No altered original event dates.
- Zero seeded emails, scans, Stripe payment IDs, or incorrect account/environment assignments.
- Zero money/item/pass-count mismatches, duplicate pass sequences, future purchase
  timestamps, expired-at-purchase passes, or invalid pass windows.
- All seeded passes active and unscanned.
- Zero order/organization environment mismatches. All 1,955 current orders are test orders.

These records validate reporting with realistic volumes; they are not a
concurrent-buyer load test.

## Hosted payment and admission evidence

Staging order **TB-001957** was purchased through the public event page and hosted
Stripe Checkout using Stripe's public test card. Checkout explicitly reported
`livemode: false` and a $54 total: two Saturday passes and one Sunday pass.

Passed:

- Direct charge belongs to the expected test connected account; stored routing is test.
- Order became paid with a PaymentIntent and Charge ID; TourniBase fee is $0.
- Three distinct mobile pass links were issued and displayed on the success page.
- Confirmation email recorded one send attempt; Resend independently reported
  **delivered** for the `[TEST]` receipt to the staging recipient.
- Saturday pass accepted once using manual token entry; repeated entry returned
  **ALREADY SCANNED**.
- Sunday pass entered on Saturday returned **NOT VALID TODAY**.
- `https://tournibase.com/demo-pass` returned **INVALID PASS**.
- A user-approved, scan-only scanner link was created with a four-hour expiry,
  then revoked. Reopening it showed **This link is no longer active**.

No camera was accessed. Manual token validation does not prove optical QR
decoding or physical-device camera behavior. Only the actual QA pass was checked
in; the bulk-created passes were not scanned.

## Reproduced refund blockers

### Individual-pass refund: ambiguous database relationships

Clicking Refund this pass for an existing Saturday pass returned
`That pass could not be found.` The pass exists and belongs to the paid order.
Read-only REST verification returned PostgREST `PGRST201` because the query in
`src/app/api/stripe/refund-pass/route.ts` uses unqualified `orders!inner` and
`order_items!inner` embeds where multiple foreign keys exist.

The lookup needs explicit relationship names:

- `orders!passes_order_tournament_fk!inner(...)`
- `order_items!passes_order_item_relationship_fk!inner(...)`

It should also distinguish query failures from genuinely missing passes.

### Full-order refund: reversing a nonexistent application fee

The full-order control returned a refund failure. The staging runtime log at
20:11:43 UTC confirms Stripe rejected the request because the charge has no
application fee to refund. Both refund routes currently send
`refund_application_fee: true` unconditionally, even for the pilot/staging $0 fee.
That flag must be conditional on an actual application fee.

**Neither refund succeeded.** Final order state remains paid $54, refunded $0,
platform fee $0, with one checked-in Saturday pass and two active passes. No real
money moved. Refund receipt delivery and refunded-pass rejection could not be
verified end-to-end in this run. Do not mark them passed.

## Other payment findings

- Confirmed code edge case: the initial receipt sender accepts only `paid`, not
  `partial_refund`. A partial refund arriving before the initial receipt can
  permanently prevent delivery of the remaining passes' receipt.
- Not reproduced: overlapping refund synchronizations can overwrite newer
  refund totals with an older snapshot; the order update is not monotonic.
- Sandbox Checkout offered card, Apple Pay, Cash App, Affirm, Klarna, and Link
  bank payment. This is broader than the intended card-only launch. Review
  payment-method configuration before launch; delayed settlement can outlast the
  31-minute inventory reservation. Do not assume async webhook support alone
  prevents overselling after reservation expiry.
- Staging enforces a $0 platform fee. This purchase does not verify production's
  nonzero application-fee calculation, collection, or reversal.

## Production readiness and environment parity

Fresh Vercel metadata inspection found no production Stripe secret key,
publishable key, or either webhook signing secret. Rollout documentation says
production paid checkout is disabled; that switch's value was not freshly read.
Live keys/webhooks, live director onboarding, nonzero fees, and a controlled real
purchase/refund must still be verified before enabling paid admission.

Both latest successful deployments remain on application commit `f2fcead`, with
the intended environment-only differences. Earlier public checks in this QA
confirmed home pages load, staging uses noindex, unknown events return 404, and a
staging-only event is unavailable on production. Supabase is healthy again; the
October 10 paused-backend limitation no longer applies.

A CLI command intended to read configuration unexpectedly entered deployment
handling. It failed validation before any deployment was created. A subsequent
deployment listing confirmed the same two latest READY deployments; no push or
successful new deployment occurred. Do not reuse that `vercel env run` command.

## Local checks and limitations

Final visual inspection also reproduced a dashboard layout bug at a 1218px-wide
viewport: the Sales by day card grows to 935px high and pushes Admission progress
into the same vertical region as Event tools. Their measured top edges are both
1189px, and Event tools visually covers the snapshot. The shared chart's `h-full`
inside the event overview's stacked `space-y-6` wrapper is the likely cause. This
is a layout finding, not a payment/data failure, and remains unfixed in this QA.

- `npm run test`: 96 tests passed across 17 files, including 19 seed-generator tests.
- `npm run lint`: passed.
- `npm run build`: passed (optimized production build and all static pages).
- `npm run typecheck`: passed after two byte-identical, stale generated Next type
  duplicates were moved into ignored local QA evidence storage. No source file
  was removed or changed by that cleanup.
- Public event responsive checks earlier in this run found no horizontal
  overflow at 320px and 375px. The later authenticated Orders viewport override
  did not take effect (measured width remained 1280px), so that additional mobile
  check is not counted as passed.
- Existing October 10 dependency-audit limitation remains documented in
  `qa-follow-up.md`; this run did not claim a fresh clean full dependency audit.
- Not completed: production transaction, nonzero fee reversal, delayed-payment
  settlement, duplicate-webhook replay, simultaneous purchases, camera scanning,
  and end-to-end refund success.

The next payment task should fix both reproduced refund failures, add regression
tests for $0/nonzero fees and explicit relationships, address the receipt race,
and repeat hosted Sandbox partial/full refunds before live enablement.
