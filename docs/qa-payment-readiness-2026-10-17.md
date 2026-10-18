# Payment readiness audit — October 17, 2026

## Scope and limits

Baseline: web-app commit `d4f7752` (buyer-paid TourniBase fee). This audit combined source review, automated local tests, and **read-only** queries/advisors on the shared Supabase project. The authorized follow-up fixed refund issues locally. After explicit user approval, the parent worker then performed Sandbox purchases/refunds through the deployed app; this worker independently read their database and email-delivery results below. No charge/refund, live account creation, email send, admission, hosted migration, camera action, or deployment was performed by this audit worker.

**This is not a claim of 100% live readiness.** At inspection, the hosted database contained one test organization, one ready test connected account, six test events, and no live organization, connected account, event, or order. The deployed Sandbox buyer-fee flow is verified below, but a genuine director's onboarding, live receipt delivery, actual settlement and payout eligibility cannot be established by a read-only audit or Sandbox tests. The user deferred live director onboarding; **production paid checkout stays disabled by agreement**. Complete genuine pilot preparation before enabling sales. Staging and production must use the same application revision; only their intentional configuration differs.

## Parent-worker rollout update

The parent worker subsequently completed the following; these are not actions performed by this read-only audit worker:

- Applied the additive refund lifecycle migration to the shared hosted project. Its canonical migration filename is now `20261018000545_track_refund_lifecycle.sql`, matching hosted migration history (30 total migrations).
- Confirmed existing data counts remained unchanged **at migration application**: **2,037 orders, 4,910 passes, six events**. All new lifecycle fields initially read zero. Anonymous and authenticated roles still cannot UPDATE orders directly. Later authorized Sandbox purchases intentionally add records.
- Verified all **254 tests**, ESLint, TypeScript, Next type generation, and the webpack production build passed. The stale generated preview-route reference was cleared.
- Committed the code as `f00e242`, pushed both application branches, and confirmed both Vercel deployments **READY**: production `3Yxq635djvsDSHVMYq8kNKVCotwE`, staging `3uhRp7H99bmWUKBah5es5jNWheXb`.
- Created and saved environment-specific card-only payment-method configurations in both Vercel scopes.

- Confirmed both connected-account payment webhook destinations show eight subscribed events, including `refund.created`, `refund.updated` and `refund.failed`.

The subsequent Sandbox lifecycle/fee results are recorded below. Live director preparation remains deferred. Configured webhook subscriptions are not themselves proof that a particular webhook delivered successfully; event delivery evidence is distinguished separately.

Later parent update: the explicitly authorized, guarded temporary staging-fee QA support is committed as `5590ac4`. Both builds were **READY** on that revision (production `F9XZoALK31UxyKaQsZjVmbL5W9Fr`, staging `GoCMbYvuoXmzfWVLazNX6dPfzob3`); the parent reports **265 tests passed**. The temporary switch is test-only, defaults off, and permits the exact approved 2% + $0.30 scenario. Production fee configuration was not changed for this check. After the additional purchase and fee-inclusive refunds passed, the parent restored staging's fee variables to **0 / 0** and the QA switch to **false**, then confirmed restoration deployment `4Xbukpk3HjwijJGkc6MvmVs3SvFk` **READY** on `5590ac4`. The deployed public basket again showed **$46.24 with no fee** (Sunday $17.49 + Weekend $28.75).

Final validation update: the parent reports **34 test files / 277 tests**, ESLint, TypeScript and the webpack production build all passed after the Stripe dashboard URL and copy fixes. Source revision `f6be6cd7231c50b48c4020cd80f4a3a8efd590ea` was pushed to both application branches. The parent verified both deployments **READY** on that revision: production `HCnu3cCvMMpc1QELvtJBrRam2sm9` and staging `G66aPPavVYcpZe9x1o4QSred7c5c`. Live director onboarding remains deferred by the user, and production paid checkout remains disabled.

## Authorized deployed Sandbox verification

The parent used the existing Queen City Fall Classic event and the explicitly approved receipt mailbox. This worker used read-only Supabase and Resend connector calls to verify the resulting records; no pass tokens are recorded here.

