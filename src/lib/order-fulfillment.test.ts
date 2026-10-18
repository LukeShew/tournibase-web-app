import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/order-confirmation", () => ({ attemptOrderConfirmationEmail: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getVerifiedStripe: () => stripe }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from }) }));

import { fulfillCheckoutSession, syncStripeChargeRefund } from "./orders";

type Row = Record<string, unknown>;
let order: Row;
let passes: Row[];
let orderItems: Row[];
let refunded: number;
let chargeAmount: number;
let applicationFeeId: string | null;
let applicationFeeAmount: number;
let applicationFeeRefunded: number;
let refundPassIds: number[];
let leadingRefunds: Array<{ id?: string; amount?: number; status: string; metadata: Record<string, string> }>;
let afterUpsert: (() => void) | undefined;
let beforeRefundUpdate: (() => void) | undefined;
let refundUpdateAttempts: number;
const stripe = {
  checkout: { sessions: { retrieve: vi.fn(async () => ({
    payment_status: "paid", livemode: false, payment_intent: "pi_test", metadata: { order_id: "1" },
  })) } },
  paymentIntents: { retrieve: vi.fn(async () => ({
    id: "pi_test", latest_charge: "ch_test", livemode: false, metadata: { order_id: "1" },
  })) },
  charges: { retrieve: vi.fn(async () => ({
    id: "ch_test", amount: chargeAmount, amount_refunded: refunded, livemode: false,
    payment_intent: "pi_test", metadata: { order_id: "1" }, application_fee: applicationFeeId,
  })) },
  applicationFees: {
    retrieve: vi.fn(async () => ({ id: applicationFeeId, amount: applicationFeeAmount, amount_refunded: applicationFeeRefunded })),
    createRefund: vi.fn(async (_id: string, params: { amount: number }, options: { idempotencyKey: string }) => {
      expect(options.idempotencyKey).toBeTruthy();
      applicationFeeRefunded += params.amount;
      return { id: "fr_test", amount: params.amount };
    }),
  },
  refunds: { list: vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      const snapshots = leadingRefunds.map((refund, index) => ({ id: `re_leading_${index}`, amount: 0, ...refund }));
      yield* snapshots;
      const specifiedAmount = snapshots.filter((refund) => ["succeeded", "pending", "requires_action"].includes(refund.status))
        .reduce((sum, refund) => sum + refund.amount, 0);
      const unallocated = Math.max(0, refunded - specifiedAmount);
      const passIds = [...new Set(refundPassIds)];
      for (const id of passIds) {
        yield { id: `re_pass_${id}`, amount: unallocated / passIds.length, status: "succeeded", metadata: { pass_id: String(id) } };
      }
      if (!passIds.length && unallocated > 0) {
        yield { id: "re_external", amount: unallocated, status: "succeeded", metadata: {} };
      }
    },
  })) },
};

