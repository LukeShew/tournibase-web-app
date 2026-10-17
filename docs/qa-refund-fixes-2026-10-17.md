# Refund and layout corrections — October 17, 2026

## Scope and deployment status

This follows the failures reproduced in [hosted staging QA](qa-staging-2026-10-17.md).
The source fixes are local, shared by staging and production. No push, deployment,
production payment, database mutation, or customer email is part of this follow-up.
Live paid checkout must remain disabled until deployment and transaction checks
are complete. Never report the earlier failed hosted refunds as passed.

## Corrections

- Pass refund queries select explicit foreign-key relationships, preserving
  organization ownership and environment filters. Database lookup failures return
  a retryable 503 rather than a misleading missing-pass 404.
- Full and pass-specific refunds omit application-fee reversal when the stored
  order fee is zero. Nonzero fees still request Stripe's proportional reversal.
- Corrected zero-fee retries use a stable versioned key. Before creating a refund,
  all pages of existing Stripe refunds are checked for matching order/pass
  metadata, so a successful Stripe refund followed by failed local synchronization
  is reused instead of charged back a second time.
- Pending/action-required refunds keep the order dialog open with a clear notice
  instead of claiming completion. Reconciliation also reads every refund page.
  Conditional compare-and-swap updates preserve newer refunded amounts, refunded
  application fees, and fully refunded status when requests overlap; bounded
  contention failures ask for a retry rather than silently losing an update.
- Initial receipts accept partially refunded orders, contain only remaining
  active/checked-in pass links, and explain the original payment, refunded amount,
  and amount after refunds in HTML and plain text. Full refunds and unpaid orders
  remain blocked, and original fulfillment completeness/idempotency checks remain.
- The shared revenue card no longer imposes `height: 100%` on stacked layouts.
  The Orders grid retains its existing equal-height stretch behavior.

## Verification

- Final combined regression run: **173 tests across 20 files passed**; lint,
  optimized production build, standalone typecheck, and diff checks passed.
  The final build required clearing generated Next caches and allowing its local
  CSS worker outside the restricted sandbox. No source/config change was needed
  for that local build-permission failure.
- Read-only Supabase inspection confirmed all four named relationships exist and
  match the corrected route joins. Order 1957 remains test/paid with $0 refunded;
  pass 4788 remains active. Local admin credentials were unavailable, so this
  follow-up did not run a direct authenticated PostgREST request.
- Local browser layout checks at 320, 375, 768, 1218, and 1440px found no horizontal
  overflow or intersecting overview cards. Below the desktop split, stacked cards
  kept 24px gaps. At 1440px, both Orders panels shared top/bottom edges.
- The actual local homepage was checked at 375, 1218, and 1440px without overflow.
- Dashboard visual checks used the actual shared components with source-identical
  page containers and synthetic fixture metrics, not an authenticated hosted page.
  The temporary development-only route and server were removed afterward.
- No camera access or claim of optical QR verification.

## Live Stripe handoff

Use the **TourniBase live platform** `acct_1Tal4GBdjbPEH1El`, not its Sandbox or a
director's connected account. Keep `TOURNIBASE_PAID_CHECKOUT_ENABLED=false`.

1. In Stripe's live API-key page, copy the platform API keys directly into Vercel
   project `tournibase-web-app`, scoped to **Production only**:
   - `STRIPE_SECRET_KEY` — Sensitive; never expose in frontend code, chat, or Git.
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — publishable, not secret.
2. Create **TourniBase live connected-account payments**:
   - URL: `https://tournibase.com/api/stripe/webhook`
   - Source: **Connected accounts** (`@accounts`), **Snapshot** payloads.
   - Snapshot API version matching the installed SDK: `2026-07-29.dahlia`.
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
   - Save its signing secret to `STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET` as a
     Sensitive Production-only Vercel variable.
3. Create **TourniBase live account status**:
   - URL: `https://tournibase.com/api/stripe/connect/webhook`
   - Source: **Your account** (`@self`), **Thin** payloads.
   - Use the eight Accounts v2 event types listed in
     [Webhook destinations](environment-rollout.md#webhook-destinations).
   - Save its separate signing secret to `STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET`
     as a Sensitive Production-only Vercel variable.
4. Review the existing legacy `@self` payment endpoint before disabling it; do not
   mistake its name/URL for a correctly scoped connected-account endpoint.
5. After the user authorizes pushing the same application commit to `main` and
   `staging`, verify both deployments. Repeat hosted Sandbox partial/full refunds,
   refund email delivery, and refunded-pass rejection.
6. Complete live director onboarding, verify card/payout readiness and allowed
   payment methods, then schedule the user-approved controlled real-money test.
   Verify the live 2% + 30-cent fee and reversal before leaving checkout enabled.

The Stripe connector allowed account/destination inspection but refused webhook
creation for missing permissions/scopes even after requesting reauthentication.
This is a Codex connector limitation, not evidence that the director account or
API keys expired. The Vercel connector also lacked team access; its authenticated
CLI could list variable metadata. No secrets were read or printed. Until connector
access is repaired, use the dashboards for secret installation rather than pasting
credentials into chat.