| Case | Independently verified result |
| --- | --- |
| Normal purchase, order `2040` | Test environment, event 6, paid **$46.24** (Weekend $28.75 + Sunday $17.49), two active passes, no pending/failed refunds. The initial receipt was recorded sent and Resend confirmed **delivered** at `2026-10-18 00:10:40 UTC`. |
| Individual Sunday-pass refund | Parent reported the deployed app refunded $17.49. Resend independently confirmed the **delivered** partial-refund receipt for `TB-002040`, exactly **$17.49** against an original **$46.24**, at `00:12:38 UTC`. |
| Remaining full-order refund | Final database state: `refunded`, **$46.24** refunded, both passes `refunded`, pending/failed amounts zero, synchronization version 8. Resend independently confirmed the full-refund receipt for `TB-002040`, cumulative **$46.24**, **delivered** at `00:13:18 UTC`. No duplicate passes were created. |
| Pending-refund Sandbox card, order `2041` | Purchase **$17.49**, one active pass, receipt **delivered** at `00:16:20 UTC`. After the parent submitted the refund, the database correctly remained `paid` with completed refunds **$0.00**, pending refunds **$17.49**, failed refunds **$0.00**, synchronization version 3, and the pass still `active`. This initial snapshot verified pending accounting without falsely declaring success; its later transition is recorded below. |
| Pending → successful refund, order `2041` | Without resubmitting the refund, the parent observed the automatic update. Read-only verification confirmed completed refunds **$17.49**, pending/failed **$0.00**, status `refunded`, pass `refunded`, synchronization version 4. Resend confirmed the correct `TB-002041` refund receipt **delivered** at `00:19:24 UTC`. |
| Later-failing-refund card, order `2042` — initial stage | Purchase **$17.49**, receipt **delivered** at `00:19:07 UTC`. Immediately after the parent requested its refund, the database reflected initial Stripe success: **$17.49** refunded, status `refunded`, pass `refunded`, version 3. Its initial successful-refund receipt was **delivered** at `00:19:35 UTC`. The later failure transition is recorded below. |
| Successful → failed refund, order `2042` | **Verified after the later provider transition:** status returned to `paid`, completed refunds corrected to **$0.00**, pending **$0.00**, failed-refund history **$17.49**, synchronization version 5. The previously refunded pass remained **`refunded`/blocked**. This verifies deployed downward accounting correction without reopening admission. |
| Authorized nonzero buyer fee, order `2043` | With the temporary staging fee enabled, the database recorded **$47.46** paid: **$46.24 ticket subtotal + $1.22 buyer fee**. Platform-fee snapshot also **$1.22**; two active passes; no refunds. Resend confirmed receipt **delivered** at `00:28:24 UTC`, explicitly identifying `TB-002043`, the **$46.24** subtotal and **$1.22** service fee separately. |
| Individual fee-inclusive refund, order `2043` | Parent observed the Sunday-pass refund of **$17.95** in the deployed UI. Resend independently confirmed the `TB-002043` partial-refund receipt for exactly **$17.95**, against original payment **$47.46**, **delivered** at `00:29:26 UTC`. This is the $17.49 pass plus $0.46 allocated service fee. The remaining refund completed before this worker queried the intermediate database state, so a separate intermediate $0.46 database snapshot is **not** claimed. |
| Remaining fee-inclusive refund, order `2043` | Parent submitted the remaining **$29.51**. Independently verified final database: status `refunded`, completed refunds **$47.46**, buyer fee refunded **$1.22**, platform fee refunded **$1.22**, pending/failed **$0.00**, synchronization version 7, both passes `refunded`. Resend confirmed the full cumulative **$47.46** refund receipt **delivered** at `00:30:44 UTC`. Parent separately verified Stripe's fee detail: **$1.22 collected and $1.22 refunded**, captured in `sandbox-platform-fee-refunded.png`. |

