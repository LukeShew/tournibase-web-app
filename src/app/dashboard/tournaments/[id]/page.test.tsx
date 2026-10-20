import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: vi.fn(), from: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/components/revenue-trend-card", () => ({ RevenueTrendCard: () => null }));
vi.mock("@/lib/auth", () => ({ requireDirector: async () => ({ id: "director" }) }));
vi.mock("@/lib/app-environment", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/app-environment")>(),
  getAppEnvironment: () => "test",
}));
vi.mock("@/lib/stripe-connect", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/stripe-connect")>(),
  getOrganizationStripeAccount: mocks.account,
  getStripeConnectConfigurationIssues: () => [],
}));
vi.mock("@/lib/dashboard-metrics", () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  getTournamentDashboardMetrics: async () => ({
    salesByDay: [],
    sales: { onlineTicketsSold: 0, totalEstimatedRevenue: 0, manualAdmissions: 0 },
    gate: { checkedInPasses: 0, unscannedPasses: 0, duplicateAttempts: 0 },
  }),
}));
vi.mock("@/lib/tournaments", () => ({ formatEventDateRange: () => "October 24–25" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from }) }));

import TournamentOverviewPage from "./page";

let hasPaidTickets: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "per_ticket_v2");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_BPS", "400");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_FIXED_CENTS", "100");
  hasPaidTickets = true;
  mocks.account.mockResolvedValue({
    account_closed: false, onboarding_complete: true, charges_enabled: true, payouts_enabled: true,
    card_payments_status: "active", payouts_status: "active", requirements_currently_due: [],
    requirements_past_due: [], requirements_pending_verification: [], disabled_reason: null,
    fees_collector: "stripe", losses_collector: "stripe",
  });
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query, gt: () => query,
      then: (resolve: (value: unknown) => unknown) => resolve({ data: [{ id: 7 }], error: null }),
      maybeSingle: async () => ({
        data: { id: 12, organization_id: 7, name: "Weekend Classic", public_slug: "weekend-classic",
          status: "published", start_date: "2026-10-24", end_date: "2026-10-25" },
        error: null,
      }),
      limit: async () => ({ data: hasPaidTickets ? [{ id: 1 }] : [], error: null }),
    };
    if (!["organizations", "tournaments", "ticket_types"].includes(table)) throw new Error("Unexpected table");
    return query;
  });
});
afterEach(() => vi.unstubAllEnvs());

async function render() {
  return renderToStaticMarkup(await TournamentOverviewPage({ params: Promise.resolve({ id: "12" }) }));
}

describe("event overview payment setup tool", () => {
  it.each(["stripe", null])("links to support settings for a tiered %s fee payer", async (feesCollector) => {
    const existing = await mocks.account();
    mocks.account.mockResolvedValue({ ...existing, fees_collector: feesCollector });
    const html = await render();
    expect(html).toContain('href="/dashboard/settings?event=12"');
    expect(html).toContain("Finish payment setup");
    expect(html).toContain("Contact TourniBase support");
    expect(html).not.toContain('action="/api/stripe/connect/start"');
    expect(html.indexOf("Finish payment setup")).toBeLessThan(html.indexOf("View public ticket page"));
  });

  it("keeps the Connect Stripe action for an unconnected organization", async () => {
    mocks.account.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain('action="/api/stripe/connect/start"');
    expect(html).not.toContain("Finish payment setup");
  });

  it("hides the setup tool for an eligible tiered account", async () => {
    const existing = await mocks.account();
    mocks.account.mockResolvedValue({ ...existing, fees_collector: "application" });
    const html = await render();
    expect(html).not.toContain("Finish payment setup");
    expect(html).not.toContain("Connect Stripe");
  });

  it("leaves legacy-policy ready accounts unchanged", async () => {
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "");
    const html = await render();
    expect(html).not.toContain("Finish payment setup");
    expect(html).not.toContain("Connect Stripe");
  });

  it("does not require processing setup for a free event", async () => {
    hasPaidTickets = false;
    expect(await render()).not.toContain("Finish payment setup");
  });
});
