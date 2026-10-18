# Public-site regression QA — October 17, 2026

## Scope and result

Read-only hosted checks covered `https://tournibase.com` and
`https://staging.tournibase.com`, plus local source commit `d4f7752`.
The user story was: a visitor can discover TourniBase, reach the correct
environment's event or director login, and use payment-related entry points
without bypassing ownership, environment, or webhook-signature checks.

The public pages and the tested rejection paths worked. These checks **do not
prove that live payments, payouts, refunds, or receipt delivery work end to end**.
No real or Sandbox transaction, account, order, admission, email, or refund was
created by this QA. No camera was accessed. Browser visual/interactivity checks,
authenticated director checks, Stripe account readiness, and deployment
verification are separate parts of the parent QA task.

The initial hosted checks ran approximately 23:49–23:54 UTC while deployment
work was ongoing. They describe the responses observed, not an assertion that
every request already used `d4f7752`. The parent task subsequently confirmed
both deployments READY on that source:

- Production: `3v7SPz1KXHdfWT1ZXS1TNEggk4dH`.
- Staging: `GjuEgcwZY9DbaW1n84wvbuL5MjjC`.

The user then approved corrections to the findings. The parent pushed matching
source `f00e242` to both deployment branches. A read-only hosted recheck at
**2026-10-18 00:08:26 UTC** confirmed the public corrections on both domains;
the initial hosted results remain below as evidence of what was found.

## Post-deployment regression

- Both anonymous Connect-status requests now return **403**, not 500.
- Both `/order/success` responses explicitly contain **noindex, nofollow,
  nocache** and private/no-store cache directives.
- Missing and invalid signatures return **400** on both the payment webhook
  and account-status webhook, in both environments. These requests cannot
  establish valid signed delivery; they verify rejection only.
- Home, login, terms, privacy, refund policy, and support return 200. Anonymous
  dashboards redirect to login. Production signup returns 200; staging signup
  intentionally redirects to production.
- Queen City Fall Classic's ticket/share pages return 200 in staging and 404 in
  production. Removed development preview routes return 404 in both.
- Normalized homepage visible text matches exactly between environments
  (**5,003 characters**). CSP is present on all checked responses; staging's
  noindex response headers remain intact. Public policy pages may be publicly
  cached; account/order/event responses checked here remain private/no-store.
- No valid checkout was submitted, no authenticated state was changed, and no
  payment, refund, email, or admission was created during the recheck.
- The parent reported all **30 migrations applied**, including
  `20261018000545_track_refund_lifecycle.sql`, and final tests, lint, typecheck,
  Next type generation, and webpack production build passing. These deployment
  and migration facts are parent-reported; the HTTP checks above were performed
  independently by this audit worker.

### Later fee restoration and small follow-up fixes

- After the explicitly authorized nonzero-fee Sandbox purchase/refund, the
  parent confirmed staging's restoration deployment
  `4Xbukpk3HjwijJGkc6MvmVs3SvFk` **Ready**. The actual public ticket form again
  showed $17.49 and $28.75 tickets totaling **$46.24 with no service fee**.
  Production checkout remained disabled; no live onboarding was performed.
- Follow-up source commit `f6be6cd7231c50b48c4020cd80f4a3a8efd590ea` fixes the
  director payment and Settings dashboard links to place the connected account
  before `/test` in Stripe URLs. Live links omit `/test`. These are ordinary
  director-owned dashboard links requiring the director's own Stripe login,
  not platform-administration access or generated login credentials. Existing
  organization ownership and environment checks remain enforced.
- Failed-refund modal guidance now directs unresolved failed/canceled attempts
  to Stripe/support instead of contradicting the manual-recovery notice with
  an instruction to retry through TourniBase. Normal refund guidance remains
  unchanged.
- The parent reports **277 tests in 34 files**, lint, TypeScript, and webpack
  production build passing for the final source. The parent subsequently
  verified both `f6be6cd` deployments **Ready**: production
  `HCnu3cCvMMpc1QELvtJBrRam2sm9` and staging
  `G66aPPavVYcpZe9x1o4QSred7c5c`.

### Final public HTTP recheck

At **2026-10-18 00:37:10 UTC**, this worker independently repeated the safe
public checks on both domains:

- Home, login, terms, privacy, refund policy, and support: **200**, no detected
  server-error response. Signed-out dashboard and Settings: **307** to login.
- Anonymous Connect-status request: **403**. Both webhook routes with missing
  or invalid signatures: **400**; no valid signed event was submitted.
