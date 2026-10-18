import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  from: vi.fn(),
  getAccount: vi.fn(),
  synchronize: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getDirectorWorkspace: mocks.getWorkspace }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/stripe-connect", () => ({
  getOrganizationStripeAccount: mocks.getAccount,
  synchronizeOrganizationStripeAccount: mocks.synchronize,
  getStripeConnectStatus: () => "ready",
}));

import { POST } from "./route";

const request = () => new Request("https://tournibase.com/api/stripe/connect/status", {
  method: "POST",
  body: JSON.stringify({ organizationId: 1 }),
});

beforeEach(() => vi.resetAllMocks());

describe("Connect status authorization", () => {
  it("returns 403 instead of a server error for a missing or expired session", async () => {
    mocks.getWorkspace.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Not authorized." });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getAccount).not.toHaveBeenCalled();
    expect(mocks.synchronize).not.toHaveBeenCalled();
  });

  it("does not query or synchronize another director's organization", async () => {
    mocks.getWorkspace.mockResolvedValue({ director: { id: "director" }, organization: { id: 2, operatingEnvironment: "live" } });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.synchronize).not.toHaveBeenCalled();
  });

  it("preserves owner and environment checks for an authorized request", async () => {
    mocks.getWorkspace.mockResolvedValue({ director: { id: "director" }, organization: { id: 1, operatingEnvironment: "live" } });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: { id: 1, name: "Director Events" }, error: null })),
    };
    mocks.from.mockReturnValue(query);
    mocks.getAccount.mockResolvedValue({ stripe_account_id: "acct_director" });
    mocks.synchronize.mockResolvedValue({ status: "ready" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(query.eq).toHaveBeenCalledWith("owner_user_id", "director");
    expect(query.eq).toHaveBeenCalledWith("operating_environment", "live");
    expect(mocks.synchronize).toHaveBeenCalledOnce();
  });
});
