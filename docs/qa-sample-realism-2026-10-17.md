# Sample pricing and attendance — October 17, 2026

## Scope

The user requested more plausible check-in totals (especially for past events)
and varied money amounts with cents. This supersedes the earlier request to
leave all seeded passes unscanned and preserve whole-dollar sample prices.
All work is confined to existing staging events in test organization 1; no live
records, real payments, application code, or environment configuration change.

The attendance rates are illustrative sample assumptions, not research-backed
industry averages or a measurement of real tournament attendance. New scan
history is simulated; no camera is accessed and no optical QA result is claimed.

## Applied pricing

Whole-dollar ticket prices caused whole-dollar sales totals. Instead of inventing
independent aggregate figures, update each sample ticket type's price and
recalculate the matching generated order items and order totals.

| Event | Saturday | Sunday | Weekend |
| --- | ---: | ---: | ---: |
| Example Tournament | $9.75 | $11.25 | $16.49 |
| July Slam Dunk Tournament | $12.49 | $10.95 | $18.75 |
| Carolina Fall Tip-Off | $11.95 | $10.49 | $17.25 |
| Carolina Hardwood Classic | $18.49 | $17.95 | $29.75 |
| Queen City Fall Classic | $18.95 | $17.49 | $28.75 |

Old Saturday/Sunday/weekend prices were $10/$10/$15 for events 1, 3, and 4,
and $18/$18/$28 for events 5 and 6. Prechecks require every editable synthetic
item to match that old catalog and every order to equal its line-item total.
No arbitrary per-order surcharge or nonexistent discount is introduced.

Only the 1,915 paid, unrefunded, unemailed generated orders with known
`volume-20261017-*`, `variation-20261017-*`, or event-5 `showcase-demo-*` markers
are eligible. All must have test routing, zero platform fees, and no Stripe
Checkout/PaymentIntent/Charge IDs. The 43 protected Stripe/emailed orders keep
their original price snapshots, as historical purchases should. Existing manual
cash sales, zero refunds, and zero platform fees also remain accurate.

Reviewed one-time operation: `scripts/adjust-staging-pricing-20261017.sql`.
It checks exact fingerprints before and after acquiring locks, fingerprints all
protected fields/rows around the transaction, and reconciles catalog/item/order
prices and final event aggregates. Its stale-snapshot guards prevent reruns.

## Applied attendance

`scripts/adjust-staging-attendance-20261017.sql` added 3,509 historical admissions
to previously unscanned generated passes. Family members arrive together within
each valid day; arrival times vary across 08:00–18:00 local with more near opening.
Each timestamp follows both pass creation and purchase by at least three minutes,
falls within the pass/event window, and precedes the fixed October 17 21:41 UTC
cutoff. Uses remain one successful admission per pass, including weekend passes.

About 96% of the new sample rows represent normal QR entry and 4% manual entry.
These are simulated history categories, not evidence that an optical scan test
ran. Every earlier attempt and protected payment-linked pass remains unchanged.

Five supporting historical scanner records (IDs 24–28) were inserted already
revoked, with scan-only permissions and no raw token/link generated or retained.
They cannot authorize scanner access. No existing scanner was modified.

| Event | Checked in / online passes | Turnout | Unscanned | Gross online sales |
| --- | ---: | ---: | ---: | ---: |
| Example Tournament | 867 / 943 | 91.94% | 76 | $12,615.19 |
| July Slam Dunk Tournament | 927 / 983 | 94.30% | 56 | $14,925.09 |
| Carolina Fall Tip-Off | 894 / 1,005 | 88.96% | 111 | $14,009.29 |
| Carolina Hardwood Classic | 861 / 921 | 93.49% | 60 | $22,154.65 |
| Queen City Fall Classic | 577 / 883 | 65.35% so far | 306 | $20,467.68 |

Queen City is still in progress: all 193 Sunday-only passes remain unscanned,
including the protected real Sandbox QA order's Sunday pass. They are future
admissions, not no-shows. Completed events retain plausible no-shows and late
purchases that had no valid daytime arrival window; their pass statuses are not
falsely changed to refunded, expired, or checked in.

## Execution and verification

Executed attendance first, then pricing, using the authenticated Supabase
connector for `khwaafsdtgiymucppkmo`. Both atomic operations completed and passed
their pre/post fingerprint assertions. **Do not rerun either historical script
or refresh its snapshot guards.** No permanent schema changes were made.

Independent post-commit reads confirmed:

- Dashboard RPC totals for all five events match the table above.
- All 1,915 repriced sample orders equal their line-item sums. Every changed line
  item matches its sample catalog price, and every item quantity matches its
  issued passes: zero amount, unit-price, or pass-quantity mismatches.
- Zero invalid new admission timestamps, duplicate new admissions, scans of
  protected Stripe/emailed orders, or current-event Sunday admissions.
- All five new historical scanner records are revoked.
- Email-record fingerprint stayed `aa276ad3dc20cc05512191e19194fad8`; no emails sent.
- All 23 Stripe-linked orders retain their previous per-event totals ($285, $32,
  and $54) and refunds. QA order 1957 is still paid $54 / refunded $0; this work
  does not resolve or claim a pass for the pending hosted refund retest.
- Database counts remain 1,958 test orders and 4,737 passes; zero live orders.
- 179 tests across 21 files passed, including six attendance-plan checks. ESLint
  and diff checks passed as well.

Existing Example Tournament refunded-status history still explains the $20
difference between gross captured sales and the chart's $12,595.19 net total.
Carolina Hardwood's unchanged $558 manual sales make its chart total $22,712.65.
Zero refunds/fees and real or previously emailed whole-dollar orders remain
accurate rather than being artificially assigned random cents.

No runtime code, UI, application behavior, staging/production configuration,
public marketing snapshot, or deployment changed. Refresh an open staging page
to see the data; no push is needed. Local main/staging branches remain aligned.

## Subsequent smaller first event

At the user's request, added **Piedmont Summer Tip-Off** (event 7), June 27–28,
2026, at Piedmont Community Center in Greensboro. It precedes every other event
chronologically and uses the same staging organization and application UI.

- 79 stored paid sample orders; 173 unique passes; $2,017.79 gross sales.
- 157 checked in (90.75%) and 16 unscanned, with families arriving together.
- Saturday $8.75, Sunday $9.49, weekend $14.95. Purchases span June 22–28,
  with smaller Monday/weekend volume and the highest revenue on Wednesday.
- 153 simulated normal entries and four manual entries. Two supporting
  historical scanner sessions are already revoked; no camera or active link.
- No Stripe charges or emails. Existing records passed all nine fingerprints.

Applied the guarded SQL generated by
`scripts/seed-first-small-event-20261017.mjs --sql`; `--preview` shows its manifest.
**This seed is completed. Do not refresh its baseline or rerun it.**
Independent dashboard RPC reads verified these totals, zero invalid admission
times/amount mismatches, and earliest-event position. Live-environment lookup
returns null. Targeted ESLint, JavaScript syntax, and diff checks passed.