- Order confirmation: **noindex, nofollow, nocache** and private/no-store.
- Queen City Fall Classic: **200 staging / 404 production**. CSP remained
  present on all checked pages; staging's noindex headers remained intact.
- Homepage visible text remained identical (**5,003 characters** each).

No valid checkout, authenticated mutation, database write, payment, email,
refund, admission, or camera use occurred during this recheck. HTTP observations
are independent evidence; final deployment IDs/Ready states above were confirmed
by the parent worker.

## Verified public behavior

| Check | Production | Staging |
| --- | --- | --- |
| Home, login, terms, privacy, refund policy, support | HTTP 200; no server-error digest | HTTP 200; no server-error digest |
| Signup | HTTP 200 | Redirects to production signup, intentionally |
| Anonymous dashboard, settings, event overview | Redirects to login | Redirects to login |
| Anonymous gate-poster print page | Redirects to login | Redirects to login |
| Unknown event slug | HTTP 404 | HTTP 404 |
| Queen City Fall Classic ticket page | HTTP 404, test event not exposed | HTTP 200 with ticket form |
| Queen City Fall Classic coach-share page | HTTP 404 | HTTP 200 |
| Invalid mobile-pass token | HTTP 404 | HTTP 404 |
| Invalid scanner-session token | Unavailable-link screen; cannot scan | Unavailable-link screen; cannot scan |
| Success page without a checkout ID | Clear “could not find this checkout” state | Same |
| Development email preview and removed demo-pass route | HTTP 404 | HTTP 404 |
| HTTP origin | Redirects to HTTPS | Redirects to HTTPS |

Additional evidence:

- All nine homepage Next.js CSS/JavaScript/font assets checked on each host
  returned HTTP 200.
- Normalized visible homepage text matched exactly between hosts (4,935
  characters). Different build hashes alone are not evidence of different UI.
- Staging returned `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` and
  noindex metadata. Public signup links intentionally go to production.
- Both hosts returned CSP, HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, a strict-origin referrer policy, and a
  permissions policy disabling microphone/geolocation and allowing own-origin
  camera use.
- HTML responses were private/no-store. Requests attempting to optimize a
  nonexistent offline-pass image returned 404; this does not by itself prove
  caching behavior for a valid pass.
- The active staging event rendered all three existing ticket types and their
  non-round prices. This check did not submit the purchase form.

## Safe API rejection checks

All requests used anonymous sessions. Checkout requests were deliberately invalid
or used a nonexistent event and ticket ID, so validation stopped before the
rate-limit/reservation calls. Webhook tests failed before processing events.

| Request | Both hosts |
| --- | --- |
| Checkout malformed JSON | HTTP 400 |
| Checkout missing required fields | HTTP 400 |
| Checkout zero ticket quantity | HTTP 400 |
| Checkout duplicate ticket type | HTTP 400 with explicit duplicate message |
| Checkout nonexistent event/ticket selection | HTTP 409 |
| Individual-pass refund without login | HTTP 401 |
| Full-order refund without login | HTTP 401 |
| Payment webhook without signature | HTTP 400 |
| Account-status webhook without signature | HTTP 400 |
| Either webhook with invalid signature | HTTP 400 |

## Findings

### Order confirmation indexing — corrected and verified hosted

The checked production `/order/success` inherited `index, follow` from the root
metadata. A real URL carries a bearer checkout-session ID and its successful
response contains buyer details and individual pass links. It should use
`noindex`, `nofollow`, and `nocache`, matching the mobile-pass pages. This finding
does **not** mean a search engine has indexed any buyer's order; it identifies a
missing preventative directive. `src/app/order/success/page.tsx:9` now explicitly
sets all three directives, with a regression test.

### Missing-session Connect status HTTP 500 — corrected and verified hosted

Anonymous `POST /api/stripe/connect/status` with `{"organizationId":1}` returned
HTTP 500 and `Stripe status could not be refreshed.` on both hosts.
The baseline `getOwnedOrganizationForStripeConnect` called `requireDirectorWorkspace`, whose
redirect is caught as a generic failure by the API handler. An absent session
should produce a normal 401/403 response. The tested request did not reveal
account details or change a Stripe account. This primarily affects error
handling and observability when a session expires.

`src/lib/stripe-connect-director.ts:9` now uses the nullable workspace lookup and
returns no ownership for an absent session. The status handler consequently
returns 403, while retaining both owner and environment checks. Tests cover
missing sessions, another organization, and an authorized request.

