import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/orders", () => ({ getOrderConfirmation: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripeConfigurationIssues: () => [] }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminConfigurationIssues: () => [] }));

import { metadata } from "./page";

describe("order confirmation privacy", () => {
  it("does not inherit public indexing for bearer checkout links", () => {
    expect(metadata.robots).toEqual({ follow: false, index: false, nocache: true });
  });
});
