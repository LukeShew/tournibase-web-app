import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-environment", () => ({
  assertStripeKeysMatchAppEnvironment: vi.fn(),
  assertStripePlatformAccountIdMatches: vi.fn(),
  requireExpectedStripePlatformAccountId: vi.fn(() => "acct_expected"),
}));

import { getStripePaymentWebhookSecret } from "./stripe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Stripe payment webhook configuration", () => {
  it("accepts only the connected-account destination secret", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_old_test_mode");

    expect(getStripePaymentWebhookSecret()).toBeNull();

    vi.stubEnv(
      "STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET",
      "  whsec_connected_account  ",
    );

    expect(getStripePaymentWebhookSecret()).toBe("whsec_connected_account");
  });
});
