import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/app/dashboard/settings/actions", () => ({ updateDirectorName: async () => {} }));
vi.mock("@/components/profile-avatar-picker", () => ({ ProfileAvatarPicker: () => null }));
vi.mock("@/components/stripe-connect-status-poller", () => ({ StripeConnectStatusPoller: () => null }));
vi.mock("@/lib/auth", () => ({
  requireDirectorWorkspace: async () => ({
    director: { name: "Director", email: "director@example.com", avatarId: "basketball" },
    organization: { id: 7, name: "Director Events" },
  }),
}));
vi.mock("@/lib/app-environment", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/app-environment")>(),
  getAppEnvironment: () => "test",
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from }) }));

import SettingsPage from "./page";

let account: Record<string, unknown> | null;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "per_ticket_v2");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_BPS", "400");
  vi.stubEnv("TOURNIBASE_PLATFORM_FEE_FIXED_CENTS", "100");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
  vi.stubEnv("TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID", "acct_platform");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.tournibase.com");
  account = {
    organization_id: 7, stripe_account_id: "acct_existing", stripe_environment: "test",
    account_closed: false, onboarding_complete: true, charges_enabled: true, payouts_enabled: true,
    card_payments_status: "active", payouts_status: "active", requirements_currently_due: [],
    requirements_eventually_due: [], requirements_past_due: [], requirements_pending_verification: [],
    disabled_reason: null, fees_collector: "stripe", last_synced_at: null,
  };
  const query = {
    select: (columns: string) => { mocks.select(columns); return query; },
    in: () => query,
    eq: async () => ({ data: account ? [account] : [], error: null }),
  };
  mocks.from.mockReturnValue(query);
});
afterEach(() => vi.unstubAllEnvs());

async function render(searchParams: { payments?: string; organization?: string } = {}) {
  return renderToStaticMarkup(await SettingsPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("settings processing coverage", () => {
  it("does not claim a legacy account is ready for director-free payments", async () => {
    const html = await render();
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining("fees_collector"));
    expect(html).toContain("Processing setup needed");
    expect(html).toContain("Contact support");
    expect(html).toContain("Open Stripe Dashboard");
    expect(html).toContain("Your existing account and past orders are unchanged");
    expect(html).not.toContain("Paid orders can be accepted");
    expect(html).not.toContain("Resolve in Stripe");
    expect(html).not.toContain('action="/api/stripe/connect/start"');
  });

  it("treats missing fee responsibility as unverified, not as ready", async () => {
    account!.fees_collector = null;
    expect(await render()).toContain("Processing setup needed");
  });

  it("shows an actionable notice when new-account creation is unavailable", async () => {
    account = null;
    const html = await render({ payments: "processing_setup_required" });
    expect(html).toContain("Contact TourniBase support to finish payment processing setup");
    expect(html).toContain("Contact support");
    expect(html).not.toContain('action="/api/stripe/connect/start"');
  });

  it("shows ready only when the tiered account actually has platform-paid processing", async () => {
    account!.fees_collector = "application";
    const html = await render();
    expect(html).toContain("Paid orders can be accepted");
    expect(html).toContain("TourniBase covers ordinary payment processing");
    expect(html).not.toContain("Processing setup needed");
    expect(html).not.toContain("processing fees still come out");
  });

  it("keeps legacy account readiness and processing copy unchanged", async () => {
    vi.stubEnv("TOURNIBASE_PLATFORM_FEE_POLICY", "");
    const html = await render();
    expect(html).toContain("Paid orders can be accepted");
    expect(html).toContain("Stripe processing fees still come out");
    expect(html).not.toContain("Processing setup needed");
  });

  it("does not send a wrong-payer account back into status polling after onboarding", async () => {
    const html = await render({ payments: "onboarding_returned", organization: "7" });
    expect(html).toContain("Processing setup needed");
    expect(html).not.toContain("confirming the latest status");
    expect(html).toContain("Refresh status");
  });
});
