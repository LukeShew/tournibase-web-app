import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  environment: vi.fn(() => "test"),
  upsert: vi.fn(),
  login: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-environment", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/app-environment")>(),
  getAppEnvironment: mocks.environment,
}));
vi.mock("@/lib/stripe", () => ({
  getVerifiedStripe: async () => ({ accounts: { createLoginLink: mocks.login }, v2: { core: { accounts: {
    create: mocks.create,
    retrieve: mocks.retrieve,
  } } } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

import {
  assertStripeAccountCoversProcessing,
  CONNECT_PREVIEW_OPTIONS,
  createStripeDirectorDashboardUrl,
  createOrganizationStripeAccount,
  getStripeConnectStatus,
  getOrganizationStripeAccount,
  synchronizeOrganizationStripeAccount,
  isOrganizationStripeAccountReady,
  isOrganizationStripeProcessingSetupRequired,
  mapStripeAccountState,
  StripeConnectFeeConfigurationError,
  type OrganizationStripeAccount,
} from "./stripe-connect";

function account(overrides: Record<string, unknown> = {}): Stripe.V2.Core.Account {
  return {
    id: "acct_director",
    livemode: false,
    closed: false,
    dashboard: "full",
    applied_configurations: ["merchant"],
    defaults: { responsibilities: {
      fees_collector: "application",
      losses_collector: "stripe",
    } },
    configuration: { merchant: { capabilities: {
      card_payments: { status: "active", status_details: [] },
      stripe_balance: { payouts: { status: "active", status_details: [] } },
    } } },
    ...overrides,
  } as unknown as Stripe.V2.Core.Account;
}

let existing: OrganizationStripeAccount | null;
let saved: OrganizationStripeAccount | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.environment.mockReturnValue("test");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "per_ticket_v2");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_BPS", "400");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_FIXED_CENTS", "100");
  existing = null;
  saved = undefined;
  mocks.create.mockResolvedValue(account());
  mocks.retrieve.mockResolvedValue(account());
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => { mocks.eq(...args); return query; },
      maybeSingle: async () => ({
        data: table === "organizations" ? { id: 7 } : existing,
        error: null,
      }),
      upsert: (snapshot: OrganizationStripeAccount, options: unknown) => {
        mocks.upsert(snapshot, options);
        saved = snapshot;
        return query;
      },
      single: async () => ({ data: saved, error: null }),
    };
    return query;
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("director-free connected account guard", () => {
  it("selects only the current connection for new purchases", async () => {
    await getOrganizationStripeAccount(7);
    expect(mocks.eq).toHaveBeenCalledWith("is_current", true);
  });

  it("synchronizes by account ID without promoting a historical account", async () => {
    await synchronizeOrganizationStripeAccount({ organization_id: 7, stripe_account_id: "acct_director" });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ stripe_account_id: "acct_director" }), { onConflict: "stripe_account_id" });
    expect(mocks.upsert.mock.calls[0][0]).not.toHaveProperty("is_current");
  });
  const routing = { connectedAccountId: "acct_director", environment: "test" as const };

  it("requires Stripe's current fee responsibility for the exact reserved account", async () => {
    await expect(assertStripeAccountCoversProcessing(routing)).resolves.toBeUndefined();
    expect(mocks.retrieve).toHaveBeenCalledWith("acct_director", { include: ["defaults"] }, CONNECT_PREVIEW_OPTIONS);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it.each(["stripe", "application_custom", "application_express", undefined])(
    "does not treat %s fee collection as ordinary processing covered by TourniBase",
    async (feesCollector) => {
      mocks.retrieve.mockResolvedValue(account({
        defaults: { responsibilities: { fees_collector: feesCollector } },
      }));
      await expect(assertStripeAccountCoversProcessing(routing))
        .rejects.toBeInstanceOf(StripeConnectFeeConfigurationError);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.upsert).not.toHaveBeenCalled();
    },
  );

  it.each(["application", null, undefined])(
    "rejects %s loss responsibility even when TourniBase covers processing",
    async (lossesCollector) => {
      mocks.retrieve.mockResolvedValue(account({
        defaults: { responsibilities: {
          fees_collector: "application",
          losses_collector: lossesCollector,
        } },
      }));
      await expect(assertStripeAccountCoversProcessing(routing))
        .rejects.toBeInstanceOf(StripeConnectFeeConfigurationError);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.upsert).not.toHaveBeenCalled();
    },
  );

  it.each([
    { id: "acct_other" },
    { livemode: true },
    { closed: true },
    { defaults: null },
  ])("rejects missing or mismatched Stripe state: %j", async (overrides) => {
    mocks.retrieve.mockResolvedValue(account(overrides));
    await expect(assertStripeAccountCoversProcessing(routing))
      .rejects.toMatchObject({ code: "STRIPE_DIRECTOR_FEE_CONFIGURATION_REQUIRED" });
  });

  it("rejects absent accounts and wrong environments before calling Stripe", async () => {
    await expect(assertStripeAccountCoversProcessing({ ...routing, connectedAccountId: null }))
      .rejects.toBeInstanceOf(StripeConnectFeeConfigurationError);
    await expect(assertStripeAccountCoversProcessing({ ...routing, environment: "live" }))
      .rejects.toBeInstanceOf(StripeConnectFeeConfigurationError);
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("fails closed if Stripe cannot verify the account", async () => {
    const error = new Error("Stripe is unavailable");
    mocks.retrieve.mockRejectedValueOnce(error);
    await expect(assertStripeAccountCoversProcessing(routing)).rejects.toBe(error);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("connected account setup and history", () => {
  const organization = { contactEmail: "director@example.com", displayName: "Director Events", organizationId: 7 };

  it("creates tiered accounts with Express, platform-paid processing and Stripe-owned losses", async () => {
    mocks.create.mockResolvedValue(account({ dashboard: "express" }));
    const result = await createOrganizationStripeAccount(organization);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      dashboard: "express",
      defaults: expect.objectContaining({ responsibilities: { fees_collector: "application", losses_collector: "stripe" } }),
    }), { idempotencyKey: "tournibase-connect-test-7-express-v2", ...CONNECT_PREVIEW_OPTIONS });
    expect(result.dashboard).toBe("express");
    expect(result.losses_collector).toBe("stripe");
  });

  it("never retries rejected Express configuration with platform-owned losses", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Preview unavailable"));
    await expect(createOrganizationStripeAccount(organization)).rejects.toThrow("Preview unavailable");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("preserves legacy fee policy creation behavior", async () => {
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "");
    mocks.create.mockResolvedValue(account({ defaults: { responsibilities: {
      fees_collector: "stripe", losses_collector: "stripe",
    } } }));
    const result = await createOrganizationStripeAccount(organization);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      dashboard: "full",
    }), { idempotencyKey: "tournibase-connect-test-7" });
    expect(mocks.create.mock.calls[0][0].defaults.responsibilities).toEqual({
      fees_collector: "stripe", losses_collector: "stripe",
    });
    expect(result.fees_collector).toBe("stripe");
  });

  it("preserves and synchronizes an existing account instead of creating a replacement", async () => {
    const legacyAccount = account({ defaults: { responsibilities: {
      fees_collector: "stripe", losses_collector: "stripe",
    } } });
    existing = mapStripeAccountState(legacyAccount, 7);
    mocks.retrieve.mockResolvedValue(legacyAccount);
    const result = await createOrganizationStripeAccount(organization);
    expect(result.stripe_account_id).toBe("acct_director");
    expect(result.fees_collector).toBe("stripe");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("preserves Stripe errors for legacy account creation without trying another configuration", async () => {
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "");
    const error = new Error("Stripe account creation unavailable");
    mocks.create.mockRejectedValueOnce(error);
    await expect(createOrganizationStripeAccount(organization)).rejects.toMatchObject({
      message: error.message,
    });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("synchronizes existing platform-paid accounts without replacements", async () => {
    existing = mapStripeAccountState(account(), 7);
    const result = await createOrganizationStripeAccount(organization);
    expect(result.stripe_account_id).toBe(existing.stripe_account_id);
    expect(result.fees_collector).toBe("application");
    expect(getStripeConnectStatus(result)).toBe("ready");
    expect(mocks.retrieve).toHaveBeenCalledWith("acct_director", expect.objectContaining({
      include: expect.arrayContaining(["defaults"]),
    }), CONNECT_PREVIEW_OPTIONS);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("records an unknown fee payer without inventing historical processing responsibility", () => {
    expect(mapStripeAccountState(account({ defaults: null }), 7).fees_collector).toBeNull();
  });
});

describe("director dashboard access", () => {
  const routing = { connectedAccountId: "acct_director", environment: "test" as const };
  it("creates an account-specific Express link even for historical order access", async () => {
    mocks.retrieve.mockResolvedValue(account({ dashboard: "express" }));
    mocks.login.mockResolvedValue({ url: "https://connect.stripe.com/express/single-use" });
    expect(await createStripeDirectorDashboardUrl({ ...routing, paymentIntentId: "pi_old" })).toBe("https://connect.stripe.com/express/single-use");
    expect(mocks.login).toHaveBeenCalledWith("acct_director");
  });
  it("keeps full-dashboard payment deep links for historical accounts", async () => {
    expect(await createStripeDirectorDashboardUrl({ ...routing, paymentIntentId: "pi_old" })).toBe("https://dashboard.stripe.com/acct_director/test/payments/pi_old");
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it.each([{ livemode: true }, { closed: true }, { id: "acct_other" }, { dashboard: "none" }, { dashboard: null }])("fails closed for unavailable accounts: %j", async (override) => {
    mocks.retrieve.mockResolvedValue(account(override));
    await expect(createStripeDirectorDashboardUrl(routing)).rejects.toThrow();
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("rejects a different environment before contacting Stripe", async () => {
    await expect(createStripeDirectorDashboardUrl({ ...routing, environment: "live" })).rejects.toThrow();
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });
});

describe("public paid checkout availability", () => {
  it.each(["stripe", null])("identifies an existing %s fee payer as needing support in the tier policy", async (feesCollector) => {
    existing = { ...mapStripeAccountState(account(), 7), fees_collector: feesCollector };
    expect(await isOrganizationStripeProcessingSetupRequired(7)).toBe(true);
  });

  it("keeps onboarding available for an account that is not connected yet", async () => {
    expect(await isOrganizationStripeProcessingSetupRequired(7)).toBe(false);
  });

  it("does not require support for platform-paid or legacy-policy accounts", async () => {
    existing = mapStripeAccountState(account(), 7);
    expect(await isOrganizationStripeProcessingSetupRequired(7)).toBe(false);
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "");
    existing.fees_collector = "stripe";
    expect(await isOrganizationStripeProcessingSetupRequired(7)).toBe(false);
  });

  it("requires ordinary account readiness before checking fee responsibility", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await isOrganizationStripeAccountReady(7)).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each(["stripe", null, "application_express"])(
    "does not offer tiered paid tickets when the cached fee payer is %s",
    async (feesCollector) => {
      existing = { ...mapStripeAccountState(account(), 7), fees_collector: feesCollector };
      expect(await isOrganizationStripeAccountReady(7)).toBe(false);
      expect(mocks.retrieve).not.toHaveBeenCalled();
    },
  );

  it("offers tiered paid tickets for a ready platform-paid account", async () => {
    existing = mapStripeAccountState(account(), 7);
    expect(await isOrganizationStripeAccountReady(7)).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("organization_stripe_account_is_ready", {
      p_organization_id: 7, p_stripe_environment: "test",
    });
  });

  it.each([null, "application"])("blocks cached %s loss ownership even with platform-paid processing", async (lossesCollector) => {
    existing = { ...mapStripeAccountState(account(), 7), losses_collector: lossesCollector };
    expect(await isOrganizationStripeAccountReady(7)).toBe(false);
    expect(await isOrganizationStripeProcessingSetupRequired(7)).toBe(true);
  });

  it("fails closed when the account snapshot is missing", async () => {
    expect(await isOrganizationStripeAccountReady(7)).toBe(false);
  });

  it("preserves availability under the legacy fee policy", async () => {
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "");
    expect(await isOrganizationStripeAccountReady(7)).toBe(true);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
