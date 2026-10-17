# Staging sample totals — October 17, 2026

## Request and scope

The user requested less artificially round numbers across all sample events.
The earlier layout screenshot's $20,000 / $19,300 values were temporary local QA
fixture metrics, not hosted event totals. That preview route was already removed.

Read-only inspection of every hosted staging event found three round sales/count
aggregates worth adjusting. The other two events already had varied totals.
Added only three synthetic orders, four order items, and eight active/unscanned
passes to the test organization. All figures remain calculated from the actual
stored orders and existing ticket prices; no display totals were hardcoded.

| Event | Captured online orders | Eligible online passes | Gross online sales | Sales-by-day total including manual sales |
| --- | ---: | ---: | ---: | ---: |
| Example Tournament (unchanged) | 355 | 943 | $11,765.00 | $11,745.00 |
| July Slam Dunk Tournament | 438 | 983 | $12,215.00 | $12,215.00 |
| Carolina Fall Tip-Off (unchanged) | 391 | 1,005 | $12,217.00 | $12,217.00 |
| Carolina Hardwood Classic | 391 | 921 | $21,208.00 | $21,766.00 |
| Queen City Fall Classic | 379 | 883 | $19,994.00 | $19,994.00 |

These are the dashboard RPC's definitions, not counts of all database rows.
Example Tournament retains a pre-existing $20 refunded-status order, which the
existing net-sales calculation excludes. No old refund/payment data was changed.
Carolina Hardwood's $558 manual sales also remain unchanged.

## Applied operation

Reviewed SQL: `scripts/adjust-staging-sample-totals-20261017.sql`.
Executed once through the authenticated Supabase connector for
`khwaafsdtgiymucppkmo`. **Do not rerun:** its exact before-state fingerprints must
now fail closed. This is a historical execution record, not a reusable seed.

| New order | Event ID | Existing ticket selection | Amount | Original event-week purchase time (UTC) |
| --- | ---: | --- | ---: | --- |
| 1958 | 3 | 1 weekend pass | $15 | 2026-07-15 22:43 |
| 1959 | 5 | 4 Saturday passes | $72 | 2026-09-17 16:27 |
| 1960 | 6 | 1 weekend + 2 Saturday passes | $64 | 2026-10-14 23:18 |

## Verification

- Transaction verified all nine existing-row fingerprints before and after the
  inserts: events, prices/ticket types, orders, items, passes, scanner links,
  check-ins, manual sales, and email records remained unchanged.
- Organization, owner, test environment, and Sandbox connected-account routing
  were explicitly checked. Ticket capacity and purchase timestamps were checked.
- Independent post-commit reads through `get_tournament_dashboard_metrics` checked
  all five events and produced the table above.
- Each new order's item amounts equal its stored amount; item quantities match
  all eight generated passes. All eight passes remain active and unscanned.
- No new order has a Stripe Checkout, PaymentIntent, or Charge ID. Zero emails,
  scans, real charges, refunds, or production records were created or changed.
- Database now has 1,958 test orders and 4,737 total passes; zero live orders.
- No application runtime code, UI, staging/production configuration, deployment,
  or marketing snapshot changed. No push is required for these database records
  to appear; refresh an already-open staging dashboard.

Whole-dollar ticket prices naturally produce `.00` totals, and zero refunds/fees
must stay accurate. This change makes the current sample aggregates less round;
it does not manipulate real reporting or guarantee future sales never land on a
round number. The existing homepage remains a historical showcase snapshot.
