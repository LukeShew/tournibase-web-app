import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({
  getStripeConfigurationIssues: () => [],
  getVerifiedStripe: async () => stripe,
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminConfigurationIssues: () => [],
  getSupabaseAdmin: () => ({ from, rpc }),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...args: unknown[]) => rateLimit(...args) }));
vi.mock("@/lib/orders", () => ({ fulfillCheckoutSession: vi.fn() }));
vi.mock("@/lib/email/order-confirmation", () => ({ attemptOrderConfirmationEmail: vi.fn(async () => ({})) }));
vi.mock("@/lib/stripe-connect", () => ({
  assertStripeAccountCoversProcessing: (...args: unknown[]) => verifyFeePayer(...args),
}));

import { POST } from "./route";
import { fulfillCheckoutSession } from "@/lib/orders";

let reserved: Record<string, unknown>;
let ticketPrice: number;
let selectedTickets: Array<{ id: number; price: number }> | undefined;
const verifyFeePayer = vi.fn<(...args: unknown[]) => Promise<void>>(async () => {});
const updates: Record<string, unknown>[] = [];
const rpc = vi.fn<() => Promise<{
  data: Record<string, unknown> | null;
  error: { message: string; code?: string } | null;
}>>(async () => ({ data: reserved, error: null }));
const rateLimit = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
const stripe = { checkout: { sessions: {
  create: vi.fn(async () => ({ id: "cs_buyer_fee", url: "https://checkout.stripe.com/example", payment_method_types: ["card"] })),
  expire: vi.fn(async () => ({})),
} } };

function from(table: string) {
  const query = {
    select: () => query,
    in: () => query,
    eq: () => query,
    update: (value: Record<string, unknown>) => { updates.push(value); return query; },
    then: (resolve: (result: unknown) => unknown) => Promise.resolve(resolve({
      data: table === "ticket_types" ? selectedTickets ?? [{ id: 1, price: ticketPrice }] : [], error: null,
    })),
  };
  return query;
}

const request = (email = "buyer@example.com", items = [{ ticketTypeId: 1, quantity: 1 }]) => new NextRequest("https://tournibase.com/api/checkout", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({
    eventSlug: "weekend-event", firstName: "Pat", lastName: "Buyer", email, phone: "", teamName: "",
    items,
    // Prices and fees sent by a browser must never override database pricing.
    amountTotalCents: 1, buyerFeeCents: 0,
  }),
});

beforeEach(() => {
  vi.clearAllMocks(); updates.length = 0; ticketPrice = 10; selectedTickets = undefined;
  verifyFeePayer.mockReset().mockResolvedValue(undefined);
  rateLimit.mockReset().mockResolvedValue(true);
  vi.stubEnv("TOURNIBASE_APP_ENVIRONMENT", "live");
  vi.stubEnv("TOURNIBASE_PAID_CHECKOUT_ENABLED", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit_test");
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_live_unit_test");
  vi.stubEnv("STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION", "pmc_unittest");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_BPS", "200");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_FIXED_CENTS", "30");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tournibase.com");
  reserved = {
    status: "reserved", order_id: 50, tournament_id: 20, tournament_name: "Weekend", public_slug: "weekend-event",
    amount_total_cents: 1050, ticket_subtotal_cents: 1000, buyer_fee_amount_cents: 50, platform_fee_amount_cents: 50,
    stripe_account_ready: true, stripe_connected_account_id: "acct_director", stripe_environment: "live",
    inventory_expires_at: "2027-01-01T00:00:00.000Z",
    items: [{ description: null, name: "Saturday", quantity: 1, ticket_type_id: 1, unit_amount_cents: 1000 }],
  };
});

