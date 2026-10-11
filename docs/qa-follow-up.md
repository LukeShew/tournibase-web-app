# QA follow-up — October 10, 2026

## Fixed locally

- Next.js and its ESLint configuration upgraded to 16.3.8; Vitest to 4.1.11.
  Vulnerable transitive packages updated in the lockfile.
- Production dependency audit: zero reported vulnerabilities.
- Checkout fulfillment no longer assumes a partially refunded order already has
  passes. Idempotent upsert preserves existing pass statuses, conditional payment
  updates preserve refund totals/status, and a final Stripe refund reconciliation
  handles refunds received during fulfillment. External partial refunds without
  pass metadata retain the existing policy: adjust totals, not arbitrary passes.
- Six isolated regression tests cover early partial refunds, repeated delivery,
  individual refunded passes, full refunds, reconciliation failure/retry, and
  incorrect connected-account routing. No Stripe or database calls are made.
- Mobile navigation wraps as a group; the revenue total participates in normal
  layout instead of overlapping the title. Equal label heights keep bars aligned.

## Remaining dependency limitation

The full audit still reports five high-severity dependency-chain entries for one
unpatched development-tool issue, GHSA-vfj7-8cjw-p6xm:
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
`braces` 3.0.3 is currently the latest release and has no patched version.
This is lint-time pattern processing, not a deployed request handler. Keep lint
enabled. Do not use `npm audit fix --force`: its suggested Next ESLint downgrade
to 14.2.35 is not an appropriate fix for this Next 16 app. Recheck upstream for a
compatible patched release. Do not process untrusted lint/glob configuration.

## Verification and limits

Lint, 77 tests, clean production build, and standalone typecheck passed. Old
generated `.next` files were cleared before the clean build.

Supabase remains intentionally paused. No project reactivation, migration,
payment, email, real scan, or production-data change was performed. Signed-in
and end-to-end transaction checks remain pending until the backend is restored.
Ship the exact same application commit to `main` and `staging`; environment
configuration continues to distinguish their data and payment behavior.
