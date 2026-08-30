import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertDeploymentTargetMatchesAppEnvironment,
  assertEmailEnvironmentConfiguration,
  assertPlatformFeeEnvironmentConfiguration,
  assertRequestHostMatchesAppEnvironment,
  assertStripePlatformAccountIdMatches,
  assertStripeKeysMatchAppEnvironment,
  assertSupabaseEnvironmentConfiguration,
  getAppEnvironment,
  getExpectedStripePlatformAccountId,
  isOfflinePassImageOptimizationSource,
  getPublicSignupHref,
  getRequestHostname,
  getStripeEnvironmentFromKey,
  isDirectorLoginEmailAllowed,
  isPaidCheckoutEnabled,
  isPublicSignupEnabled,
  requireExpectedStripePlatformAccountId,
  scopeToAppEnvironment,
  TEST_EMAIL_RECIPIENT,
  TEST_SITE_URL,
  TOURNIBASE_SUPABASE_URL,
  validateAppRuntimeConfiguration,
} from "./app-environment";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TourniBase application environment", () => {
  it("requires an explicit environment and checkout flag on Vercel", () => {
    expect(() => getAppEnvironment({ VERCEL: "1" })).toThrow(
      "TOURNIBASE_APP_ENVIRONMENT",
    );
    expect(() =>
      isPaidCheckoutEnabled({
        VERCEL: "1",
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toThrow("TOURNIBASE_PAID_CHECKOUT_ENABLED");
  });

  it("keeps local development ergonomic while accepting explicit values", () => {
    expect(getAppEnvironment({})).toBe("test");
    expect(
      getAppEnvironment({ STRIPE_SECRET_KEY: "sk_live_local" }),
    ).toBe("live");
    expect(
      isPaidCheckoutEnabled({ TOURNIBASE_PAID_CHECKOUT_ENABLED: "false" }),
    ).toBe(false);
  });

  it("recognizes only supported Stripe key prefixes", () => {
    expect(getStripeEnvironmentFromKey("sk_test_secret")).toBe("test");
    expect(getStripeEnvironmentFromKey("pk_live_public")).toBe("live");
    expect(getStripeEnvironmentFromKey("rk_live_restricted")).toBeNull();
  });

  it("rejects Stripe keys from the opposite environment", () => {
    expect(() =>
      assertStripeKeysMatchAppEnvironment({
        TOURNIBASE_APP_ENVIRONMENT: "live",
        STRIPE_SECRET_KEY: "sk_test_secret",
      }),
    ).toThrow("configured for live");
    expect(() =>
      assertStripeKeysMatchAppEnvironment({
        TOURNIBASE_APP_ENVIRONMENT: "test",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_public",
      }),
    ).toThrow("configured for test");
  });

  it("keeps hosted live and test URLs on their intended Vercel targets", () => {
    expect(
      assertDeploymentTargetMatchesAppEnvironment({
        NEXT_PUBLIC_SITE_URL: "https://tournibase.com",
        TOURNIBASE_APP_ENVIRONMENT: "live",
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toBe("live");
    expect(
      assertDeploymentTargetMatchesAppEnvironment({
        NEXT_PUBLIC_SITE_URL: TEST_SITE_URL,
        TOURNIBASE_APP_ENVIRONMENT: "test",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "staging",
      }),
    ).toBe("test");
    expect(() =>
      assertDeploymentTargetMatchesAppEnvironment({
        NEXT_PUBLIC_SITE_URL: "https://tournibase.com",
        TOURNIBASE_APP_ENVIRONMENT: "test",
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toThrow();
    expect(() =>
      assertDeploymentTargetMatchesAppEnvironment({
        NEXT_PUBLIC_SITE_URL: TEST_SITE_URL,
        TOURNIBASE_APP_ENVIRONMENT: "live",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "staging",
      }),
    ).toThrow();
    expect(() =>
      assertDeploymentTargetMatchesAppEnvironment({
        NEXT_PUBLIC_SITE_URL: TEST_SITE_URL,
        TOURNIBASE_APP_ENVIRONMENT: "test",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feature-branch",
      }),
    ).toThrow("staging branch");
    expect(() =>
      assertDeploymentTargetMatchesAppEnvironment({
        NEXT_PUBLIC_SITE_URL: TEST_SITE_URL,
        TOURNIBASE_APP_ENVIRONMENT: "test",
        VERCEL: "1",
        VERCEL_ENV: "development",
        VERCEL_GIT_COMMIT_REF: "staging",
      }),
    ).toThrow("Vercel Preview");
  });

  it("rejects a stable hostname attached to the opposite environment", () => {
    expect(() =>
      assertRequestHostMatchesAppEnvironment("tournibase.com", {
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toThrow("production hostname");
    expect(() =>
      assertRequestHostMatchesAppEnvironment("www.tournibase.com", {
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toThrow("production hostname");
    expect(() =>
      assertRequestHostMatchesAppEnvironment("staging.tournibase.com", {
        TOURNIBASE_APP_ENVIRONMENT: "live",
      }),
    ).toThrow("staging hostname");
    expect(
      assertRequestHostMatchesAppEnvironment("generated.vercel.app", {
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toBe("test");
  });

  it("uses the forwarded deployment host and removes its port", () => {
    expect(
      getRequestHostname({
        fallbackHostname: "internal.vercel.app",
        forwardedHost: "staging.tournibase.com:443, proxy.internal",
        host: "internal.vercel.app",
      }),
    ).toBe("staging.tournibase.com");
    expect(
      getRequestHostname({
        fallbackHostname: "127.0.0.1",
        host: "tournibase.com:3000",
      }),
    ).toBe("tournibase.com");
  });

  it("identifies protected offline pass images sent through the optimizer", () => {
    expect(
      isOfflinePassImageOptimizationSource("/p/pass-token/offline-pass.png"),
    ).toBe(true);
    expect(
      isOfflinePassImageOptimizationSource(
        "https://staging.tournibase.com/p/pass-token/offline-pass.png?download=1",
      ),
    ).toBe(true);
    expect(
      isOfflinePassImageOptimizationSource(
        "%252Fp%252Fpass-token%252Foffline-pass.png",
      ),
    ).toBe(true);
    expect(
      isOfflinePassImageOptimizationSource("/tournibase-app-icon.svg"),
    ).toBe(false);
  });

  it("requires the fixed test recipient for Resend and forbids it in live", () => {
    expect(() =>
      assertEmailEnvironmentConfiguration({
        EMAIL_PROVIDER: "resend",
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toThrow("TOURNIBASE_EMAIL_OVERRIDE_TO");
    expect(() =>
      assertEmailEnvironmentConfiguration({
        EMAIL_PROVIDER: "resend",
        TOURNIBASE_APP_ENVIRONMENT: "live",
        TOURNIBASE_EMAIL_OVERRIDE_TO: TEST_EMAIL_RECIPIENT,
      }),
    ).toThrow("must not be configured");
  });

  it("requires a fully configured Resend provider when hosted", () => {
    expect(() =>
      assertEmailEnvironmentConfiguration({
        EMAIL_PROVIDER: "disabled",
        TOURNIBASE_APP_ENVIRONMENT: "test",
        VERCEL: "1",
      }),
    ).toThrow("EMAIL_PROVIDER=resend");
    expect(() =>
      assertEmailEnvironmentConfiguration({
        EMAIL_PROVIDER: "resend",
        TOURNIBASE_APP_ENVIRONMENT: "test",
        TOURNIBASE_EMAIL_OVERRIDE_TO: TEST_EMAIL_RECIPIENT,
        VERCEL: "1",
      }),
    ).toThrow("RESEND_API_KEY");
  });

  it("keeps test fees at zero and requires a live fee before checkout", () => {
    expect(
      assertPlatformFeeEnvironmentConfiguration({
        TOURNIBASE_APP_ENVIRONMENT: "test",
        TOURNIBASE_PLATFORM_FEE_BPS: "0",
        TOURNIBASE_PLATFORM_FEE_FIXED_CENTS: "0",
      }),
    ).toEqual({ basisPoints: 0, fixedCents: 0 });
    expect(() =>
      assertPlatformFeeEnvironmentConfiguration({
        TOURNIBASE_APP_ENVIRONMENT: "test",
        TOURNIBASE_PLATFORM_FEE_BPS: "200",
      }),
    ).toThrow("test environment");
    expect(() =>
      assertPlatformFeeEnvironmentConfiguration({
        TOURNIBASE_APP_ENVIRONMENT: "live",
        TOURNIBASE_PAID_CHECKOUT_ENABLED: "true",
        TOURNIBASE_PLATFORM_FEE_BPS: "0",
        TOURNIBASE_PLATFORM_FEE_FIXED_CENTS: "0",
      }),
    ).toThrow("200 basis-point fee plus 30 cents");
    expect(
      assertPlatformFeeEnvironmentConfiguration({
        TOURNIBASE_APP_ENVIRONMENT: "live",
        TOURNIBASE_PAID_CHECKOUT_ENABLED: "true",
        TOURNIBASE_PLATFORM_FEE_BPS: "200",
        TOURNIBASE_PLATFORM_FEE_FIXED_CENTS: "30",
      }),
    ).toEqual({ basisPoints: 200, fixedCents: 30 });
  });

  it("allows signup only in live hosted deployments", () => {
    expect(
      isPublicSignupEnabled({
        VERCEL: "1",
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toBe(false);
    expect(
      isPublicSignupEnabled({
        VERCEL: "1",
        TOURNIBASE_APP_ENVIRONMENT: "live",
      }),
    ).toBe(true);
    expect(isPublicSignupEnabled({})).toBe(true);
    expect(
      getPublicSignupHref({
        VERCEL: "1",
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toBe("https://tournibase.com/signup");
    expect(
      getPublicSignupHref({
        VERCEL: "1",
        TOURNIBASE_APP_ENVIRONMENT: "live",
      }),
    ).toBe("/signup");
  });

  it("allows only the permanent director email on hosted staging", () => {
    expect(
      isDirectorLoginEmailAllowed(TEST_EMAIL_RECIPIENT.toUpperCase(), {
        VERCEL: "1",
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toBe(true);
    expect(
      isDirectorLoginEmailAllowed("another@example.com", {
        VERCEL: "1",
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toBe(false);
    expect(
      isDirectorLoginEmailAllowed("another@example.com", {
        VERCEL: "1",
        TOURNIBASE_APP_ENVIRONMENT: "live",
      }),
    ).toBe(true);
  });

  it("scopes shared infrastructure keys to the app environment", () => {
    expect(
      scopeToAppEnvironment("login:127.0.0.1", {
        TOURNIBASE_APP_ENVIRONMENT: "test",
      }),
    ).toBe("test:login:127.0.0.1");
  });

  it("requires the one approved Supabase project on hosted deployments", () => {
    expect(() =>
      assertSupabaseEnvironmentConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: "https://another-project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SECRET_KEY: "sb_secret_test",
        VERCEL: "1",
      }),
    ).toThrow("shared Supabase project");
    expect(() =>
      assertSupabaseEnvironmentConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: TOURNIBASE_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        VERCEL: "1",
      }),
    ).toThrow("SUPABASE_SECRET_KEY");
    expect(
      assertSupabaseEnvironmentConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: `${TOURNIBASE_SUPABASE_URL}/`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SECRET_KEY: "sb_secret_test",
        VERCEL: "1",
      }),
    ).toBeUndefined();
  });

  it("requires an explicit Stripe platform account on hosted deployments", () => {
    expect(() =>
      getExpectedStripePlatformAccountId({ VERCEL: "1" }),
    ).toThrow("TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID");
    expect(() =>
      getExpectedStripePlatformAccountId({
        TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID: "not-an-account",
      }),
    ).toThrow("Stripe account ID");
    expect(
      getExpectedStripePlatformAccountId({
        TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID: "acct_expected123",
      }),
    ).toBe("acct_expected123");
    expect(() =>
      assertStripePlatformAccountIdMatches("acct_wrong", {
        TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID: "acct_expected123",
      }),
    ).toThrow("not configured platform acct_expected123");
    expect(() => requireExpectedStripePlatformAccountId({})).toThrow(
      "required before Stripe API operations",
    );
    expect(
      requireExpectedStripePlatformAccountId({
        TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID: "acct_expected123",
      }),
    ).toBe("acct_expected123");
  });

  it("validates a complete hosted test configuration", () => {
    expect(
      validateAppRuntimeConfiguration({
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "TourniBase <passes@tournibase.com>",
        NEXT_PUBLIC_SITE_URL: TEST_SITE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        NEXT_PUBLIC_SUPABASE_URL: TOURNIBASE_SUPABASE_URL,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_public",
        STRIPE_SECRET_KEY: "sk_test_secret",
        STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET: "whsec_test_payments",
        STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET: "whsec_test_accounts",
        SUPABASE_SECRET_KEY: "sb_secret_test",
        RESEND_API_KEY: "re_test",
        TOURNIBASE_APP_ENVIRONMENT: "test",
        TOURNIBASE_EMAIL_OVERRIDE_TO: TEST_EMAIL_RECIPIENT,
        TOURNIBASE_PAID_CHECKOUT_ENABLED: "true",
        TOURNIBASE_PLATFORM_FEE_BPS: "0",
        TOURNIBASE_PLATFORM_FEE_FIXED_CENTS: "0",
        TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID: "acct_testplatform",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "staging",
      }),
    ).toEqual({
      appEnvironment: "test",
      emailOverrideTo: TEST_EMAIL_RECIPIENT,
      paidCheckoutEnabled: true,
      platformFee: { basisPoints: 0, fixedCents: 0 },
    });
  });

  it("requires both Stripe webhook destinations before hosted paid checkout", () => {
    expect(() =>
      validateAppRuntimeConfiguration({
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "TourniBase <passes@tournibase.com>",
        NEXT_PUBLIC_SITE_URL: TEST_SITE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        NEXT_PUBLIC_SUPABASE_URL: TOURNIBASE_SUPABASE_URL,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_public",
        STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET: "whsec_test_payments",
        STRIPE_SECRET_KEY: "sk_test_secret",
        SUPABASE_SECRET_KEY: "sb_secret_test",
        RESEND_API_KEY: "re_test",
        TOURNIBASE_APP_ENVIRONMENT: "test",
        TOURNIBASE_EMAIL_OVERRIDE_TO: TEST_EMAIL_RECIPIENT,
        TOURNIBASE_PAID_CHECKOUT_ENABLED: "true",
        TOURNIBASE_PLATFORM_FEE_BPS: "0",
        TOURNIBASE_PLATFORM_FEE_FIXED_CENTS: "0",
        TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID: "acct_testplatform",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "staging",
      }),
    ).toThrow("STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET");
  });

  it("validates the exact hosted live fee and target configuration", () => {
    expect(
      validateAppRuntimeConfiguration({
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "TourniBase <passes@tournibase.com>",
        NEXT_PUBLIC_SITE_URL: "https://tournibase.com",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_live",
        NEXT_PUBLIC_SUPABASE_URL: TOURNIBASE_SUPABASE_URL,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_public",
        STRIPE_SECRET_KEY: "sk_live_secret",
        STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET: "whsec_live_payments",
        STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET: "whsec_live_accounts",
        SUPABASE_SECRET_KEY: "sb_secret_live",
        RESEND_API_KEY: "re_live",
        TOURNIBASE_APP_ENVIRONMENT: "live",
        TOURNIBASE_PAID_CHECKOUT_ENABLED: "false",
        TOURNIBASE_PLATFORM_FEE_BPS: "200",
        TOURNIBASE_PLATFORM_FEE_FIXED_CENTS: "30",
        TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID: "acct_liveplatform",
        VERCEL: "1",
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toEqual({
      appEnvironment: "live",
      emailOverrideTo: null,
      paidCheckoutEnabled: false,
      platformFee: { basisPoints: 200, fixedCents: 30 },
    });
  });
});
