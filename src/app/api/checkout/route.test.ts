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
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => true }));
vi.mock("@/lib/orders", () => ({ fulfillCheckoutSession: vi.fn() }));
vi.mock("@/lib/email/order-confirmation", () => ({ attemptOrderConfirmationEmail: vi.fn(async () => ({})) }));

import { POST } from "./route";
import { fulfillCheckoutSession } from "@/lib/orders";

let reserved: Record<string, unknown>;
let ticketPrice: number;
const updates: Record<string, unknown>[] = [];
const rpc = vi.fn(async () => ({ data: reserved, error: null }));
const stripe = { checkout: { sessions: {
  create: vi.fn(async () => ({ id: "cs_buyer_fee", url: "https://checkout.stripe.com/example" })),
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

const request = () => new NextRequest("https://tournibase.com/api/checkout", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({
    eventSlug: "weekend-event", firstName: "Pat", lastName: "Buyer", email: "buyer@example.com", phone: "", teamName: "",
    items: [{ ticketTypeId: 1, quantity: 1 }],
    // Prices and fees sent by a browser must never override database pricing.
    amountTotalCents: 1, buyerFeeCents: 0,
  }),
});

beforeEach(() => {
  vi.clearAllMocks(); updates.length = 0; ticketPrice = 10;
  vi.stubEnv("TOURNIBASE_APP_ENVIRONMENT", "live");
  vi.stubEnv("TOURNIBASE_PAID_CHECKOUT_ENABLED", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_unit_test");
  vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_live_unit_test");
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
});
