# Launch QA follow-up — October 20, 2026

## Deployment completion

The user subsequently approved pushing both branches. Source `285c759` is Ready
on production (`2NMuJz9RaqCAoKjG5qZMhVZgKc3B`, 24 seconds) and staging
(`JAbHQsstgB68Sd6qoVRRdBMSFCaL`, 22 seconds). Both stable domains serve the
October 20 refund policy. The approved policy and free-pass UI fix are now
published. Production checkout and all pricing/account settings were unchanged.
The local/not-deployed notes below record the earlier QA checkpoint, not the
final release state. No real sales or bank payouts have been verified.

## Scope and conclusion

Authorized Sandbox-only purchases/refunds on Queen City Fall Classic, four
temporary ticket options, a four-hour scan-only link, read-only security and
hosting checks, and preparation of the approved refund/dispute policy.
No camera, live payment, live-account switch, billing-plan upgrade, or production
checkout activation occurred. This is not approval to launch real sales.

Both hosted branches were at `f3b1b2f` (runtime from `7ea3a1b`). The policy and
free-pass refund-button fix described below are local and await push permission.
Production retains legacy pricing with paid checkout disabled. Staging uses
the approved per-ticket tiers and platform-paid processing. Those are intentional
configuration differences, not separate application implementations.

## Hosted Sandbox evidence

| Order | Check | Observed result |
| --- | --- | --- |
| 2046 | Pending refund, then success | $17.49 ticket + $1.70 fee; initially $19.19 pending, $0 completed, active pass, and $1.70 application fee returned early. Later all $19.19 refunded, including $1.70 buyer fee; pass blocked; pending/failed both $0. |
| 2047 | Free/$5/$10/$10.01 mixed basket | Fees $0/$1/$1/$1.40; $25.01 ticket subtotal + $3.40 fees = $28.41. Four unique passes. Youth pass refunded exactly $6, other passes stayed active. Remaining $22.41 refund completed; all passes blocked and all fees returned. |
| 2048 | Refund later fails | $10.01 + $1.40 = $11.41. Initial success later became failed. Completed refund corrected to $0; failed amount $11.41; $1.40 fee advance retained for review; pass stayed blocked. App rejected another refund with its review-required message. |
| 2049 | Free-only checkout and admission | $0 total/fee, no Stripe PaymentIntent; internal `free_` checkout identifier. Pass issued, admitted once, repeat rejected as already scanned. |

All four receipt delivery records are `sent`, one attempt each. This confirms
provider submission, not inbox placement. Refund-email inbox placement was not
independently verified in this follow-up.

Refunded order 2047's Youth pass was rejected by the scanner as PASS NOT ACTIVE.
The scan-only link could not use lookup, recent scans, overrides, or gate sales.
It was revoked afterward; reopening it showed “This link is no longer active.”
Database confirms zero active scanner links for the event.

All four temporary options (Community Pass, Youth Admission, Evening Admission,
Courtside Admission) are inactive. The three original ticket options remain
active. Existing event dates and historical order routes were not changed.
The failed-refund order is intentionally retained as Sandbox review evidence;
it must not be treated as a real buyer debt or silently retried.

### Evidence limitations

The pending case demonstrates an early fee return and eventual successful
refund in the hosted flow. A separate Stripe event inspection of the exact
`pending_reason` and a deliberately controlled balance-exhaustion case were not
completed. Do not describe this as an independently proven exhaustive
low-balance test. The failed-refund retry was rejected by the application;
the provider's refund-object count was not independently inspected afterward.
Prior order 2045 remains the direct Stripe evidence of $46.24 director net from
a $50.09 purchase and $3.85 application fee, followed by full refund.

## Local changes and verification

- Terms and Refund Policy implement the user-approved allocation: approved
  ticket-plus-fee refunds; TourniBase absorbs nonreturned processing under the
  director-free plan; canceled events require full refunds; organizers cover
  valid event-related chargebacks; TourniBase covers its own errors.
- Conditions appear near the director-free explanation in Settings, not just
  legal pages. Ticket-editor guidance no longer incorrectly describes every
  fee as once per order or every processing charge as director-paid.
- Free passes no longer display a paid-pass refund button. The server already
  rejected zero-value refunds; this aligns the UI with that protection.
- 439 tests across 41 files, TypeScript, ESLint and production webpack build pass.
  Desktop policy preview inspected; these changes are not deployed yet.

These terms are prepared product policy, not legal certification. Cancellation
refunds and dispute cost allocation require support operations; this change does
not create automated cancellation refunds or a new organizer-debit mechanism.

## Read-only security and operational checks

- Both hosts: unauthenticated refund POSTs return 401; unauthorized Connect
  status returns 403; forged webhook signatures return 400. Public pages work,
  dashboard authentication redirects, staging event is not exposed on production,
  and staging retains noindex protections.
- All public database tables have RLS enabled. Service-only tables deny client
  access. The elevated metrics wrapper checks owner and environment with an
  empty search path; its privilege is intentional.
- Email confirmation and secure email change enabled; anonymous sign-in off.
  Leaked-password protection off and requires a paid Supabase plan. Secure
  password-change settings were not changed without checking recovery flows.
- Supabase is on Free; its dashboard says project backups are unavailable on
  that plan. No restore drill has passed. Do not launch without a suitable
  backup strategy and tested recovery.
- Vercel Hobby is not the commercial hosting plan for paid launch. Upgrade to
  an appropriate commercial plan before real sales; no upgrade was purchased.
- Production dependency audit: zero findings. Full audit: five dev-tool findings
  from the same unpatched braces advisory. No unsafe downgrade was applied.
- Actual narrow-mobile verification remains open: the browser's requested
  viewport change did not take effect (stayed 1280×720). No camera test claimed.

## Remaining launch gates, in order

1. Completed: user approved pushing both branches; policy/UI source `285c759`
   is Ready on both hosts and both public refund-policy pages were verified.
2. Resolve commercial hosting and backups; enable leaked-password protection
   when available and perform a recovery drill. Review operator account MFA,
   alerting and refund/dispute reserve responsibilities before real sales.
3. Complete the remaining controlled low-balance/provider check and real-phone
   layout/admission review (camera remains excluded unless separately allowed).
4. Real pilot director completes live Express onboarding. Verify actual live
   preview eligibility, processing payer, loss responsibility, charges, payouts,
   bank details and applicable platform pricing. Sandbox does not prove these.
5. Apply approved production per-ticket pricing while checkout remains off;
   recheck live webhook destinations, settings, public totals and environment
   isolation. Historical orders must retain their original fee/account snapshots.
6. Review the policy and establish event-day support, cancellation/refund funding
   and dispute handling. Keep exceptions prominent beside any “free” offer.
7. Explicitly authorize live checkout, then observe a genuine pilot purchase,
   receipt, admission and eventual bank payout before wider rollout. Never make
   a fabricated live purchase just for QA.

New-director guided onboarding remains on hold at the user's request.

Sources: [Stripe testing](https://docs.stripe.com/testing),
[refund behavior](https://docs.stripe.com/refunds),
[Supabase password security](https://supabase.com/docs/guides/auth/password-security),
[Supabase backups](https://supabase.com/docs/guides/platform/backups),
[Vercel Hobby](https://vercel.com/docs/plans/hobby),
[FTC fee guidance](https://www.ftc.gov/business-guidance/resources/rule-unfair-or-deceptive-fees-frequently-asked-questions).
