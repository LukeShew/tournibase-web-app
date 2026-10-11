import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/order-confirmation", () => ({ attemptOrderConfirmationEmail: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getVerifiedStripe: () => stripe }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from }) }));

import { fulfillCheckoutSession, syncStripeChargeRefund } from "./orders";

type Row = Record<string, unknown>;
let order: Row;
let passes: Row[];
let refunded: number;
let refundPassIds: number[];
let afterUpsert: (() => void) | undefined;
const stripe = {
  checkout: { sessions: { retrieve: vi.fn(async () => ({
    payment_status: "paid", livemode: false, payment_intent: "pi_test", metadata: { order_id: "1" },
  })) } },
  paymentIntents: { retrieve: vi.fn(async () => ({
    id: "pi_test", latest_charge: "ch_test", livemode: false, metadata: { order_id: "1" },
  })) },
  charges: { retrieve: vi.fn(async () => ({
    id: "ch_test", amount: 2000, amount_refunded: refunded, livemode: false,
    payment_intent: "pi_test", metadata: { order_id: "1" }, application_fee: null,
  })) },
  refunds: { list: vi.fn(async () => ({ data: refundPassIds.map(id => ({
    status: "succeeded", metadata: { pass_id: String(id) },
  })) })) },
};

// Small in-memory query double. It applies update filters and unique pass keys,
// so retries cannot accidentally revive refunded passes or reset refund totals.
function from(table: string) {
  let changes: Row | undefined;
  const filters: Array<(row: Row) => boolean> = [];
  function rows() {
    return (table === "orders" ? [order] : table === "passes" ? passes : [{
      id: 10, order_id: 1, quantity: 2, ticket_name: "Weekend", ticket_type_id: 3,
      valid_from: "2026-10-10", valid_until: "2026-10-11",
    }]).filter(row => filters.every(filter => filter(row)));
  }
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      if (!key.includes(".")) filters.push(row => row[key] === value);
      return query;
    },
    is: (key: string, value: unknown) => query.eq(key, value),
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
    update: (value: Row) => { changes = value; return query; },
    order: () => query,
    maybeSingle: async () => ({ data: rows()[0] ? structuredClone(rows()[0]) : null, error: null }),
    upsert: async (values: Row[], options: { ignoreDuplicates: boolean; onConflict: string }) => {
      expect(options).toEqual({ ignoreDuplicates: true, onConflict: "order_item_id,sequence_number" });
      for (const value of values) {
        if (!passes.some(pass => pass.order_item_id === value.order_item_id && pass.sequence_number === value.sequence_number)) {
          passes.push({ ...value, id: passes.length + 1 });
        }
      }
      afterUpsert?.();
      return { error: null };
    },
    then: (resolve: (result: { data: Row[]; error: null }) => unknown) => {
      const data = rows();
      if (changes) data.forEach(row => Object.assign(row, changes));
      return Promise.resolve(resolve({ data, error: null }));
    },
  };
  return query;
}

beforeEach(() => {
  vi.stubEnv("TOURNIBASE_APP_ENVIRONMENT", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.clearAllMocks();
  order = {
    id: 1, tournament_id: 2, buyer_name: "Test", amount_total: "20.00", amount_refunded: "0.00",
    payment_status: "pending", platform_fee_amount: "0.00", platform_fee_refunded: "0.00",
    stripe_checkout_id: "cs_test", stripe_charge_id: null, stripe_payment_intent_id: null,
    stripe_connected_account_id: "acct_test", stripe_environment: "test",
    tournaments: { organizations: { operating_environment: "test" } },
  };
  passes = [];
  refunded = 0;
  refundPassIds = [];
  afterUpsert = undefined;
});

afterEach(() => vi.unstubAllEnvs());

describe("checkout fulfillment and out-of-order refunds", () => {
  it("creates passes after a partial refund arrives before payment confirmation", async () => {
    refunded = 500;
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order.payment_status).toBe("partial_refund");
    expect(passes).toHaveLength(0);
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    expect(passes).toHaveLength(2);
    expect(order.payment_status).toBe("partial_refund");
    expect(order.amount_refunded).toBe("5.00");
  });

  it("does not duplicate tickets or revive an individually refunded pass on retries", async () => {
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 1000;
    refundPassIds = [1];
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    expect(passes.map(pass => pass.status)).toEqual(["refunded", "active"]);
    expect(order.payment_status).toBe("partial_refund");
  });

  it("creates no admission passes for an already fully refunded order", async () => {
    refunded = 2000;
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    expect(passes).toHaveLength(0);
    expect(order.payment_status).toBe("refunded");
  });

  it("blocks passes if a full refund occurs during fulfillment", async () => {
    afterUpsert = () => { refunded = 2000; };
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    expect(passes.map(pass => pass.status)).toEqual(["refunded", "refunded"]);
    expect(order.payment_status).toBe("refunded");
  });

  it("retries reconciliation after a transient Stripe error without duplicating passes", async () => {
    stripe.charges.retrieve.mockRejectedValueOnce(new Error("temporary Stripe failure"));
    await expect(fulfillCheckoutSession("cs_test", "acct_test", "test")).rejects.toThrow("temporary Stripe failure");
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    expect(passes).toHaveLength(2);
  });

  it("rejects payment events belonging to a different director", async () => {
    await expect(fulfillCheckoutSession("cs_test", "acct_other", "test")).rejects.toThrow();
    expect(passes).toHaveLength(0);
  });
});
