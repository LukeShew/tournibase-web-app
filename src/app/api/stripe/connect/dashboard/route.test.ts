import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ workspace: vi.fn(), from: vi.fn(), account: vi.fn(), environment: vi.fn(), dashboard: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getDirectorWorkspace: mocks.workspace }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/stripe-connect", () => ({ getOrganizationStripeAccount: mocks.account, createStripeDirectorDashboardUrl: mocks.dashboard }));
vi.mock("@/lib/stripe-connect-payments", () => ({ getStripeEnvironment: mocks.environment }));

import { POST } from "./route";

function request(organizationId = "1") {
  const body = new FormData();
  body.set("organizationId", organizationId);
  return new Request("https://staging.tournibase.com/api/stripe/connect/dashboard", { method: "POST", body });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.workspace.mockResolvedValue({ director: { id: "director" }, organization: { id: 1, operatingEnvironment: "test" } });
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: { id: 1, name: "Director Events" }, error: null })),
  };
  mocks.from.mockReturnValue(query);
  mocks.account.mockResolvedValue({ stripe_account_id: "acct_director" });
  mocks.environment.mockReturnValue("test");
  mocks.dashboard.mockImplementation(async ({ environment }) => `https://dashboard.stripe.com/acct_director${environment === "test" ? "/test" : ""}/dashboard`);
});

describe("Settings Stripe dashboard link", () => {
  it.each([
    ["test", "https://dashboard.stripe.com/acct_director/test/dashboard"],
    ["live", "https://dashboard.stripe.com/acct_director/dashboard"],
  ])("keeps the connected account before the %s mode path", async (environment, url) => {
    mocks.environment.mockReturnValue(environment);
    mocks.workspace.mockResolvedValue({ director: { id: "director" }, organization: { id: 1, operatingEnvironment: environment } });
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(url);
    expect(mocks.account).toHaveBeenCalledWith(1);
    expect(mocks.from.mock.results[0].value.eq).toHaveBeenCalledWith("owner_user_id", "director");
    expect(mocks.from.mock.results[0].value.eq).toHaveBeenCalledWith("operating_environment", environment);
  });

  it("does not load an account when signed out", async () => {
    mocks.workspace.mockResolvedValue(null);
    expect((await POST(request())).headers.get("location"))
      .toBe("https://staging.tournibase.com/dashboard/settings?payments=not_authorized");
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });

  it("redirects securely to a fresh Express link", async () => {
    mocks.dashboard.mockResolvedValue("https://connect.stripe.com/express/single-use");
    const response = await POST(request());
    expect(response.headers.get("location")).toBe("https://connect.stripe.com/express/single-use");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.dashboard).toHaveBeenCalledWith({ connectedAccountId: "acct_director", environment: "test" });
  });

  it("returns to Settings when Stripe cannot provide access", async () => {
    mocks.dashboard.mockRejectedValue(new Error("Unavailable"));
    expect((await POST(request())).headers.get("location")).toContain("payments=dashboard_error");
  });

  it("does not open another organization's Stripe account", async () => {
    expect((await POST(request("2"))).headers.get("location"))
      .toBe("https://staging.tournibase.com/dashboard/settings?payments=not_authorized");
    expect(mocks.account).not.toHaveBeenCalled();
  });

  it("returns to settings if the organization is not connected", async () => {
    mocks.account.mockResolvedValue(null);
    expect((await POST(request())).headers.get("location"))
      .toBe("https://staging.tournibase.com/dashboard/settings?payments=not_connected");
  });
});