Orders `2040`–`2042` used the intended staging **zero-fee** configuration. The user then approved a temporary staging fee of **2% + $0.30** for one additional purchase/refund, followed by restoration to zero. Order `2043` verifies the deployed nonzero buyer total, immutable fee snapshot, two-pass fulfillment, itemized delivered receipt, and full return of the buyer/platform fee across individual and remaining refunds. The parent subsequently verified restoration of staging to zero in both configuration and the deployed public basket. Both the pending → successful and successful → failed refund paths are independently verified above. No camera or camera retest was used.

At the pending-refund check, Resend's recent-message list contained the `2041` purchase receipt and the two verified `2040` refund receipts, but **no completed-refund receipt for pending order `2041`**.

After order `2042` later failed, the provider list showed no additional success receipt for that failure transition. Its earlier success receipt remains part of the historical email record; the later failure is surfaced in the director's order view. The parent confirmed the review warning and attempted another app refund: the deployed UI explicitly blocked resubmission instead of creating a new refund. No automated buyer failure-correction email is implemented; manual Stripe/support resolution is required.

The Stripe connector available to this worker exposes only the live platform account, not the Sandbox. It was not used to query live activity for these test orders. The database reconciliation version does not distinguish route-triggered synchronization from webhook-triggered synchronization, so it is not treated as webhook-delivery proof. Separately, the parent inspected the Sandbox webhook dashboard: all 15 recent deliveries showed **200 OK**, including the `refund.updated` event at `00:19:24 UTC` corresponding to order `2041`'s pending → success transition. The parent captured `sandbox-webhook-deliveries.png` as UI evidence.

For order `2042`, the parent separately confirmed the payment used card ending **5126**, the documented later-failing refund card. The provider had not yet reported failure at the initial inspection; the later read-only database verification above confirmed the expected correction. Stripe documents this transition as occurring later, without a fixed ETA.

## Findings and disposition

| Severity | Finding | Evidence / current disposition |
| --- | --- | --- |
| P1 | Asynchronous refunds could be treated as permanently successful after Stripe later reported failure. Pending state was not persisted. | Baseline `src/lib/orders.ts` only increased totals, and `src/app/api/stripe/webhook/route.ts` only processed `charge.refunded`. **Fixed and deployed in `f00e242`:** all refund pages are read; only current `succeeded` amounts count as completed refunds. Pending/requires-action and failed/canceled amounts are recorded separately. Fresh DB-version-before-Stripe reads plus CAS prevent an older worker overwriting a newer reconciliation. See `src/lib/orders.ts:296`, `src/lib/refund-lifecycle.ts:4`, migration `20261018000545_track_refund_lifecycle.sql` (applied hosted by parent). Deployed pending → success and success → failure acceptance checks **passed** on orders `2041` and `2042`. |
| P1 | Mixing exact pass-fee refunds and an external Stripe refund could overstate ticket refunds by one cent and fail the database constraint. | New buyer-fee regression: nine $10 tickets, $2.10 fee, six $10.23 pass refunds, then $30.71 external refund produced $90.01 ticket refunds against a $90 subtotal. **Fixed in `f00e242`** in `src/lib/buyer-fees.ts:131`: the external refund is apportioned against the remaining charge/fee, with bounds on ticket and fee balances. Regression and exhaustive residual-cent tests added. |
| P1 | No real director has yet completed the live path in the inspected data. | Read-only organization/account/event queries returned only environment `test`; live order/account/event counts were zero. **Unverified**, not a source-code failure. Complete live director onboarding and verify readiness before permitting their actual sales. |
| P1, conditional | Dynamic payment methods could allow delayed settlement beyond the 31-minute inventory reservation, risking overselling. | Baseline `src/app/api/checkout/route.ts`; reservation logic in `20260717031932_add_stripe_connect_foundation.sql`. **Fixed in `f00e242`:** required card-only payment-method configuration with runtime verification, no delayed methods. The parent created and saved both environment-specific configurations; the deployed Sandbox card purchases above succeeded. A genuine live director's purchase is not yet verified. |
| P2 | Shared-IP checkout limit of 12 attempts per 10 minutes could block families on venue Wi-Fi. | Baseline checkout limiter. **Fixed in `f00e242` by the public QA worker:** venue-scale IP threshold plus per-buyer limits; see public QA report and checkout regressions. |
| P2 | A 10-cent ticket plus 30-cent fee could reach Stripe below its USD 50-cent minimum. | Baseline accepted ticket values; Stripe's USD minimum. **Fixed in `f00e242` by the public QA worker:** public minimum-total message plus server validation before reservation and a defensive post-reservation check. |
| P2 | Password breach detection disabled in Supabase. | Read-only security advisor warning. **Operational follow-up**: enable leaked-password protection when supported by the project plan. Never claim this control enabled until verified. |