describe("tiered pricing with director processing coverage", () => {
  beforeEach(() => {
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "per_ticket_v2");
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_BPS", "400");
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_FIXED_CENTS", "100");
    vi.stubEnv("TOURNIBASE_SANDBOX_FEE_QA_ENABLED", "false");
    Object.assign(reserved, {
      amount_total_cents: 1100, ticket_subtotal_cents: 1000,
      buyer_fee_amount_cents: 100, platform_fee_amount_cents: 100,
      fee_policy: "per_ticket_v2", processing_fee_payer: "platform",
      items: [{ description: null, name: "Saturday", quantity: 1, ticket_type_id: 1,
        unit_amount_cents: 1000, buyer_fee_unit_amount_cents: 100 }],
    });
  });

  it("uses the tiered atomic reservation and verifies processing coverage", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("reserve_checkout_order_with_tiered_fee", expect.objectContaining({
      p_platform_fee_bps: 400, p_platform_fee_fixed_cents: 100, p_percentage_threshold_cents: 1000,
    }));
    expect(verifyFeePayer).toHaveBeenCalledWith({ connectedAccountId: "acct_director", environment: "live" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      payment_intent_data: expect.objectContaining({ application_fee_amount: 100 }),
      metadata: expect.objectContaining({ fee_policy: "per_ticket_v2" }),
    }), expect.anything());
  });

  it("charges each paid pass separately while leaving complimentary passes free", async () => {
    selectedTickets = [{ id: 1, price: 10 }, { id: 2, price: 20 }, { id: 3, price: 0 }];
    Object.assign(reserved, {
      amount_total_cents: 4380, ticket_subtotal_cents: 4000,
      buyer_fee_amount_cents: 380, platform_fee_amount_cents: 380,
      items: [
        { name: "Daily", quantity: 2, ticket_type_id: 1, unit_amount_cents: 1000, buyer_fee_unit_amount_cents: 100 },
        { name: "Weekend", quantity: 1, ticket_type_id: 2, unit_amount_cents: 2000, buyer_fee_unit_amount_cents: 180 },
        { name: "Complimentary", quantity: 3, ticket_type_id: 3, unit_amount_cents: 0, buyer_fee_unit_amount_cents: 0 },
      ],
    });
    expect((await POST(request("buyer@example.com", [
      { ticketTypeId: 1, quantity: 2 }, { ticketTypeId: 2, quantity: 1 }, { ticketTypeId: 3, quantity: 3 },
    ]))).status).toBe(200);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      payment_intent_data: expect.objectContaining({ application_fee_amount: 380 }),
    }), expect.anything());
  });

  it("fails closed and releases inventory when Stripe cannot confirm the fee payer", async () => {
    verifyFeePayer.mockRejectedValueOnce(new Error("Existing account charges processing to the director"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(503);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(updates).toContainEqual({ payment_status: "failed" });
    } finally { vi.restoreAllMocks(); }
  });

  it("returns a setup-unavailable response when the database rejects an unverified fee payer", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "Platform-paid Stripe processing must be verified before checkout." },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "Online checkout is temporarily unavailable while the event organizer's payment setup is updated.",
      });
      expect(verifyFeePayer).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      // The failed atomic RPC rolled back its reservation; there is no order
      // outside that transaction to mark failed or release.
      expect(updates).toEqual([]);
    } finally { vi.restoreAllMocks(); }
  });

  it.each(["fee_policy", "processing_fee_payer"])("rejects an incorrect %s snapshot", async (field) => {
    reserved[field] = "legacy";
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(500);
      expect(verifyFeePayer).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });

  it("fulfills free orders without a connected account or processing check", async () => {
    ticketPrice = 0;
    Object.assign(reserved, { amount_total_cents: 0, ticket_subtotal_cents: 0,
      buyer_fee_amount_cents: 0, platform_fee_amount_cents: 0,
      stripe_account_ready: false, stripe_connected_account_id: null,
      items: [{ name: "Free", quantity: 1, ticket_type_id: 1, unit_amount_cents: 0, buyer_fee_unit_amount_cents: 0 }],
    });
    expect((await POST(request())).status).toBe(200);
    expect(verifyFeePayer).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("checkout route buyer fee contract", () => {
  it("reserves server pricing and sends the added service fee to Stripe on the director account", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("reserve_checkout_order_with_buyer_fee", expect.objectContaining({ p_platform_fee_bps: 200, p_platform_fee_fixed_cents: 30, p_items: [{ quantity: 1, ticket_type_id: 1 }] }));
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      payment_method_configuration: "pmc_unittest",
      line_items: [
        expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ unit_amount: 1000 }) }),
        expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ unit_amount: 50 }) }),
      ], payment_intent_data: expect.objectContaining({ application_fee_amount: 50 }),
    }), { stripeAccount: "acct_director", idempotencyKey: "tournibase-order-50" });
  });

  it("fails closed on an inconsistent reservation instead of undercharging or deducting the fee", async () => {
    reserved.amount_total_cents = 1000;
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(500);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(updates).toContainEqual({ payment_status: "failed" });
    } finally { vi.restoreAllMocks(); }
  });

  it("keeps free orders free and creates no Stripe session", async () => {
    ticketPrice = 0;
    vi.stubEnv("STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION", "");
    Object.assign(reserved, { amount_total_cents: 0, ticket_subtotal_cents: 0, buyer_fee_amount_cents: 0, platform_fee_amount_cents: 0,
      stripe_account_ready: false, stripe_connected_account_id: null,
      items: [{ description: null, name: "Free admission", quantity: 1, ticket_type_id: 1, unit_amount_cents: 0 }] });
    expect((await POST(request())).status).toBe(200);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(fulfillCheckoutSession).toHaveBeenCalledOnce();
  });

  it("continues to block paid checkout when the production launch switch is off", async () => {
    vi.stubEnv("TOURNIBASE_PAID_CHECKOUT_ENABLED", "false");
    expect((await POST(request())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("fails safely before reserving inventory when card-only configuration is missing", async () => {
    vi.stubEnv("STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(503);
      expect(rpc).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });

  it("does not bypass paid-checkout guards if a free ticket becomes paid during reservation", async () => {
    ticketPrice = 0;
    vi.stubEnv("TOURNIBASE_PAID_CHECKOUT_ENABLED", "false");
    vi.stubEnv("STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION", "");
    expect((await POST(request())).status).toBe(503);
    expect(updates).toContainEqual({ payment_status: "failed" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("expires an unsafe resolved payment session and never returns its URL", async () => {
    stripe.checkout.sessions.create.mockResolvedValueOnce({
      id: "cs_unsafe", url: "https://checkout.stripe.com/unsafe",
      payment_method_types: ["card", "us_bank_account"],
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect(await response.json()).not.toHaveProperty("url");
      expect(stripe.checkout.sessions.expire).toHaveBeenCalledWith("cs_unsafe", {}, { stripeAccount: "acct_director" });
      expect(updates).toContainEqual({ payment_status: "failed" });
    } finally { vi.restoreAllMocks(); }
  });

  it("rejects a paid total below Stripe's USD minimum before reserving inventory", async () => {
    ticketPrice = 0.10;
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringContaining("at least $0.50") });
    expect(rpc).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("accepts exactly fifty cents including the buyer service fee", async () => {
    ticketPrice = 0.20;
    Object.assign(reserved, {
      amount_total_cents: 50, ticket_subtotal_cents: 20,
      buyer_fee_amount_cents: 30, platform_fee_amount_cents: 30,
      items: [{ description: null, name: "Admission", quantity: 1, ticket_type_id: 1, unit_amount_cents: 20 }],
    });
    expect((await POST(request())).status).toBe(200);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce();
  });

  it("releases a reservation if a concurrent price change takes it below the minimum", async () => {
    Object.assign(reserved, {
      amount_total_cents: 40, ticket_subtotal_cents: 10,
      buyer_fee_amount_cents: 30, platform_fee_amount_cents: 30,
      items: [{ description: null, name: "Admission", quantity: 1, ticket_type_id: 1, unit_amount_cents: 10 }],
    });
    expect((await POST(request())).status).toBe(400);
    expect(updates).toContainEqual({ payment_status: "failed" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("allows more than twelve distinct buyers behind shared Wi-Fi while keeping an IP cap", async () => {
    let ipAttempts = 0;
    rateLimit.mockImplementation(async (...args) => {
      const input = args[0] as { key: string; limit: number };
      return input.key.startsWith("checkout-ip:") ? ++ipAttempts <= input.limit : true;
    });
    for (let buyer = 1; buyer <= 13; buyer++) {
      expect((await POST(request(`buyer${buyer}@example.com`))).status).toBe(200);
    }
    expect(rateLimit).toHaveBeenCalledWith({ key: "checkout-ip:unknown", limit: 300, windowSeconds: 600 });
    ipAttempts = 300;
    expect((await POST(request("buyer301@example.com"))).status).toBe(429);
  });

  it("retains the stricter per-buyer limit even when the shared IP has capacity", async () => {
    rateLimit.mockImplementation(async (...args) => {
      const input = args[0] as { key: string };
      return !input.key.startsWith("checkout-email:");
    });
    expect((await POST(request())).status).toBe(429);
    expect(rateLimit).toHaveBeenCalledWith({ key: "checkout-email:buyer@example.com", limit: 6, windowSeconds: 600 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
