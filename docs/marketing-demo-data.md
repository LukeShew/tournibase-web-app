# Carolina Hardwood Classic capture data

Created September 19, 2026 for the authorized TourniBase marketing video capture.

- Dashboard: `https://staging.tournibase.com/dashboard/tournaments/5`
- Public event: `https://staging.tournibase.com/e/carolina-hardwood-classic-2026`
- Event dates: September 19–20, 2026, America/New_York.
- Owner: the existing staging director, organization 1 (`test`).
- Data is entirely synthetic. The event description says so. The video must also identify it as a demo event.

## Seeded snapshot

| Ticket | Price | Online passes | Online revenue |
| --- | ---: | ---: | ---: |
| Weekend Pass | $28 | 463 | $12,964 |
| Saturday Pass | $18 | 291 | $5,238 |
| Sunday Pass | $18 | 163 | $2,934 |
| Total | | **917** | **$21,136** |

The 390 synthetic family orders contain 1–4 passes each. Buyer names are generated combinations, and every buyer email ends in `@example.com`.

There are 37 additional manual admissions across 19 transactions: 31 paid admissions and 6 complimentary admissions. Manual revenue is $558. Combined estimated revenue is $21,694. The 917 figure describes online passes; the combined online and manual admission count is 954.

Before interactive video capture, 613 passes were checked in (391 weekend and 222 Saturday), leaving 304 unscanned. The seed includes 597 successful camera scans, 16 successful manual lookups, 9 duplicates, 3 wrong-day attempts and 1 invalid attempt. The two staff sessions cover Main Entrance and Court 4 Entrance. Subsequent authorized UI demonstrations can change these counts; use the latest dashboard capture for the final video.

### Final capture snapshot

At 12:31 PM Eastern on September 19, the real scanner UI demonstration had admitted one previously unused weekend pass and then rejected its repeat submission. The verified final capture counts are **614 checked-in passes**, **303 unscanned passes**, and **10 duplicate attempts**, with the same 917 passes and $21,694 revenue.

Read-only database checks found zero scans before their corresponding orders, zero future paid orders, scans or manual sales, zero order rows outside the test environment, and zero pass/scanner relationships pointing outside event 5. Email-delivery rows remain zero. No dataset changes were made during this final verification.

## Sales timing

This is a Saturday-midday snapshot. Presales build during the week and peak Saturday morning; no Sunday sales or future check-ins are fabricated.

| Date | Online | Manual | Total |
| --- | ---: | ---: | ---: |
| Mon, Sep 14 | $748 | $0 | $748 |
| Tue, Sep 15 | $1,116 | $0 | $1,116 |
| Wed, Sep 16 | $1,852 | $0 | $1,852 |
| Thu, Sep 17 | $2,812 | $0 | $2,812 |
| Fri, Sep 18 | $5,952 | $0 | $5,952 |
| Sat, Sep 19 | $8,656 | $558 | $9,214 |

## Reproducible source and execution boundary

`scripts/seed-marketing-demo.mjs --preview` prints the expected manifest without connecting to a service. `--sql` emits an insert-only transaction. It must be executed through an authenticated administrative connection targeting the pinned Supabase project `khwaafsdtgiymucppkmo`.

Staging and production share this database, so the script checks the exact director, anchor event 4, organization 1, immutable `test` environment, and a ready connected Stripe test account before inserting. It rejects an existing showcase slug and dates outside the approved capture weekend. Any failed row or final assertion rolls back the entire event transaction. It does not modify existing events, schema, permissions, ownership, Stripe account configuration, or auth.

The script records synthetic paid status directly in staging. It does not create Stripe Checkout sessions, PaymentIntents, charges, payouts, or email-delivery rows, and makes no Stripe or email API calls. This is a UI demo dataset, not a Stripe reconciliation fixture.

Optional `--save-private-scanners` writes fresh scanner URLs to `.env.marketing-demo/capture-access.json` and puts only their SHA-256 hashes in the emitted SQL. This directory is covered by the existing `.env*` Git ignore. The capture run also saved one active weekend pass and one checked-in pass to `.env.marketing-demo/passes.json`. Never commit these files or publish scanner URLs. Do not regenerate the private scanner file after seeding unless a new seed is intentionally being prepared; the existing database hashes would no longer match.

## Verification performed

- JavaScript syntax check and scoped ESLint passed.
- Transactional assertions confirmed pass, admission and revenue totals.
- The production dashboard metrics function, called with the authorized test director context and `test` environment, returned the expected ticket splits, daily sales, gate counts and active scanner counts.
- Database verification found zero email-delivery rows and no Stripe payment identifiers for these synthetic orders.
- No production rows or existing events were changed. No code was deployed or pushed.