The original zero-application-fee full-refund problem, ambiguous pass lookup, and early partial refund preventing the initial receipt were already addressed before this audit baseline. Existing regressions remain green; they are not newly found failures in `d4f7752`.

## Refund behavior after the fix

- A pending or action-required refund is **not** displayed as money returned and does not invalidate an active pass yet. The order list and detail view show a persistent pending notice.
- Only successful refunds reduce revenue and invalidate their associated passes. A full successful refund invalidates all active/checked-in passes; an external partial refund without pass metadata updates the money, but does not guess which pass to cancel.
- A later failed/canceled refund corrects the completed refund totals and shows a persistent review notice. Previously refunded passes **stay blocked**; the software does not silently reopen admission.
- An application fee already returned to the director is irreversible in this workflow. It remains recorded as returned even if the buyer refund later fails. The financial record does not pretend those funds moved back to TourniBase.
- Failed/canceled attempts are resolved **directly in Stripe**, with support review before restoring a blocked pass. TourniBase intentionally does not resubmit a historical failed attempt automatically. Refund endpoints return HTTP 409 with that instruction; repeated clicks do not create another refund.
- Route responses and refund receipts verify that the specific requested refund still appears in the latest successful set. An old success event cannot send a success receipt for a refund now failed or pending.
- Failure notices are a record of failed/canceled attempts, not a total of money returned. They can remain visible after later manual recovery; review the Stripe payment record to determine the final outcome.

## Verified safeguards

Source inspection and automated tests verified:

- Paid Checkout uses the stored organization's connected account, while the buyer-paid TourniBase fee is a separate line item and Stripe application fee. Ticket subtotal and buyer-fee snapshots remain immutable. Legacy orders retain their original fee treatment.
- Environment checks bind the signed webhook, deployment, stored order routing, and organization. Wrong-account/environment fulfillment and refunds fail closed.
- Browser-facing checkout cannot choose an arbitrary application fee. The privileged fee-aware reservation RPC is service-role only and retains inventory locking.
- Fulfillment upserts unique order-item/pass sequences, preserving refunded passes on retries. Early partial refunds do not prevent the remaining valid passes from being created. Full refunds do not recreate admission.
- Confirmation delivery uses a persisted delivery claim plus provider idempotency. Refund receipts use provider idempotency. Transport errors still need operational monitoring/retry; successful mocked calls do not prove mailbox delivery.
- All 13 public tables had RLS enabled. Anonymous roles had no direct SELECT/INSERT access. No order/organization environment mismatches were found. The two service-only tables with no RLS policies have no browser grants; those advisor notices are intentional, not missing public access rules.
- Authenticated metrics wrappers check ownership and environment. Older environment-unaware privileged RPCs remain revoked. Unused-index advisor notices are not a reason to drop indexes without workload evidence.

## Local verification

