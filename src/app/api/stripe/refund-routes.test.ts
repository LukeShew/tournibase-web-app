import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  from: vi.fn(),
  verifiedStripe: vi.fn(),
  synchronize: vi.fn(),
  email: vi.fn(),
  retrieveSession: vi.fn(),
  retrieveCharge: vi.fn(),
  listRefunds: vi.fn(),
  createRefund: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getDirectorWorkspace: mocks.workspace }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));
vi.mock("@/lib/stripe", () => ({ getVerifiedStripe: mocks.verifiedStripe }));
vi.mock("@/lib/orders", () => ({ syncStripeChargeRefund: mocks.synchronize }));
vi.mock("@/lib/email/refund-confirmation", () => ({
  attemptRefundConfirmationEmail: mocks.email,
}));

import { POST as refundOrder } from "./refund-order/route";
import { POST as refundPass } from "./refund-pass/route";

type Refund = {
  id: string;
  charge: string;
  payment_intent: string;
  amount: number;
  metadata: { order_id: string; pass_id?: string; buyer_fee_policy?: string; buyer_fee_refund_cents?: string; ticket_refund_cents?: string };
  status: string;
};

const stripe = {
  checkout: { sessions: { retrieve: mocks.retrieveSession } },
  charges: { retrieve: mocks.retrieveCharge },
  refunds: { list: mocks.listRefunds, create: mocks.createRefund },
};

function makeOrder() {
  return {
    id: 1957,
    amount_total: "54.00",
    amount_refunded: "0.00",
    payment_status: "paid",
    platform_fee_amount: "0.00",
    buyer_fee_amount: "0.00",
    stripe_checkout_id: "cs_test_order",
    stripe_connected_account_id: "acct_director",
    stripe_environment: "test",
    stripe_payment_intent_id: "pi_test_order",
    tournaments: {
      organizations: {
        id: 1,
        owner_user_id: "director-one",
        operating_environment: "test",
      },
    },
  };
}

