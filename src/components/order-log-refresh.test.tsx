import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: vi.fn(actual.useState) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { OrderLogClient, type OrderLogOrder } from "./order-log-client";

const order: OrderLogOrder = {
  id: 1, buyer_email: "buyer@example.com", buyer_name: "Buyer", buyer_phone: null,
  buyer_fee_amount: "0.00", amount_total: "10.00", amount_refunded: "0.00",
  created_at: "2026-10-17T12:00:00Z", payment_status: "paid",
  stripe_checkout_id: "cs_test_example", stripe_connected_account_id: "acct_example",
  stripe_environment: "test", stripe_payment_intent_id: "pi_example",
  order_items: [], passes: [],
};

// Simulate the selected-ID state preserved by router.refresh; the rest of the
// component's hooks use React normally. The refreshed server props are new.
function renderSelected(orders: OrderLogOrder[]) {
  vi.mocked(useState).mockReturnValueOnce([1, vi.fn()]);
  return renderToStaticMarkup(<OrderLogClient currentStripeEnvironment="test" orders={orders} tournamentId={1} />);
}

afterEach(() => vi.clearAllMocks());

describe("open order details after a server refresh", () => {
  it("uses the selected order's latest refund totals and controls", () => {
    const initial = renderSelected([order]);
    expect(initial).toContain('role="dialog"');
    expect(initial).toContain("Refund remaining order");
    expect(initial).toMatch(/Amount refunded<\/p><p[^>]*>\$0\.00/);

    const refreshed = renderSelected([{ ...order, amount_refunded: "10.00", payment_status: "refunded" }]);
    expect(refreshed).toContain('role="dialog"');
    expect(refreshed).not.toContain("Refund remaining order");
    expect(refreshed).toMatch(/Amount refunded<\/p><p[^>]*>\$10\.00/);
  });

  it("does not keep showing an order removed from refreshed results", () => {
    expect(renderSelected([{ ...order, id: 2 }])).not.toContain('role="dialog"');
  });
});
