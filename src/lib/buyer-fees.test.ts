import { describe, expect, it } from "vitest";
import { getBuyerFeeRefundedCents, getPassBuyerFeeCents, type BuyerFeeOrderItem } from "./buyer-fees";

function shares(items: BuyerFeeOrderItem[], fee: number) {
  return items.flatMap((item) => Array.from({ length: item.quantity }, (_, index) =>
    getPassBuyerFeeCents({ buyerFeeCents: fee, orderItems: items, orderItemId: item.id, sequenceNumber: index + 1 })));
}

describe("buyer fee allocation", () => {
  it("returns every penny once, breaking equal-price ties by item id and sequence", () => {
    const items = [
      { id: 20, quantity: 1, unit_amount_cents: 1000 },
      { id: 10, quantity: 2, unit_amount_cents: 1000 },
    ];
    expect(shares(items, 70)).toEqual([23, 24, 23]);
    expect(shares([...items].reverse(), 70)).toEqual([24, 23, 23]);
  });

  it("weights the fee by ticket price and allocates no fee to complimentary passes", () => {
    expect(shares([
      { id: 1, quantity: 2, unit_amount_cents: 1000 },
      { id: 2, quantity: 1, unit_amount_cents: 2000 },
      { id: 3, quantity: 5, unit_amount_cents: 0 },
    ], 110)).toEqual([28, 27, 55, 0, 0, 0, 0, 0]);
  });

  it("keeps zero-fee and historical tickets unchanged", () => {
    expect(shares([{ id: 1, quantity: 3, unit_amount_cents: 1800 }], 0)).toEqual([0, 0, 0]);
  });

  it("allocates mixed prices and awkward pennies without losing money", () => {
    const items = [
      { id: 1, quantity: 3, unit_amount_cents: 1299 },
      { id: 2, quantity: 5, unit_amount_cents: 875 },
      { id: 3, quantity: 2, unit_amount_cents: 1995 },
    ];
    for (const fee of [1, 2, 37, 275, 999]) {
      const amounts = shares(items, fee);
      expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(fee);
      expect(amounts.every((amount) => Number.isSafeInteger(amount) && amount >= 0)).toBe(true);
      expect(shares(items, fee)).toEqual(amounts);
    }
  });

  it("fails closed on invalid item data or an absent pass sequence", () => {
    const input = { buyerFeeCents: 50, orderItems: [{ id: 1, quantity: 1, unit_amount_cents: 1000 }], orderItemId: 1, sequenceNumber: 1 };
    expect(() => getPassBuyerFeeCents({ ...input, sequenceNumber: 2 })).toThrow();
    expect(() => getPassBuyerFeeCents({ ...input, buyerFeeCents: -1 })).toThrow();
    expect(() => getPassBuyerFeeCents({ ...input, orderItems: [input.orderItems[0], input.orderItems[0]] })).toThrow();
    expect(() => getPassBuyerFeeCents({ ...input, orderItems: [{ id: 1, quantity: 1, unit_amount_cents: 0 }] })).toThrow();
  });
});

const refund = (id: string, amount: number, buyerFee: number, status = "succeeded") => ({
  id, amount, status,
  metadata: { order_id: "1", pass_id: id.replace("re_", ""), buyer_fee_policy: "buyer_fee_v1",
    buyer_fee_refund_cents: String(buyerFee), ticket_refund_cents: String(amount - buyerFee) },
});
const input = { orderId: 1, buyerFeeCents: 70, chargeAmountCents: 3070, chargeAmountRefundedCents: 1024 };

describe("buyer fee refund accounting", () => {
  it("preserves allocated pennies instead of using a proportional estimate", () => {
    expect(getBuyerFeeRefundedCents({ ...input, refunds: [refund("re_1", 1024, 24)] })).toBe(24);
  });

  it("deduplicates deliveries and ignores incomplete refunds", () => {
    const first = refund("re_1", 1024, 24);
    expect(getBuyerFeeRefundedCents({ ...input, refunds: [first, first, refund("re_2", 1023, 23, "pending"), refund("re_3", 1023, 23, "failed")] })).toBe(24);
  });

  it("handles external Stripe refunds proportionally alongside exact pass refunds", () => {
    expect(getBuyerFeeRefundedCents({ ...input, chargeAmountRefundedCents: 1524,
      refunds: [refund("re_1", 1024, 24), { id: "re_external", amount: 500, status: "succeeded", metadata: {} }],
    })).toBe(35);
  });

  it("returns the entire fee on a full refund and zero for legacy fees", () => {
    expect(getBuyerFeeRefundedCents({ ...input, chargeAmountRefundedCents: 3070, refunds: [] })).toBe(70);
    expect(getBuyerFeeRefundedCents({ ...input, buyerFeeCents: 0, refunds: [] })).toBe(0);
  });

  it("does not apply another order's exact metadata", () => {
    const other = refund("re_1", 1024, 24);
    other.metadata.order_id = "2";
    expect(getBuyerFeeRefundedCents({ ...input, refunds: [other] })).toBe(23);
  });

  it("rejects malformed exact metadata and a stale charge total", () => {
    const invalid = refund("re_1", 1024, 24);
    invalid.metadata.buyer_fee_refund_cents = "9999";
    expect(() => getBuyerFeeRefundedCents({ ...input, refunds: [invalid] })).toThrow("metadata");
    expect(() => getBuyerFeeRefundedCents({ ...input, refunds: [refund("re_1", 1024, 24), refund("re_2", 1023, 23)] })).toThrow("changed");
    expect(() => getBuyerFeeRefundedCents({ ...input, refunds: [refund("re_1", 1024, 24)],
      expectedPassRefunds: new Map([[1, { ticketCents: 1000, buyerFeeCents: 23 }]]),
    })).toThrow("original pass");
  });
});
