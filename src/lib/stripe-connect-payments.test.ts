import { describe, expect, it } from "vitest";
import {
  assertStripeEventMatchesAppEnvironment,
  assertStripeRoutingMatches,
  calculatePlatformFeeCents,
  calculateOrderPlatformFeeCents,
  getApplicationFeeRefundTargetCents,
  getPlatformFeeConfiguration,
  getStripeDashboardPaymentUrl,
  getStripeEnvironment,
  getStripeRequestOptions,
  isCurrentStripeEnvironment,
  isPaidStripeRefundAmountCents,
  TIERED_PLATFORM_FEE_CONFIGURATION,
} from "./stripe-connect-payments";

describe("per-ticket pricing", () => {
  const configuration = TIERED_PLATFORM_FEE_CONFIGURATION;

  it.each([
    [0, 0], [1, 100], [500, 100], [999, 100], [1000, 100],
    [1001, 140], [1012, 140], [1013, 141], [1500, 160], [2000, 180], [2500, 200],
  ])("charges the correct fee for a %i-cent ticket", (price, fee) => {
    expect(calculatePlatformFeeCents(price, configuration)).toBe(fee);
  });

  it("selects the tier per ticket, never from the cart subtotal", () => {
    expect(calculateOrderPlatformFeeCents([
      { quantity: 2, unit_amount_cents: 1000 },
      { quantity: 1, unit_amount_cents: 2000 },
      { quantity: 3, unit_amount_cents: 0 },
    ], configuration)).toBe(380);
    expect(calculateOrderPlatformFeeCents([{ quantity: 2, unit_amount_cents: 500 }], configuration)).toBe(200);
    expect(calculateOrderPlatformFeeCents([{ quantity: 1, unit_amount_cents: 1000 }], configuration)).toBe(100);
  });

  it("rounds each pass once before applying quantity, consistent with individual quotes", () => {
    expect(calculateOrderPlatformFeeCents([{ quantity: 3, unit_amount_cents: 1013 }], configuration)).toBe(423);
    expect(calculateOrderPlatformFeeCents([{ quantity: 0, unit_amount_cents: 2000 }], configuration)).toBe(0);
    expect(calculateOrderPlatformFeeCents([], configuration)).toBe(0);
  });

  it("matches the 1,000-spectator tournament example", () => {
    expect(calculateOrderPlatformFeeCents([
      { quantity: 800, unit_amount_cents: 2000 },
      { quantity: 200, unit_amount_cents: 1500 },
    ], configuration)).toBe(176000);
  });

  it("preserves explicitly historical order-based calculations", () => {
    expect(calculateOrderPlatformFeeCents([
      { quantity: 2, unit_amount_cents: 1000 },
      { quantity: 1, unit_amount_cents: 2000 },
    ], { basisPoints: 200, fixedCents: 30 })).toBe(110);
  });

  it("loads the new policy explicitly and rejects invalid money or configuration", () => {
    expect(getPlatformFeeConfiguration({ TOURNIBASE_PLATFORM_FEE_POLICY: "per_ticket_v2",
      TOURNIBASE_PLATFORM_FEE_BPS: "400", TOURNIBASE_PLATFORM_FEE_FIXED_CENTS: "100" })).toEqual(configuration);
    expect(() => getPlatformFeeConfiguration({ TOURNIBASE_PLATFORM_FEE_POLICY: "unknown" })).toThrow("TOURNIBASE_PLATFORM_FEE_POLICY");
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateOrderPlatformFeeCents([{ quantity: bad, unit_amount_cents: 1000 }], configuration)).toThrow();
      expect(() => calculateOrderPlatformFeeCents([{ quantity: 1, unit_amount_cents: bad }], configuration)).toThrow();
    }
    expect(() => calculateOrderPlatformFeeCents([{ quantity: 2, unit_amount_cents: Number.MAX_SAFE_INTEGER }], configuration)).toThrow("exceeds");
  });
});

