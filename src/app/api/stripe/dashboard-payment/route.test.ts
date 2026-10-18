import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ workspace: vi.fn(), lookup: vi.fn(), eq: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getDirectorWorkspace: mocks.workspace }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ select: () => {
      const query = {
        eq: (field: string, value: unknown) => { mocks.eq(field, value); return query; },
        maybeSingle: mocks.lookup,
      };
      return query;
    } }),
  }),
}));

import { GET } from "./route";

const owned = {
  id: 12,
  stripe_connected_account_id: "acct_director",
  stripe_environment: "test",
  stripe_payment_intent_id: "pi_director",
  tournaments: { organizations: { id: 2, owner_user_id: "director_1", operating_environment: "test" } },
};
function request(orderId = "12") {
  return new NextRequest(`https://staging.tournibase.com/api/stripe/dashboard-payment?order_id=${orderId}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.workspace.mockResolvedValue({ director: { id: "director_1" }, organization: { id: 2, operatingEnvironment: "test" } });
  mocks.lookup.mockResolvedValue({ data: owned, error: null });
});

describe("director Stripe payment link", () => {
  it("opens only the owned connected account, without a platform login link", async () => {
    const response = await GET(request());
    expect(response.headers.get("location")).toBe("https://dashboard.stripe.com/acct_director/test/payments/pi_director");
    expect(mocks.eq).toHaveBeenCalledWith("stripe_environment", "test");
    expect(mocks.eq).toHaveBeenCalledWith("tournaments.organizations.id", 2);
    expect(mocks.eq).toHaveBeenCalledWith("tournaments.organizations.operating_environment", "test");
  });

  it("requires a signed-in director before loading an order", async () => {
    mocks.workspace.mockResolvedValue(null);
    expect((await GET(request())).headers.get("location")).toBe("https://staging.tournibase.com/login");
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("rejects another owner's payment even if returned by the query", async () => {
    mocks.lookup.mockResolvedValue({ data: { ...owned, tournaments: { organizations: { ...owned.tournaments.organizations, owner_user_id: "another_director" } } }, error: null });
    expect((await GET(request())).headers.get("location")).toBe("https://staging.tournibase.com/dashboard");
  });

  it("rejects an order from the other Stripe environment", async () => {
    mocks.lookup.mockResolvedValue({ data: { ...owned, stripe_environment: "live" }, error: null });
    expect((await GET(request())).headers.get("location")).toBe("https://staging.tournibase.com/dashboard");
  });

  it("does not make a dashboard link for legacy or missing payments", async () => {
    mocks.lookup.mockResolvedValue({ data: { ...owned, stripe_connected_account_id: null }, error: null });
    expect((await GET(request())).status).toBe(409);
    mocks.lookup.mockResolvedValue({ data: { ...owned, stripe_payment_intent_id: null }, error: null });
    expect((await GET(request())).status).toBe(409);
  });
});