// Small in-memory query double. It applies update filters and unique pass keys,
// so retries cannot accidentally revive refunded passes or reset refund totals.
function from(table: string) {
  let changes: Row | undefined;
  const filters: Array<(row: Row) => boolean> = [];
  function rows() {
    return (table === "orders" ? [order] : table === "passes" ? passes : orderItems)
      .filter(row => filters.every(filter => filter(row)));
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
    maybeSingle: async () => {
      if (table === "orders" && changes?.amount_refunded !== undefined) {
        refundUpdateAttempts += 1;
        beforeRefundUpdate?.();
      }
      const data = rows();
      if (changes) data.forEach(row => Object.assign(row, changes));
      return { data: data[0] ? structuredClone(data[0]) : null, error: null };
    },
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
    buyer_fee_amount: "0.00", buyer_fee_refunded: "0.00",
    refund_pending_amount: "0.00", refund_failed_amount: "0.00", refund_sync_version: 0,
    stripe_checkout_id: "cs_test", stripe_charge_id: null, stripe_payment_intent_id: null,
    stripe_connected_account_id: "acct_test", stripe_environment: "test",
    tournaments: { organizations: { operating_environment: "test" } },
  };
  passes = [];
  orderItems = [{ id: 10, order_id: 1, quantity: 2, unit_amount_cents: 1000,
    ticket_name: "Weekend", ticket_type_id: 3, valid_from: "2026-10-10", valid_until: "2026-10-11" }];
  refunded = 0;
  chargeAmount = 2000;
  applicationFeeId = null;
  applicationFeeAmount = 0;
  applicationFeeRefunded = 0;
  refundPassIds = [];
  leadingRefunds = [];
  afterUpsert = undefined;
  beforeRefundUpdate = undefined;
  refundUpdateAttempts = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("checkout fulfillment and out-of-order refunds", () => {
  it("records a pending refund without claiming success or invalidating a pass, then completes it", async () => {
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 1000;
    leadingRefunds = [{ id: "re_pending", amount: 1000, status: "pending", metadata: { pass_id: "1" } }];
    expect(await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test"))
      .toEqual({ status: "not_refunded" });
    expect(order).toMatchObject({ amount_refunded: "0.00", refund_pending_amount: "10.00", payment_status: "paid" });
    expect(passes.map(pass => pass.status)).toEqual(["active", "active"]);
    leadingRefunds[0].status = "succeeded";
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order).toMatchObject({ amount_refunded: "10.00", refund_pending_amount: "0.00", payment_status: "partial_refund" });
    expect(passes.map(pass => pass.status)).toEqual(["refunded", "active"]);
  });

  it("corrects a successful refund that later fails without reopening canceled passes", async () => {
    Object.assign(order, { amount_total: "20.70", buyer_fee_amount: "0.70", platform_fee_amount: "0.70" });
    chargeAmount = 2070;
    applicationFeeId = "fee_buyer";
    applicationFeeAmount = 70;
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 2070;
    leadingRefunds = [{ id: "re_failed_later", amount: 2070, status: "succeeded", metadata: {} }];
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order.payment_status).toBe("refunded");
    leadingRefunds[0].status = "failed";
    refunded = 0;
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order).toMatchObject({ payment_status: "paid", amount_refunded: "0.00", buyer_fee_refunded: "0.00",
      refund_failed_amount: "20.70", platform_fee_refunded: "0.70" });
    expect(passes.map(pass => pass.status)).toEqual(["refunded", "refunded"]);
    expect(stripe.applicationFees.createRefund).toHaveBeenCalledOnce();
  });

  it("re-reads Stripe after a failure correction wins the write race", async () => {
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 2000;
    leadingRefunds = [{ id: "re_later_failed", amount: 2000, status: "succeeded", metadata: {} }];
    beforeRefundUpdate = () => {
      beforeRefundUpdate = undefined;
      leadingRefunds[0].status = "failed";
      refunded = 0;
      Object.assign(order, { refund_sync_version: 1, refund_failed_amount: "20.00" });
    };
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order).toMatchObject({ payment_status: "paid", amount_refunded: "0.00", refund_failed_amount: "20.00", refund_sync_version: 2 });
    expect(refundUpdateAttempts).toBe(2);
  });
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

  it("reconciles older pass metadata beyond the first 100 refunds and ignores unfinished refunds", async () => {
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 1000;
    leadingRefunds = Array.from({ length: 101 }, () => ({ status: "succeeded", metadata: {} }));
    leadingRefunds.push(
      { status: "pending", metadata: { pass_id: "2" } },
      { status: "requires_action", metadata: { pass_id: "2" } },
      { status: "failed", metadata: { pass_id: "2" } },
      { status: "canceled", metadata: { pass_id: "2" } },
      { status: "succeeded", metadata: { pass_id: "not-a-number" } },
    );
    refundPassIds = [1, 1];
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(passes.map(pass => pass.status)).toEqual(["refunded", "active"]);
    expect(stripe.refunds.list).toHaveBeenCalledWith(
      { charge: "ch_test", limit: 100 }, { stripeAccount: "acct_test" },
    );
  });

  it("does not let an older partial sync overwrite a concurrent full refund", async () => {
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 1000;
    beforeRefundUpdate = () => {
      beforeRefundUpdate = undefined;
      Object.assign(order, { amount_refunded: "20.00", payment_status: "refunded", platform_fee_refunded: "0.70" });
      refunded = 2000;
    };
    const result = await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(result).toMatchObject({ status: "refunded", orderId: 1, amountTotalCents: 2000, amountRefundedCents: 2000, buyerFeeRefundedCents: 0 });
    expect(order).toMatchObject({ amount_refunded: "20.00", payment_status: "refunded", platform_fee_refunded: "0.70" });
    expect(passes.map(pass => pass.status)).toEqual(["refunded", "refunded"]);
    expect(refundUpdateAttempts).toBe(2);
  });

  it("preserves newer partial totals and returns the committed total after losing a write race", async () => {
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 500;
    refundPassIds = [1];
    beforeRefundUpdate = () => {
      beforeRefundUpdate = undefined;
      Object.assign(order, { amount_refunded: "10.00", payment_status: "partial_refund" });
      refunded = 1000;
    };
    const result = await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(result).toMatchObject({ status: "partial_refund", amountRefundedCents: 1000 });
    expect(order.amount_refunded).toBe("10.00");
    expect(passes.map(pass => pass.status)).toEqual(["refunded", "active"]);
    expect(refundUpdateAttempts).toBe(2);
  });

  it("preserves a concurrent fee-only reconciliation without regressing totals", async () => {
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 1000;
    refundPassIds = [1];
    beforeRefundUpdate = () => {
      beforeRefundUpdate = undefined;
      order.platform_fee_refunded = "0.35";
    };
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order).toMatchObject({ amount_refunded: "10.00", payment_status: "partial_refund", platform_fee_refunded: "0.35" });
    expect(refundUpdateAttempts).toBe(2);
  });

  it("throws after bounded contention so a webhook can retry without applying a stale write", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const timer = vi.spyOn(globalThis, "setTimeout");
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 500;
    beforeRefundUpdate = () => {
      order.amount_refunded = (Number(order.amount_refunded) + 1).toFixed(2);
      order.payment_status = "partial_refund";
    };
    const failure = expect(syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test"))
      .rejects.toThrow("Refund synchronization changed concurrently");
    await vi.runAllTimersAsync();
    await failure;
    expect(timer.mock.calls.map((call) => call[1])).toEqual([50, 100, 200, 400]);
    expect(order.amount_refunded).toBe("5.00");
    expect(refundUpdateAttempts).toBe(5);
    expect(passes.map(pass => pass.status)).toEqual(["active", "active"]);
  });

  it("backs off after contention and rereads current Stripe state before a later successful attempt", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const timer = vi.spyOn(globalThis, "setTimeout");
    await fulfillCheckoutSession("cs_test", "acct_test", "test");
    refunded = 500;
    beforeRefundUpdate = () => {
      if (refundUpdateAttempts <= 3) {
        order.refund_sync_version = Number(order.refund_sync_version) + 1;
        // The next attempt must obtain the latest full refund, not reapply the
        // original partial snapshot just because its backoff timer completed.
        refunded = 2000;
      }
    };
    const synchronization = syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    await vi.runAllTimersAsync();
    expect(await synchronization).toMatchObject({ status: "refunded", amountRefundedCents: 2000 });
    expect(timer.mock.calls.map((call) => call[1])).toEqual([63, 125, 250]);
    expect(refundUpdateAttempts).toBe(4);
    expect(passes.map(pass => pass.status)).toEqual(["refunded", "refunded"]);
  });

  it("does not blindly retry unrelated Stripe errors as database contention", async () => {
    vi.useFakeTimers();
    const timer = vi.spyOn(globalThis, "setTimeout");
    stripe.charges.retrieve.mockRejectedValueOnce(new Error("Stripe permission denied"));
    await expect(syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test"))
      .rejects.toThrow("Stripe permission denied");
    expect(timer).not.toHaveBeenCalled();
    expect(stripe.charges.retrieve).toHaveBeenCalledOnce();
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

  it("returns the exact allocated buyer fee to the director and records it once on retries", async () => {
    Object.assign(order, { amount_total: "30.70", buyer_fee_amount: "0.70", platform_fee_amount: "0.70" });
    chargeAmount = 3070;
    applicationFeeId = "fee_buyer";
    applicationFeeAmount = 70;
    orderItems[0].quantity = 3;
    passes = [{ id: 1, order_id: 1, order_item_id: 10, sequence_number: 1, status: "active" }];
    refunded = 1024;
    leadingRefunds = [{ id: "re_buyer", amount: 1024, status: "succeeded", metadata: {
      order_id: "1", pass_id: "1", buyer_fee_policy: "buyer_fee_v1", buyer_fee_refund_cents: "24", ticket_refund_cents: "1000",
    } }];
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order).toMatchObject({ amount_refunded: "10.24", buyer_fee_refunded: "0.24", platform_fee_refunded: "0.24" });
    expect(stripe.applicationFees.createRefund).toHaveBeenCalledOnce();
    expect(stripe.applicationFees.createRefund).toHaveBeenCalledWith("fee_buyer", {
      amount: 24, metadata: { charge_id: "ch_test", order_id: "1", source: "tournibase_refund_sync" },
    }, { idempotencyKey: "tournibase-buyer-fee-refund-fee_buyer-from-0" });

    refunded = 3070;
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order).toMatchObject({ amount_refunded: "30.70", buyer_fee_refunded: "0.70", platform_fee_refunded: "0.70", payment_status: "refunded" });
    expect(stripe.applicationFees.createRefund).toHaveBeenCalledTimes(2);
    expect(stripe.applicationFees.createRefund.mock.calls[1][1].amount).toBe(46);
  });

  it("preserves a newer buyer fee refund during concurrent reconciliation", async () => {
    Object.assign(order, { amount_total: "30.70", buyer_fee_amount: "0.70", platform_fee_amount: "0.70" });
    chargeAmount = 3070;
    applicationFeeId = "fee_buyer";
    applicationFeeAmount = 70;
    orderItems[0].quantity = 3;
    passes = [{ id: 1, order_id: 1, order_item_id: 10, sequence_number: 1, status: "active" }];
    refunded = 1024;
    leadingRefunds = [{ id: "re_buyer", amount: 1024, status: "succeeded", metadata: {
      order_id: "1", pass_id: "1", buyer_fee_policy: "buyer_fee_v1", buyer_fee_refund_cents: "24", ticket_refund_cents: "1000",
    } }];
    beforeRefundUpdate = () => {
      beforeRefundUpdate = undefined;
      Object.assign(order, { amount_refunded: "20.47", buyer_fee_refunded: "0.47", platform_fee_refunded: "0.47", payment_status: "partial_refund" });
      refunded = 2047;
    };
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(order).toMatchObject({ amount_refunded: "20.47", buyer_fee_refunded: "0.47", platform_fee_refunded: "0.47" });
    expect(refundUpdateAttempts).toBe(2);
  });

  it("serializes overlapping fee deltas from concurrent refund targets through a shared starting-balance key", async () => {
    Object.assign(order, { amount_total: "30.90", buyer_fee_amount: "0.90", platform_fee_amount: "0.90" });
    chargeAmount = 3090;
    applicationFeeId = "fee_buyer";
    applicationFeeAmount = 90;
    orderItems[0].quantity = 3;
    passes = [1, 2].map((id) => ({ id, order_id: 1, order_item_id: 10, sequence_number: id, status: "active" }));
    refunded = 2060;
    leadingRefunds = [1, 2].map((id) => ({ id: `re_${id}`, amount: 1030, status: "succeeded", metadata: {
      order_id: "1", pass_id: String(id), buyer_fee_policy: "buyer_fee_v1", buyer_fee_refund_cents: "30", ticket_refund_cents: "1000",
    } }));
    stripe.charges.retrieve.mockResolvedValueOnce({
      id: "ch_test", amount: 3090, amount_refunded: 1030, livemode: false,
      payment_intent: "pi_test", metadata: { order_id: "1" }, application_fee: "fee_buyer",
    });
    stripe.refunds.list.mockImplementationOnce(() => ({
      async *[Symbol.asyncIterator]() { yield { id: "re_first", amount: 1030, ...leadingRefunds[0] }; },
    }));
    const initialReads: Array<(value: { id: string; amount: number; amount_refunded: number }) => void> = [];
    stripe.applicationFees.retrieve.mockImplementationOnce(() => new Promise((resolve) => {
      initialReads.push(resolve);
    })).mockImplementationOnce(() => new Promise((resolve) => {
      initialReads.push(resolve);
      initialReads.forEach((complete) => complete({ id: "fee_buyer", amount: 90, amount_refunded: 0 }));
    }));
    const requests = new Map<string, string>();
    stripe.applicationFees.createRefund.mockImplementation(async (_id, params, options) => {
      const previous = requests.get(options.idempotencyKey);
      if (previous && previous !== JSON.stringify(params)) throw new Error("Stripe idempotency parameters differ. Retry reconciliation.");
      if (!previous) {
        requests.set(options.idempotencyKey, JSON.stringify(params));
        applicationFeeRefunded += params.amount;
      }
      return { id: "fr_test", amount: params.amount };
    });
    const outcomes = await Promise.allSettled([
      syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test"),
      syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test"),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    await syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test");
    expect(applicationFeeRefunded).toBe(60);
    expect(order).toMatchObject({ amount_refunded: "20.60", buyer_fee_refunded: "0.60", platform_fee_refunded: "0.60" });
    expect(requests.has("tournibase-buyer-fee-refund-fee_buyer-from-0")).toBe(true);
  });

  it("waits for Stripe to expose the application fee instead of silently leaving the director short", async () => {
    Object.assign(order, { amount_total: "20.70", buyer_fee_amount: "0.70", platform_fee_amount: "0.70" });
    chargeAmount = 2070;
    refunded = 2070;
    await expect(syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test"))
      .rejects.toThrow("application fee yet");
    expect(order.amount_refunded).toBe("0.00");
    expect(stripe.applicationFees.createRefund).not.toHaveBeenCalled();
  });

  it("rejects exact fee metadata that does not belong to a persisted pass in the order", async () => {
    Object.assign(order, { amount_total: "30.70", buyer_fee_amount: "0.70", platform_fee_amount: "0.70" });
    chargeAmount = 3070;
    applicationFeeId = "fee_buyer";
    applicationFeeAmount = 70;
    refunded = 1024;
    leadingRefunds = [{ id: "re_buyer", amount: 1024, status: "succeeded", metadata: {
      order_id: "1", pass_id: "999", buyer_fee_policy: "buyer_fee_v1", buyer_fee_refund_cents: "24", ticket_refund_cents: "1000",
    } }];
    await expect(syncStripeChargeRefund({ id: "ch_test", livemode: false }, "acct_test"))
      .rejects.toThrow("original pass");
    expect(order.amount_refunded).toBe("0.00");
    expect(stripe.applicationFees.createRefund).not.toHaveBeenCalled();
  });
});