### Checkout resilience and safe payment methods — deployed; purchase proof separate

- `src/app/api/checkout/route.ts:177` requires a matching-mode
  `STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION` ID for paid purchases. Missing
  configuration fails closed before an inventory reservation; free orders do
  not require it.
- `src/app/api/checkout/route.ts:426` selects that Stripe configuration. The
  response guard at line 455 verifies the resolved session supports exactly
  `card`. Any other methods cause the session to be expired, the order marked
  failed/released, and no payment URL returned to the buyer. Existing async
  webhook handlers remain in place for earlier sessions and defense in depth.
  Stripe's [payment-method configuration guidance](https://docs.stripe.com/payments/payment-method-configurations)
  supports this approach without hardcoding `payment_method_types`.
- The operator must configure a dedicated card-only parent configuration in
  each Stripe mode and save its ID in the matching Vercel environment. The
  code's presence alone does not prove those hosted configurations exist.
- `src/app/api/checkout/route.ts:197` allows up to 300 attempts per shared IP per
  ten minutes rather than 12, while preserving six attempts per buyer email per
  ten minutes. Tests cover thirteen separate buyers behind one IP, the broad IP
  cap, and the stricter email cap. This is a pilot traffic backstop, not proof of
  unlimited shared-network capacity or a concurrent load test.
- `src/app/api/checkout/route.ts:232` checks the server-computed buyer total
  against Stripe's [USD $0.50 minimum](https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts)
  before reserving inventory. The authoritative reservation is rechecked at
  line 341 in case a ticket price changes concurrently; rejected reservations
  are marked failed. Free orders remain free. Tests cover $0.40 rejection,
  exactly $0.50 acceptance, and a concurrent price decrease.
- A free-to-paid price race also rechecks the paid-checkout switch and required
  payment configuration after reservation. Stripe platform verification is now
  inside the caught session-creation block, so a verification failure follows
  the existing failed-order cleanup path.

### Full dependency audit is not clean, but production audit is clean

- `npm audit --omit=dev --json`: **zero vulnerabilities**.
- Full `npm audit --json`: **five high findings** in one development-tool
  dependency chain: `eslint-config-next` → `@next/eslint-plugin-next` →
  `fast-glob` → `micromatch` → `braces`.
- Root advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
  a stack-exhaustion denial of service from deeply nested patterns. The reviewed
  advisory lists `braces <=3.0.3` as affected and no patched version. A fresh
  registry lookup also reported 3.0.3 as latest.
- No application route imports this lint dependency chain. Do not describe this
  as a demonstrated customer-facing payment vulnerability.
- npm suggested downgrading `eslint-config-next` to 14.2.35. That would mismatch
  this application's Next.js 16.3.8 setup; no downgrade or forced audit fix was
  applied. Treat the lint tooling as trusted-input-only and reassess when an
  upstream fix is published.

### Independent refund-lifecycle source review — deployed, Sandbox lifecycle verified

The new refund diff was reviewed independently without changing the payment
agent's files. No remaining blocking source defect was identified in that diff.
The review covered the new lifecycle helper, refund handlers and webhooks,
buyer-fee allocation, order synchronization, staff notices, and migration
`20261018000545_track_refund_lifecycle.sql`.

- Financial refund totals include only currently successful Stripe refunds;
  pending/requires-action and failed/canceled attempts are tracked separately.
  A subsequent failure can correct previously reported success without
  reopening canceled passes or pretending an already-returned application fee
  was recovered.
- A worker reads the database version before its authoritative Stripe snapshot.
  An optimistic-concurrency conflict restarts both reads, so an older worker
  cannot overwrite a newer refund correction. Owner, connected-account, and
  environment checks remain intact; order writes remain service-role-only.
- Mixed exact pass refunds and external Stripe refunds allocate the remaining
  buyer fee against the remaining payment. The lower bound prevents reporting
  refunded ticket revenue above the original ticket subtotal.
- The review found unclear retry guidance for historical failed/canceled
  attempts. Both refund actions now return an explicit HTTP 409/manual-review
  message rather than inviting an automatic retry. These attempts intentionally
  require resolution directly in Stripe, plus support review before restoring
  blocked admission. The original safe retry/deduplication guard is not bypassed.
- Historical failure notices are not proof that a refund is still owed; they
  persist even after a separate manual recovery succeeds. There is no automatic
  clearing of that history, pass restoration, or reversal of a prior
  application-fee credit. Staff must reconcile the actual Stripe outcome.
