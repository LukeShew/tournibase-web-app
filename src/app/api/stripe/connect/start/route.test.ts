import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ownership: vi.fn(),
  account: vi.fn(),
  synchronize: vi.fn(),
  create: vi.fn(),
  link: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe-connect-director", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/stripe-connect-director")>(),
  getOwnedOrganizationForStripeConnect: mocks.ownership,
}));
vi.mock("@/lib/stripe-connect", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/stripe-connect")>(),
  getStripeConnectConfigurationIssues: () => [],
  getOrganizationStripeAccount: mocks.account,
  synchronizeOrganizationStripeAccount: mocks.synchronize,
  createOrganizationStripeAccount: mocks.create,
  createStripeConnectOnboardingLink: mocks.link,
}));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: () => "https://staging.tournibase.com" }));

import { StripeConnectFeeConfigurationError } from "@/lib/stripe-connect";
import { GET, POST } from "./route";

function request() {
  const body = new FormData();
  body.set("organizationId", "7");
  body.set("event", "12");
  return new Request("https://staging.tournibase.com/api/stripe/connect/start", { method: "POST", body });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "per_ticket_v2");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_BPS", "400");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_FIXED_CENTS", "100");
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.ownership.mockResolvedValue({
    director: { email: "director@example.com" },
    organization: { name: "Director Events" },
  });
  mocks.account.mockResolvedValue({ stripe_account_id: "acct_existing" });
  mocks.synchronize.mockResolvedValue({ stripe_account_id: "acct_existing", fees_collector: "application" });
  mocks.create.mockResolvedValue({ stripe_account_id: "acct_new", fees_collector: "application" });
  mocks.link.mockResolvedValue({ url: "https://connect.stripe.com/setup" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("director-free Stripe onboarding", () => {
  it("returns a clear support result when Stripe has not enabled the fee configuration", async () => {
    mocks.account.mockResolvedValue(null);
    mocks.create.mockRejectedValueOnce(new StripeConnectFeeConfigurationError());
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://staging.tournibase.com/dashboard/settings?event=12&payments=processing_setup_required",
    );
    expect(mocks.link).not.toHaveBeenCalled();
  });

  it.each(["stripe", null])("does not send an existing %s fee account through an ineffective onboarding loop", async (feesCollector) => {
    mocks.synchronize.mockResolvedValue({ stripe_account_id: "acct_existing", fees_collector: feesCollector });
    const response = await POST(request());
    expect(response.headers.get("location")).toContain("payments=processing_setup_required");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.link).not.toHaveBeenCalled();
  });

  it("keeps hosted onboarding for eligible platform-paid accounts", async () => {
    expect((await POST(request())).headers.get("location")).toBe("https://connect.stripe.com/setup");
    expect(mocks.link).toHaveBeenCalledWith({
      accountId: "acct_existing",
      refreshUrl: "https://staging.tournibase.com/api/stripe/connect/start?organization=7&event=12",
      returnUrl: "https://staging.tournibase.com/api/stripe/connect/refresh?organization=7&returned=1&event=12",
    });
  });

  it("preserves legacy onboarding behavior for connected-account-paid processing", async () => {
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "");
    mocks.synchronize.mockResolvedValue({ stripe_account_id: "acct_existing", fees_collector: "stripe" });
    expect((await POST(request())).headers.get("location")).toBe("https://connect.stripe.com/setup");
  });

  it("never creates an account from a GET request", async () => {
    mocks.account.mockResolvedValue(null);
    const response = await GET(new Request("https://staging.tournibase.com/api/stripe/connect/start?organization=7"));
    expect(response.headers.get("location")).toContain("payments=not_connected");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("keeps unrelated errors on the ordinary failure path", async () => {
    mocks.synchronize.mockRejectedValueOnce(new Error("Unavailable"));
    expect((await POST(request())).headers.get("location")).toContain("payments=connect_error");
  });
});
