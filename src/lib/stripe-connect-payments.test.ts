import { describe, expect, it } from "vitest";
import {
  assertStripeRoutingMatches,
  calculatePlatformFeeCents,
  getApplicationFeeRefundTargetCents,
  getPlatformFeeConfiguration,
  getStripeDashboardPaymentUrl,
  getStripeEnvironment,
  getStripeRequestOptions,
  isCurrentStripeEnvironment,
  isPaidStripeRefundAmountCents,
} from "./stripe-connect-payments";

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

  it("rejects invalid or total-consuming fees", () => {
    expect(() =>
      calculatePlatformFeeCents(100, {
        basisPoints: 0,
        fixedCents: 100,
      }),
    ).toThrow("less than the order total");
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

  it("builds connected-account dashboard payment links", () => {
    expect(
      getStripeDashboardPaymentUrl({
        connectedAccountId: "acct_123",
        environment: "test",
        paymentIntentId: "pi_123",
      }),
    ).toBe("https://dashboard.stripe.com/test/acct_123/payments/pi_123");
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