- Baseline: 26 test files / 220 tests passed.
- Combined local QA fixes at this worker's verification point: **32 test files / 254 tests passed**.
- Final parent verification after the subsequent guarded fee QA and dashboard URL/copy fixes: **34 test files / 277 tests passed**; ESLint, TypeScript and the webpack production build passed on `f6be6cd7231c50b48c4020cd80f4a3a8efd590ea`.
- ESLint passed with zero warnings. The parent cleared the stale generated temporary-preview reference and confirmed TypeScript, Next type generation and the webpack production build all passed.
- Added tests cover pending → success, success → failure, out-of-order/concurrent reconciliation, no automatic pass reactivation, exact fee allocation after external refunds, historical fees, duplicate refund requests, failed-refund HTTP responses, refund lifecycle webhooks, and persistent UI notices.
- Root worker reran all 30 migrations and `supabase/tests/buyer_paid_fees.sql`, including the new lifecycle assertions, in isolated PGlite: **passed**. These check versioned downward corrections, stale CAS rejection, browser UPDATE revocation, immutable routing/fee snapshots, and irreversible platform fee refunds.

## Required rollout order

1. Keep production paid checkout disabled while deploying the remaining fixes.
2. **Completed by parent:** reviewed and applied `supabase/migrations/20261018000545_track_refund_lifecycle.sql` to the shared project before deployment. It is additive and introduces no public RPC or new grants. Retain a rollback/recovery plan; do not drop the new columns while the new app is deployed.
3. **Completed by parent:** `refund.created`, `refund.updated`, and `refund.failed` are subscribed on **both** environment-specific connected-account payment webhook destinations, retaining `charge.refunded` and existing Checkout events. No Accounts v2 destination change was required.
4. **Completed by parent:** both `f00e242` deployments and the later `5590ac4` deployments are READY, with each destination retaining its own account, keys, webhook secret and domain. Environment-specific card-only configurations are saved. Sandbox purchases and lifecycle refunds passed; staging was restored to zero fees with the QA switch off and its deployment/public basket verified.
5. Complete the Sandbox acceptance cases below, confirm webhook delivery/retry behavior, and verify the director-visible totals and emails. Replay any already-failed refund events after deployment if needed; the migration itself does not backfill or fabricate Stripe state.
6. **Deferred by user; production checkout remains disabled:** complete the genuine live director's onboarding and confirm card payments/payout eligibility, live webhook delivery, email configuration, and fee settings. Only then enable the authorized pilot's real sales. Do not use fabricated live purchases to test: Stripe's testing documentation explicitly prohibits live-mode testing with real payment details.

## Sandbox acceptance coverage and remaining checks

Use explicitly authorized Sandbox orders; do not use a camera or touch live data.

1. **Passed:** normal unequal-price multi-pass purchase, itemized nonzero service fee, unique fulfillment, delivered receipt and parent-verified connected-account payment. See orders `2040` and `2043`.
2. **Passed for financial totals/pass state/receipts:** individual pass then remainder with zero and nonzero fees; every cent of the original $47.46 and $1.22 application fee accounted for. No camera or admission attempt was performed. Duplicate successful-refund requests have automated regression coverage; no separate deployed duplicate-success request is claimed here.
3. **Passed:** Stripe's documented pending-refund Sandbox card (`4000 0000 0000 7726`), initial pending money/pass state and no false-success receipt, then successful webhook transition and delivered refund receipt.
4. **Passed:** Stripe's documented later-failing-refund Sandbox card (`4000 0000 0000 5126`), downward correction of completed refunds, persistent blocked pass, parent-observed review notice and blocked app resubmission requiring manual Stripe resolution.
5. **Automated coverage; not performed through deployed Stripe:** combine exact individual-pass refunds with an external Stripe refund, including the nine-ticket/$2.10-fee edge case above, and verify all balances and constraints to the cent.
6. **Automated coverage; not explicitly replayed on deployed Stripe:** replay/reorder refund and Checkout events and retry interrupted synchronization, checking duplicate fulfillment/application-fee refunds and stale state rejection.
7. **Source/read-only database/automated coverage:** cross-environment and cross-organization authorization guards. A separate unrelated live director session and live identifiers were not created for this audit.

## Sources

- [Stripe refund testing and live-mode testing restrictions](https://docs.stripe.com/testing#refunds)
- [Stripe refund lifecycle](https://docs.stripe.com/refunds)
- [Stripe minimum charge amounts](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

Read-only database evidence was collected through the Supabase connector. No credentials, personal buyer records or admission tokens are included in this report.