let order: ReturnType<typeof makeOrder>;
let pass: {
  id: number;
  order_id: number;
  order_item_id: number;
  sequence_number: number;
  status: string;
  orders: ReturnType<typeof makeOrder>;
  order_items: { unit_amount_cents: number };
};
let lookupError: { code: string } | null;
let missingRow: boolean;
let refundHistory: Refund[];
let selections: Map<string, string>;
let filters: Array<[string, unknown]>;
let idempotentRequests: Map<string, string>;
let orderItems: Array<{ id: number; quantity: number; unit_amount_cents: number }>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TOURNIBASE_APP_ENVIRONMENT", "test");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  order = makeOrder();
  pass = {
    id: 4788,
    order_id: order.id,
    order_item_id: 2136,
    sequence_number: 1,
    status: "active",
    orders: order,
    order_items: { unit_amount_cents: 1800 },
  };
  lookupError = null;
  missingRow = false;
  refundHistory = [];
  selections = new Map();
  filters = [];
  idempotentRequests = new Map();
  orderItems = [{ id: 2136, quantity: 3, unit_amount_cents: 1800 }];
  mocks.workspace.mockResolvedValue({
    director: { id: "director-one" },
    organization: { id: 1, operatingEnvironment: "test" },
  });
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: (value: string) => { selections.set(table, value); return query; },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({
        data: missingRow || lookupError ? null : table === "passes" ? pass : order,
        error: lookupError,
      }),
      then: (resolve: (result: { data: typeof orderItems; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: orderItems, error: null })),
    };
    return query;
  });
  mocks.verifiedStripe.mockResolvedValue(stripe);
  mocks.retrieveSession.mockResolvedValue({
    id: "cs_test_order", livemode: false, payment_intent: "pi_test_order",
  });
  mocks.retrieveCharge.mockResolvedValue({ id: "ch_test_order", livemode: false });
  mocks.listRefunds.mockImplementation(() => ({
    async *[Symbol.asyncIterator]() {
      for (const refund of refundHistory) yield refund;
    },
  }));
  mocks.createRefund.mockImplementation(async (
    params: { amount?: number; payment_intent: string; metadata: Refund["metadata"] },
    options: { stripeAccount: string; idempotencyKey: string },
  ) => {
    const saved = idempotentRequests.get(options.idempotencyKey);
    if (saved && saved !== JSON.stringify(params)) {
      throw new Error("Keys for idempotent requests can only be used with the same parameters.");
    }
    idempotentRequests.set(options.idempotencyKey, JSON.stringify(params));
    const refund: Refund = {
      id: `re_${refundHistory.length + 1}`,
      charge: "ch_test_order",
      payment_intent: params.payment_intent,
      amount: params.amount ?? 5400,
      metadata: params.metadata,
      status: "succeeded",
    };
    refundHistory.unshift(refund);
    return refund;
  });
  mocks.synchronize.mockResolvedValue({
    status: "partial_refund", orderId: 1957,
    amountTotalCents: 5400, amountRefundedCents: 1800,
    succeededRefundIds: ["re_1", "re_original"],
  });
  mocks.email.mockResolvedValue({ status: "sent", messageId: "message-id" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const routes = [
  { name: "order", handler: refundOrder, payload: { orderId: 1957 }, originalKey: "tournibase-order-refund-1957" },
  { name: "pass", handler: refundPass, payload: { orderId: 1957, passId: 4788 }, originalKey: "tournibase-pass-refund-4788" },
] as const;

function request(payload: unknown) {
  return new NextRequest("https://staging.tournibase.com/api/stripe/refund", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe.each(routes)("$name refunds", ({ name, handler, payload, originalKey }) => {
  beforeEach(() => {
    mocks.synchronize.mockResolvedValue({
      status: name === "order" ? "refunded" : "partial_refund", orderId: 1957,
      amountTotalCents: 5400, amountRefundedCents: name === "order" ? 5400 : 1800,
      succeededRefundIds: ["re_1", "re_original"],
    });
  });

  it.each(["0.00", "1.38"])("handles a %s application fee without changing payment ownership", async (fee) => {
    order.platform_fee_amount = fee;
    const response = await handler(request(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "completed" });
    const [params, options] = mocks.createRefund.mock.calls[0];
    expect(params).toEqual({
      ...(name === "pass" ? { amount: 1800 } : {}),
      metadata: { order_id: "1957", ...(name === "pass" ? { pass_id: "4788" } : {}) },
      payment_intent: "pi_test_order",
      ...(fee === "0.00" ? {} : { refund_application_fee: true }),
    });
    expect(options).toEqual({
      stripeAccount: "acct_director",
      idempotencyKey: fee === "0.00" ? `${originalKey}-no-fee-v2` : originalKey,
    });
    expect(mocks.listRefunds).toHaveBeenCalledWith(
      { payment_intent: "pi_test_order", limit: 100 },
      { stripeAccount: "acct_director" },
    );
    expect(mocks.retrieveCharge).toHaveBeenCalledWith("ch_test_order", {}, { stripeAccount: "acct_director" });
    expect(mocks.synchronize).toHaveBeenCalledWith({ id: "ch_test_order", livemode: false }, "acct_director");
    expect(mocks.email).toHaveBeenCalledOnce();
    expect(filters).toContainEqual([name === "pass" ? "orders.stripe_environment" : "stripe_environment", "test"]);
    expect(filters).toContainEqual([`${name === "pass" ? "orders." : ""}tournaments.organizations.id`, 1]);
  });

  it("uses a stable corrected key when the old zero-fee request was rejected", async () => {
    idempotentRequests.set(originalKey, "previous request contained refund_application_fee:true");
    const response = await handler(request(payload));
    expect(response.status).toBe(200);
    expect(mocks.createRefund.mock.calls[0][1].idempotencyKey).toBe(`${originalKey}-no-fee-v2`);
    expect(refundHistory).toHaveLength(1);
  });

  it("reconciles a successful refund after a synchronization failure without refunding twice", async () => {
    mocks.synchronize.mockRejectedValueOnce(new Error("Temporary database failure"));
    expect((await handler(request(payload))).status).toBe(502);
    expect((await handler(request(payload))).status).toBe(200);
    expect(mocks.createRefund).toHaveBeenCalledOnce();
    expect(refundHistory).toHaveLength(1);
    expect(mocks.synchronize).toHaveBeenCalledTimes(2);
  });

  it("finds an earlier matching refund beyond the first 100 records", async () => {
    refundHistory = Array.from({ length: 101 }, (_, index) => ({
      id: `re_other_${index}`, charge: "ch_test_order", payment_intent: "pi_test_order",
      amount: 1, metadata: { order_id: "1957", pass_id: String(9000 + index) }, status: "succeeded",
    }));
    refundHistory.push({
      id: "re_original", charge: "ch_test_order", payment_intent: "pi_test_order",
      amount: name === "pass" ? 1800 : 5400,
      metadata: { order_id: "1957", ...(name === "pass" ? { pass_id: "4788" } : {}) },
      status: "succeeded",
    });
    expect((await handler(request(payload))).status).toBe(200);
    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(mocks.synchronize).toHaveBeenCalledOnce();
  });

  it.each(["pending", "requires_action"])("does not duplicate an existing %s refund", async (status) => {
    refundHistory.push({
      id: "re_pending", charge: "ch_test_order", payment_intent: "pi_test_order", amount: 1800,
      metadata: { order_id: "1957", ...(name === "pass" ? { pass_id: "4788" } : {}) }, status,
    });
    mocks.synchronize.mockResolvedValue({ status: "not_refunded" });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await handler(request(payload));
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({
        ok: false, status,
        message: expect.stringContaining(status === "pending" ? "not completed yet" : "additional action"),
      });
    }
    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each(["pending", "requires_action"])("does not announce a newly created %s refund as completed", async (status) => {
    mocks.createRefund.mockResolvedValueOnce({
      id: "re_new_pending", charge: "ch_test_order", status,
    });
    mocks.synchronize.mockResolvedValueOnce({ status: "not_refunded" });
    const response = await handler(request(payload));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: false, status });
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("keeps a pending refund pending even when an earlier refund already changed the order totals", async () => {
    mocks.createRefund.mockResolvedValueOnce({
      id: "re_new_pending", charge: "ch_test_order", status: "pending",
    });
    mocks.synchronize.mockResolvedValueOnce({
      status: "partial_refund", orderId: 1957, amountTotalCents: 5400, amountRefundedCents: 1800,
      succeededRefundIds: ["re_previous"],
    });
    const response = await handler(request(payload));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ ok: false, status: "pending" });
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each(["not_refunded", "order_not_found"])("does not report completion before synchronization (%s)", async (status) => {
    mocks.synchronize.mockResolvedValueOnce({ status });
    const response = await handler(request(payload));
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      ok: false, status: "pending", message: expect.stringContaining("still updating"),
    });
    expect(mocks.email).not.toHaveBeenCalled();
    // A later retry reconciles the same successful Stripe refund.
    expect((await handler(request(payload))).status).toBe(200);
    expect(mocks.createRefund).toHaveBeenCalledOnce();
  });

  it.each(["failed", "canceled"])("does not report a newly created %s refund as complete", async (status) => {
    mocks.createRefund.mockResolvedValueOnce({ id: "re_failed", charge: "ch_test_order", status });
    mocks.synchronize.mockResolvedValueOnce({ status: "not_refunded" });
    const response = await handler(request(payload));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Resolve it directly in Stripe") });
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it.each(["failed", "canceled"])("does not silently resubmit an existing %s refund", async (status) => {
    refundHistory.push({
      id: "re_failed", charge: "ch_test_order", payment_intent: "pi_test_order", amount: 1800,
      metadata: { order_id: "1957", ...(name === "pass" ? { pass_id: "4788" } : {}) }, status,
    });
    const response = await handler(request(payload));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Resolve it directly in Stripe") });
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests without looking up orders", async () => {
    mocks.workspace.mockResolvedValue(null);
    expect((await handler(request(payload))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.verifiedStripe).not.toHaveBeenCalled();
  });

  it("rejects invalid input without looking up orders", async () => {
    expect((await handler(request({ orderId: -1 }))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.verifiedStripe).not.toHaveBeenCalled();
  });

  it("distinguishes a database relationship error from an absent pass/order", async () => {
    lookupError = { code: "PGRST201" };
    const response = await handler(request(payload));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("could not be loaded");
    expect(mocks.verifiedStripe).not.toHaveBeenCalled();
    expect(mocks.createRefund).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
    lookupError = null;
    missingRow = true;
    expect((await handler(request(payload))).status).toBe(404);
    expect(mocks.verifiedStripe).not.toHaveBeenCalled();
  });

  it.each(["owner", "organization", "environment"])("rejects mismatched %s without calling Stripe", async (mismatch) => {
    if (mismatch === "owner") order.tournaments.organizations.owner_user_id = "other-director";
    if (mismatch === "organization") order.tournaments.organizations.id = 2;
    if (mismatch === "environment") order.stripe_environment = "live";
    expect((await handler(request(payload))).status).toBe(403);
    expect(mocks.verifiedStripe).not.toHaveBeenCalled();
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("rejects an order from a different deployed Stripe environment", async () => {
    vi.stubEnv("TOURNIBASE_APP_ENVIRONMENT", "live");
    expect((await handler(request(payload))).status).toBe(409);
    expect(mocks.verifiedStripe).not.toHaveBeenCalled();
  });

  it("returns a controlled error if Stripe platform verification fails", async () => {
    mocks.verifiedStripe.mockRejectedValueOnce(new Error("Wrong platform"));
    expect((await handler(request(payload))).status).toBe(502);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("returns a controlled error if Checkout belongs to the wrong Stripe mode", async () => {
    // Full-order refunds only retrieve the session when its PaymentIntent was not persisted.
    Object.assign(order, { stripe_payment_intent_id: null });
    mocks.retrieveSession.mockResolvedValueOnce({ payment_intent: "pi_wrong", livemode: true });
    expect((await handler(request(payload))).status).toBe(502);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });

  it("does not create a refund when reading existing Stripe refunds fails", async () => {
    mocks.listRefunds.mockImplementationOnce(() => ({
      async *[Symbol.asyncIterator]() {
        yield* [];
        throw new Error("Stripe unavailable");
      },
    }));
    expect((await handler(request(payload))).status).toBe(502);
    expect(mocks.createRefund).not.toHaveBeenCalled();
  });
});

it("waits for the full order balance to synchronize before reporting an order refund complete", async () => {
  const response = await refundOrder(request({ orderId: 1957 }));
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({ ok: false, status: "pending" });
  expect(mocks.email).not.toHaveBeenCalled();
});

it("selects explicit composite pass relationships and the recorded application fee", async () => {
  await refundPass(request({ orderId: 1957, passId: 4788 }));
  expect(selections.get("passes")).toContain("orders!passes_order_tournament_fk!inner(");
  expect(selections.get("passes")).toContain("order_items!passes_order_item_relationship_fk!inner(");
  expect(selections.get("passes")).toContain("platform_fee_amount");
  await refundOrder(request({ orderId: 1957 }));
  expect(selections.get("orders")).toContain("platform_fee_amount");
  expect(selections.get("orders")).toContain("tournaments!orders_tournament_id_fkey!inner(");
});

it("never turns a complimentary pass into an entire-payment refund", async () => {
  pass.order_items.unit_amount_cents = 0;
  expect((await refundPass(request({ orderId: 1957, passId: 4788 }))).status).toBe(409);
  expect(mocks.verifiedStripe).not.toHaveBeenCalled();
  expect(mocks.createRefund).not.toHaveBeenCalled();
});

it("refunds a pass price plus its exact buyer fee and keeps the application fee reversal separate", async () => {
  order.buyer_fee_amount = "1.39";
  order.platform_fee_amount = "1.39";
  order.amount_total = "55.39";
  expect((await refundPass(request({ orderId: 1957, passId: 4788 }))).status).toBe(200);
  expect(mocks.createRefund).toHaveBeenCalledWith({
    amount: 1847,
    payment_intent: "pi_test_order",
    metadata: { order_id: "1957", pass_id: "4788", buyer_fee_policy: "buyer_fee_v1",
      buyer_fee_refund_cents: "47", ticket_refund_cents: "1800" },
  }, { stripeAccount: "acct_director", idempotencyKey: "tournibase-pass-refund-4788-buyer-fee-v1" });
  expect(filters).toContainEqual(["order_id", 1957]);
});

it("reuses a buyer-fee refund after failed synchronization without returning the fee twice", async () => {
  order.buyer_fee_amount = "1.39";
  order.platform_fee_amount = "1.39";
  order.amount_total = "55.39";
  mocks.synchronize.mockRejectedValueOnce(new Error("Temporary database failure"));
  expect((await refundPass(request({ orderId: 1957, passId: 4788 }))).status).toBe(502);
  expect((await refundPass(request({ orderId: 1957, passId: 4788 }))).status).toBe(200);
  expect(mocks.createRefund).toHaveBeenCalledOnce();
  expect(refundHistory).toHaveLength(1);
  expect(refundHistory[0].amount).toBe(1847);
});

it("refunds the remaining complete payment after a buyer-fee pass refund, with stable retries", async () => {
  order.buyer_fee_amount = "1.39";
  order.platform_fee_amount = "1.39";
  order.amount_total = "55.39";
  await refundPass(request({ orderId: 1957, passId: 4788 }));
  order.amount_refunded = "18.47";
  order.payment_status = "partial_refund";
  mocks.synchronize.mockResolvedValue({ status: "refunded", orderId: 1957,
    amountTotalCents: 5539, amountRefundedCents: 5539, succeededRefundIds: ["re_1", "re_2"] });
  expect((await refundOrder(request({ orderId: 1957 }))).status).toBe(200);
  expect((await refundOrder(request({ orderId: 1957 }))).status).toBe(200);
  expect(mocks.createRefund).toHaveBeenCalledTimes(2);
  expect(mocks.createRefund.mock.calls[1]).toEqual([
    { payment_intent: "pi_test_order", metadata: { order_id: "1957" } },
    { stripeAccount: "acct_director", idempotencyKey: "tournibase-order-refund-1957-buyer-fee-v1" },
  ]);
});

it("does not charge a complimentary pass any buyer fee even in a paid order", async () => {
  order.buyer_fee_amount = "1.39";
  pass.order_items.unit_amount_cents = 0;
  expect((await refundPass(request({ orderId: 1957, passId: 4788 }))).status).toBe(409);
  expect(mocks.createRefund).not.toHaveBeenCalled();
});

it("fails closed when the pass cannot be matched to its recorded buyer fee allocation", async () => {
  order.buyer_fee_amount = "1.39";
  pass.sequence_number = 4;
  expect((await refundPass(request({ orderId: 1957, passId: 4788 }))).status).toBe(502);
  expect(mocks.createRefund).not.toHaveBeenCalled();
});