describe("Stripe Connect payment helpers", () => {
  it("defaults platform fees to zero", () => {
    expect(getPlatformFeeConfiguration({})).toEqual({
      basisPoints: 0,
      fixedCents: 0,
    });
    expect(
      calculatePlatformFeeCents(2500, { basisPoints: 0, fixedCents: 0 }),
    ).toBe(0);
  });

  it("calculates percentage and fixed fees in cents", () => {
    expect(
      calculatePlatformFeeCents(10_00, {
        basisPoints: 250,
        fixedCents: 30,
      }),
    ).toBe(55);
    expect(
      calculatePlatformFeeCents(19_99, {
        basisPoints: 100,
        fixedCents: 0,
      }),
    ).toBe(20);
  });

  it("allows an added fee to equal the ticket subtotal and keeps free orders free", () => {
    expect(
      calculatePlatformFeeCents(100, {
        basisPoints: 0,
        fixedCents: 100,
      }),
    ).toBe(100);
    expect(
      calculatePlatformFeeCents(0, {
        basisPoints: 100,
        fixedCents: 30,
      }),
    ).toBe(0);
    expect(() =>
      getPlatformFeeConfiguration({
        TOURNIBASE_PLATFORM_FEE_BPS: "-1",
      }),
    ).toThrow("nonnegative whole number");
  });

  it("routes connected calls while leaving legacy calls on the platform", () => {
    expect(
      getStripeRequestOptions(
        {
          connectedAccountId: "acct_director",
          environment: "test",
        },
        "checkout-1",
      ),
    ).toEqual({
      idempotencyKey: "checkout-1",
      stripeAccount: "acct_director",
    });
    expect(
      getStripeRequestOptions({
        connectedAccountId: null,
        environment: "test",
      }),
    ).toEqual({});
  });

  it("rejects webhook account or mode mismatches", () => {
    const routing = {
      connectedAccountId: "acct_expected",
      environment: "test" as const,
    };

    expect(() =>
      assertStripeRoutingMatches({
        actualEnvironment: "test",
        eventConnectedAccountId: "acct_expected",
        routing,
      }),
    ).not.toThrow();
    expect(() =>
      assertStripeRoutingMatches({
        eventConnectedAccountId: "acct_other",
        routing,
      }),
    ).toThrow("event account");
    expect(() =>
      assertStripeRoutingMatches({
        actualEnvironment: "live",
        routing,
      }),
    ).toThrow("event mode");
  });

  it("rejects Stripe events delivered to the wrong app environment", () => {
    expect(assertStripeEventMatchesAppEnvironment(false, "sk_test_secret")).toBe(
      "test",
    );
    expect(assertStripeEventMatchesAppEnvironment(true, "sk_live_secret")).toBe(
      "live",
    );
    expect(() =>
      assertStripeEventMatchesAppEnvironment(true, "sk_test_secret"),
    ).toThrow("delivered to the test TourniBase environment");
  });

  it("builds connected-account dashboard payment links", () => {
    expect(
      getStripeDashboardPaymentUrl({
        connectedAccountId: "acct_123",
        environment: "test",
        paymentIntentId: "pi_123",
      }),
    ).toBe("https://dashboard.stripe.com/acct_123/test/payments/pi_123");
    expect(
      getStripeDashboardPaymentUrl({
        connectedAccountId: "acct_123",
        environment: "live",
        paymentIntentId: "pi_123",
      }),
    ).toBe("https://dashboard.stripe.com/acct_123/payments/pi_123");
    expect(getStripeEnvironment("sk_live_secret")).toBe("live");
    expect(getStripeEnvironment("sk_test_secret")).toBe("test");
  });

  it("keeps historical Stripe environments read-only", () => {
    expect(isCurrentStripeEnvironment("test", "sk_test_secret")).toBe(true);
    expect(isCurrentStripeEnvironment("live", "sk_test_secret")).toBe(false);
    expect(isCurrentStripeEnvironment("live", "sk_live_secret")).toBe(true);
  });

  it("rejects free passes before a Stripe refund can be attempted", () => {
    expect(isPaidStripeRefundAmountCents(0)).toBe(false);
    expect(isPaidStripeRefundAmountCents(-1)).toBe(false);
    expect(isPaidStripeRefundAmountCents(1500)).toBe(true);
  });

  it("calculates cumulative application-fee refund targets", () => {
    expect(
      getApplicationFeeRefundTargetCents({
        applicationFeeCents: 250,
        chargeAmountCents: 10_00,
        chargeAmountRefundedCents: 4_00,
      }),
    ).toBe(100);
    expect(
      getApplicationFeeRefundTargetCents({
        applicationFeeCents: 250,
        chargeAmountCents: 10_00,
        chargeAmountRefundedCents: 10_00,
      }),
    ).toBe(250);
    expect(() =>
      getApplicationFeeRefundTargetCents({
        applicationFeeCents: 250,
        chargeAmountCents: 10_00,
        chargeAmountRefundedCents: 10_01,
      }),
    ).toThrow("cannot exceed");
  });
});
