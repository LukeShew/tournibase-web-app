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

import { POST } from "./route";
import { fulfillCheckoutSession } from "@/lib/orders";

let reserved: Record<string, unknown>;
let ticketPrice: number;
const updates: Record<string, unknown>[] = [];
const rpc = vi.fn(async () => ({ data: reserved, error: null }));
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
      data: table === "ticket_types" ? [{ id: 1, price: ticketPrice }] : [], error: null,
    })),
  };
  return query;
}

const request = (email = "buyer@example.com") => new NextRequest("https://tournibase.com/api/checkout", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({
    eventSlug: "weekend-event", firstName: "Pat", lastName: "Buyer", email, phone: "", teamName: "",
    items: [{ ticketTypeId: 1, quantity: 1 }],
    // Prices and fees sent by a browser must never override database pricing.
    amountTotalCents: 1, buyerFeeCents: 0,
  }),
});

beforeEach(() => {
  vi.clearAllMocks(); updates.length = 0; ticketPrice = 10;
  rateLimit.mockReset().mockResolvedValue(true);
  vi.stubEnv("TOURNIBASE_APP_ENVIRONMENT", "live");
  vi.stubEnv("TOURNIBASE_PAID_CHECKOUT_ENABLED", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit_test");
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_live_unit_test");
  vi.stubEnv("STRIPE_CHECKOUT_PAYMENT_METHOD_CONFIGURATION", "pmc_unittest");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_BPS", "200");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_FIXED_CENTS", "30");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tournibase.com");
  reserved = {
    status: "reserved", order_id: 50, tournament_id: 20, tournament_name: "Weekend", public_slug: "weekend-event",
    amount_total_cents: 1050, ticket_subtotal_cents: 1000, buyer_fee_amount_cents: 50, platform_fee_amount_cents: 50,
    stripe_account_ready: true, stripe_connected_account_id: "acct_director", stripe_environment: "live",
    inventory_expires_at: "2027-01-01T00:00:00.000Z",
    items: [{ description: null, name: "Saturday", quantity: 1, ticket_type_id: 1, unit_amount_cents: 1000 }],
  };
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
