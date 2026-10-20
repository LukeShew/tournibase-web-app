import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getOrderPassRefundAmountCents, hasPaidPassValue, OrderLogClient, RefundLifecycleNotice, StripePaymentReviewNotice, type OrderLogOrder, type OrderLogPass } from "./order-log-client";

const pass: OrderLogPass = {
  id: 1,
  order_item_id: 10,
  public_token: "sample-pass",
  sequence_number: 1,
  status: "active",
  ticket_types: { name: "Saturday" },
};
const order: OrderLogOrder = {
  id: 1,
  buyer_email: "buyer@example.com",
  buyer_name: "Sample Buyer",
  buyer_phone: null,
  buyer_fee_amount: "0.90",
  amount_total: "30.90",
  amount_refunded: "0.00",
  created_at: "2026-10-17T12:00:00Z",
  payment_status: "paid",
  stripe_checkout_id: "cs_live_example",
  stripe_connected_account_id: "acct_example",
  stripe_environment: "live",
  stripe_payment_intent_id: "pi_example",
  order_items: [{ id: 10, quantity: 3, ticket_name: "Saturday", unit_amount_cents: 1000, valid_from: "2026-10-17T00:00:00Z", valid_until: "2026-10-18T00:00:00Z" }],
  passes: [pass],
};

describe("buyer fee in director order details", () => {
  it("does not offer a Stripe refund for free passes or missing items", () => {
    expect(hasPaidPassValue(order, pass)).toBe(true);
    expect(hasPaidPassValue({ ...order, order_items: [{ ...order.order_items[0], unit_amount_cents: 0 }] }, pass)).toBe(false);
    expect(hasPaidPassValue(order, { ...pass, order_item_id: 999 })).toBe(false);
  });
  it("does not invite an app retry after a failed refund", () => {
    const html = renderToStaticMarkup(<StripePaymentReviewNotice order={{ ...order, refund_failed_amount: "10.30" }} />);
    expect(html).toContain("directly in Stripe");
    expect(html).toContain("contact support before restoring a blocked pass");
    expect(html).not.toContain("Use the TourniBase refund controls so");
  });
  it("keeps normal refund guidance when no attempt has failed", () => {
    expect(renderToStaticMarkup(<StripePaymentReviewNotice order={order} />))
      .toContain("Use the TourniBase refund controls so");
  });
  it("keeps pending and failed refund warnings visible after a reload", () => {
    const changed = { ...order, refund_pending_amount: "10.30", refund_failed_amount: "10.30" };
    const list = renderToStaticMarkup(<OrderLogClient currentStripeEnvironment="live" orders={[changed]} tournamentId={1} />);
    expect(list).toContain("Refund pending");
    expect(list).toContain("Refund needs review");
    const detail = renderToStaticMarkup(<RefundLifecycleNotice order={changed} />);
    expect(detail).toContain("$10.30");
    expect(detail).toContain("not included in the completed refund total");
    expect(detail).toContain("Previously canceled passes stay blocked");
    expect(renderToStaticMarkup(<RefundLifecycleNotice order={order} />)).toBe("");
  });
  it("clearly labels the charged amount as the buyer total", () => {
    const html = renderToStaticMarkup(<OrderLogClient currentStripeEnvironment="live" orders={[order]} tournamentId={1} />);
    expect(html).toContain("Buyer total");
    expect(html).toContain("$30.90");
  });

  it("includes each pass's buyer-fee share in the refund confirmation amount", () => {
    expect(getOrderPassRefundAmountCents(order, pass)).toBe(1030);
    expect(getOrderPassRefundAmountCents({ ...order, buyer_fee_amount: "0.00", amount_total: "30.00" }, pass)).toBe(1000);
  });

  it("shows the original per-ticket fee for tiered orders instead of a proportional share", () => {
    const tiered: OrderLogOrder = { ...order, fee_policy: "per_ticket_v2", buyer_fee_amount: "3.80", amount_total: "43.80",
      order_items: [
        { ...order.order_items[0], quantity: 2, buyer_fee_unit_amount_cents: 100 },
        { ...order.order_items[0], id: 11, quantity: 1, unit_amount_cents: 2000, buyer_fee_unit_amount_cents: 180 },
      ],
    };
    expect(getOrderPassRefundAmountCents(tiered, pass)).toBe(1100);
    expect(getOrderPassRefundAmountCents(tiered, { ...pass, order_item_id: 11 })).toBe(2180);
    expect(() => getOrderPassRefundAmountCents({ ...tiered,
      order_items: tiered.order_items.map((item) => ({ ...item, buyer_fee_unit_amount_cents: null })),
    }, pass)).toThrow();
  });

  it("distributes fractional cents without overstating the sum refunded", () => {
    const withRemainder = { ...order, buyer_fee_amount: "1.00", amount_total: "31.00" };
    const amounts = [1, 2, 3].map((sequence_number) => getOrderPassRefundAmountCents(withRemainder, { ...pass, sequence_number }));
    expect(amounts).toEqual([1034, 1033, 1033]);
    expect(amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)).toBe(3100);
  });
});
