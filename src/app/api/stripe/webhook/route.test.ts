import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ construct: vi.fn(), sync: vi.fn(), email: vi.fn(), verify: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: mocks.construct } }),
  getStripeConfigurationIssues: () => [], getStripePaymentWebhookSecret: () => "whsec_fixture",
  getVerifiedStripe: mocks.verify,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminConfigurationIssues: () => [] }));
vi.mock("@/lib/stripe-connect-payments", () => ({ assertStripeEventMatchesAppEnvironment: () => "test" }));
vi.mock("@/lib/orders", () => ({ syncStripeChargeRefund: mocks.sync, fulfillCheckoutSession: vi.fn(), markCheckoutFailed: vi.fn() }));
vi.mock("@/lib/email/refund-confirmation", () => ({ attemptRefundConfirmationEmail: mocks.email }));
vi.mock("@/lib/email/order-confirmation", () => ({ attemptOrderConfirmationEmail: vi.fn() }));
import { POST } from "./route";

function request() { return new Request("https://staging.example/api/stripe/webhook", {
  method: "POST", body: "signed fixture", headers: { "stripe-signature": "fixture-signature" },
}); }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({});
  mocks.email.mockResolvedValue({ status: "sent" });
  mocks.sync.mockResolvedValue({ status: "partial_refund", orderId: 1, amountRefundedCents: 1030,
    buyerFeeRefundedCents: 30, amountTotalCents: 2060, pendingRefundCents: 0, failedRefundCents: 0,
    succeededRefundIds: ["re_fixture"] });
});

describe("refund lifecycle webhook", () => {
  it.each(["refund.created", "refund.updated", "refund.failed"])("reconciles %s in the event's connected account", async (type) => {
    mocks.construct.mockReturnValue({ id: "evt_fixture", type, account: "acct_director", livemode: false,
      data: { object: { id: "re_fixture", charge: "ch_fixture", status: type === "refund.failed" ? "failed" : "pending" } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith({ id: "ch_fixture", livemode: false }, "acct_director");
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("sends a refund receipt only for the refund that is still successful in the latest snapshot", async () => {
    mocks.construct.mockReturnValue({ id: "evt_fixture", type: "refund.updated", account: "acct_director", livemode: false,
      data: { object: { id: "re_fixture", charge: "ch_fixture", status: "succeeded" } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.email).toHaveBeenCalledOnce();
    mocks.email.mockClear();
    mocks.sync.mockResolvedValue({ status: "partial_refund", orderId: 1, amountRefundedCents: 1000,
      amountTotalCents: 2000, succeededRefundIds: ["re_other"] });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("returns 500 on reconciliation failure so Stripe retries", async () => {
    mocks.construct.mockReturnValue({ id: "evt_fixture", type: "refund.failed", account: "acct_director", livemode: false,
      data: { object: { id: "re_fixture", charge: "ch_fixture", status: "failed" } } });
    mocks.sync.mockRejectedValue(new Error("transient database error"));
    expect((await POST(request())).status).toBe(500);
    expect(mocks.email).not.toHaveBeenCalled();
  });
});