- The parent applied the additive database migration before the new code and
  confirmed both connected-payment destinations include `refund.created`,
  `refund.updated`, and `refund.failed`, alongside existing `charge.refunded`.
  Subsequent authorized Sandbox checks verified normal partial/full refunds,
  pending → success, success → failure without reopening admission, and the
  nonzero buyer-fee purchase/refund. The payment worker independently checked
  database states and delivered emails; the parent inspected successful webhook
  deliveries. See the completed evidence and remaining coverage limits in the
  [payment readiness report](qa-payment-readiness-2026-10-17.md#authorized-deployed-sandbox-verification).
  These are Sandbox results, not proof of live settlement or payouts. The user
  deferred live onboarding, and production paid checkout remains disabled.

### Non-blocking product/SEO gaps

- `/robots.txt` and `/sitemap.xml` return 404. Staging is still protected from
  indexing by its actual response directives. Production can benefit from a
  deliberate sitemap/robots setup.
- `www.tournibase.com` and `tournibase.com` both serve the homepage, with neither
  a canonical link nor a redirect to one primary hostname in the checked
  response. This is an SEO consistency issue, not a checkout failure.
- There is no self-service forgotten-password/recovery route or link in the
  current login UI. Directors who lose access need support; this was not tested
  by sending recovery email.

## Local verification

- `npm test`: **220 tests passed in 26 files**.
- `npm run lint`: passed with the repository's zero-warning policy.
- `npm run typecheck`: passed.
- After the corrections above, 16 focused checkout/Connect-status/confirmation
  tests passed, and full lint and TypeScript checks passed again. The parent
  task runs the combined final suite/build with the other QA corrections.
- Independent refund-review rerun: **103 tests in six files passed**, covering
  lifecycle state, buyer-fee allocation, fulfillment, refund routes/webhooks,
  and order-log notices. The payment worker separately reported the combined
  suite at **254 tests in 32 files**; the parent reported all 30 migrations plus
  lifecycle SQL assertions passing in isolated PGlite. Hosted rollout and
  provider delivery remain separate verification steps.
- The initial combined checks reported by the parent passed **254 tests in 32
  files**, lint, TypeScript, Next type generation, and webpack production build.
- Final source `f6be6cd` checks reported by the parent: **277 tests in 34 files**,
  lint, TypeScript, and webpack production build passed. This worker's focused
  follow-up checks also passed: 21 payment-link/refund-copy tests and five
  Settings dashboard-link tests, including signed-out, wrong-owner,
  wrong-environment, and missing-account cases.
- No build was run by this subtask, to avoid conflict with the deployment work.
- The initial phase changed only this report; the subsequent user-approved
  local corrections are listed above. No credentials, environment settings,
  Git branches, or remote data were changed by this subtask. Deployment is
  coordinated by the parent task.

## Final refund-concurrency follow-up

Source `7425b18` fixes a final hosted-QA finding: Stripe had accepted a refund,
but overlapping webhook/route synchronization exhausted immediate retries and
returned a misleading 502 to the director. Refund synchronization now uses
bounded backoff with fresh snapshots, and an accepted refund with delayed
local synchronization returns 202 `synchronizing`, not a false failure or a
false completed status. Actual failed/canceled and action-required outcomes
remain distinct. An open order modal now derives its selected order from the
refreshed server results instead of retaining stale totals and controls.

The parent ran the complete suite after this correction: **295 tests across
35 files**, ESLint, TypeScript, and the webpack production build passed.
Independent source review found no blocker. Hosted rollout and the exact
recovered event are recorded in the payment-readiness report; the forced
contention/202 behavior is covered by automated regressions, not claimed as a
second hosted purchase. No additional live or Sandbox payment was submitted.

## Limits on a readiness claim

Passing public-page, validation, unit, and static checks is useful evidence, not
a “100%” guarantee. Final launch readiness also requires the actual production
deployment and checkout switch, a live connected director with charges/payouts
enabled, correct connected-account webhook delivery, buyer-fee settlement,
receipt delivery, refunds and pass invalidation, and payout eligibility. A
genuine authorized pilot admission purchase provides the remaining live
end-to-end evidence; do not fabricate a live purchase or refund for testing.
Any genuine live refund requires its own legitimate purpose and authorization.
Until those real outcomes occur, distinguish verified Sandbox behavior and
configuration from unproven live settlement and payout behavior.
