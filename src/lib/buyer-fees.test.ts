import { describe, expect, it } from "vitest";
import { getBuyerFeeFundingTargetCents, getBuyerFeeRefundedCents, getPassBuyerFeeCents, type BuyerFeeOrderItem } from "./buyer-fees";

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

  it("refunds the charged fee for each ticket instead of spreading new tiered fees by price", () => {
    const items = [
      { id: 1, quantity: 2, unit_amount_cents: 1500, buyer_fee_unit_amount_cents: 160 },
      { id: 2, quantity: 1, unit_amount_cents: 500, buyer_fee_unit_amount_cents: 100 },
      { id: 3, quantity: 1, unit_amount_cents: 1001, buyer_fee_unit_amount_cents: 140 },
      { id: 4, quantity: 2, unit_amount_cents: 0, buyer_fee_unit_amount_cents: 0 },
    ];
    expect(shares(items, 560)).toEqual([160, 160, 100, 140, 0, 0]);
    expect(shares([...items].reverse(), 560)).toEqual([0, 0, 140, 100, 160, 160]);
  });

  it("uses saved fees even if the current pricing rules would charge something different", () => {
    const items = [{ id: 1, quantity: 2, unit_amount_cents: 1500, buyer_fee_unit_amount_cents: 175 }];
    expect(shares(items, 350)).toEqual([175, 175]);
    expect(shares([{ ...items[0], buyer_fee_unit_amount_cents: 0 }], 0)).toEqual([0, 0]);
  });

  it("rejects incomplete, invalid or inconsistent saved fees before requesting a refund", () => {
    const item = { id: 1, quantity: 1, unit_amount_cents: 1500, buyer_fee_unit_amount_cents: 160 };
    const input = { buyerFeeCents: 160, orderItems: [item], orderItemId: 1, sequenceNumber: 1 };
    expect(() => getPassBuyerFeeCents({ ...input, buyerFeeCents: 159 })).toThrow("original order fee");
    expect(() => getPassBuyerFeeCents({ ...input, buyerFeeCents: 0 })).toThrow("original order fee");
    expect(() => getPassBuyerFeeCents({ ...input, orderItems: [item, { id: 2, quantity: 1, unit_amount_cents: 500 }] })).toThrow("missing");
    expect(() => getPassBuyerFeeCents({ ...input, orderItems: [{ ...item, buyer_fee_unit_amount_cents: -1 }] })).toThrow("nonnegative");
    expect(() => getPassBuyerFeeCents({ ...input, orderItems: [{ ...item, buyer_fee_unit_amount_cents: 1.5 }] })).toThrow("nonnegative");
    expect(() => getPassBuyerFeeCents({ ...input, orderItems: [{ ...item, unit_amount_cents: 0 }] })).toThrow("Complimentary");
    expect(() => getPassBuyerFeeCents({ ...input, feePolicy: "per_ticket_v2", orderItems: [{ ...item, buyer_fee_unit_amount_cents: null }] })).toThrow("missing");
    expect(() => getPassBuyerFeeCents({ ...input, buyerFeeCents: 0, feePolicy: "per_ticket_v2", orderItems: [{ ...item, buyer_fee_unit_amount_cents: null }] })).toThrow("missing");
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

  it("apportions external refunds over the remaining fee after rounded pass shares", () => {
    const known = Array.from({ length: 6 }, (_, index) => refund(`re_${index + 4}`, 1023, 23));
    const actual = getBuyerFeeRefundedCents({ orderId: 1, buyerFeeCents: 210,
      chargeAmountCents: 9210, chargeAmountRefundedCents: 9209,
      refunds: [...known, { id: "re_external", amount: 3071, status: "succeeded", metadata: {} }],
    });
    expect(actual).toBe(210);
    expect(9209 - actual).toBeLessThanOrEqual(9000);
  });

  it("keeps both ticket and fee refunds within their original balances for every residual amount", () => {
    for (const known of [refund("re_1", 1024, 24), refund("re_2", 1023, 23)]) {
      let previous = 0;
      for (let external = 0; external <= 3070 - known.amount; external += 1) {
        const total = known.amount + external;
        const fee = getBuyerFeeRefundedCents({ ...input, chargeAmountRefundedCents: total,
          refunds: [known, { id: "re_external", amount: external, status: "succeeded", metadata: {} }],
        });
        expect(fee).toBeGreaterThanOrEqual(previous);
        expect(fee).toBeLessThanOrEqual(70);
        expect(total - fee).toBeLessThanOrEqual(3000);
        previous = fee;
      }
    }
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

describe("bounded application-fee funding for pending refunds", () => {
  const pendingInput = {
    orderId: 1,
    buyerFeeCents: 260,
    chargeAmountCents: 2260,
    chargeAmountRefundedCents: 0,
    expectedPassRefunds: new Map([
      [1, { ticketCents: 500, buyerFeeCents: 100 }],
      [2, { ticketCents: 1500, buyerFeeCents: 160 }],
    ]),
  };
  const pendingPass = (id: number, amount: number, fee: number) => ({
    ...refund(`re_${id}`, amount, fee, "pending"), pending_reason: "insufficient_funds",
  });
  const full = {
    id: "re_full", amount: 2260, status: "pending", pending_reason: "insufficient_funds",
    metadata: { order_id: "1" },
  };

  it("funds only the original fee for an insufficient-funds whole-order refund", () => {
    expect(getBuyerFeeFundingTargetCents({ ...pendingInput, refunds: [full] })).toBe(260);
    expect(getBuyerFeeRefundedCents({ ...pendingInput, refunds: [full] })).toBe(0);
  });

  it("uses exact mixed-pass fees instead of proportional advances", () => {
    const child = pendingPass(1, 600, 100);
    expect(getBuyerFeeFundingTargetCents({ ...pendingInput, refunds: [child] })).toBe(100);
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput, refunds: [child, pendingPass(2, 1660, 160)],
    })).toBe(260);
  });

  it("deduplicates deliveries and combines a successful pass with an eligible remaining-order refund", () => {
    const child = refund("re_1", 600, 100);
    const remaining = { ...full, amount: 1660 };
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput, chargeAmountRefundedCents: 600, refunds: [child, remaining, remaining],
    })).toBe(260);
    expect(getBuyerFeeRefundedCents({
      ...pendingInput, chargeAmountRefundedCents: 600, refunds: [child, remaining],
    })).toBe(100);
  });

  it.each([
    { status: "pending", pending_reason: "processing" },
    { status: "pending", pending_reason: null },
    { status: "requires_action", pending_reason: "insufficient_funds" },
    { status: "failed", pending_reason: "insufficient_funds" },
    { status: "canceled", pending_reason: "insufficient_funds" },
  ])("does not fund a refund with status/reason %j", (state) => {
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput, refunds: [{ ...full, ...state }],
    })).toBe(0);
  });

  it("does not guess a fee for an external or incomplete whole-order partial refund", () => {
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput, refunds: [{ ...full, amount: 600, metadata: {} }],
    })).toBe(0);
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput, refunds: [{ ...full, amount: 600 }],
    })).toBe(0);
  });

  it("does not fund the remainder while a different refund is still processing", () => {
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput,
      refunds: [{ ...pendingPass(1, 600, 100), pending_reason: "processing" }, { ...full, amount: 1660 }],
    })).toBe(0);
  });

  it("rejects tampered pass metadata even if pending refunds sum to the entire charge", () => {
    const child = pendingPass(1, 600, 100);
    for (const metadata of [
      { ...child.metadata, buyer_fee_refund_cents: "99", ticket_refund_cents: "501" },
      { ...child.metadata, pass_id: "999" },
      { ...child.metadata, order_id: "2" },
      { ...child.metadata, buyer_fee_refund_cents: "-1" },
    ]) {
      expect(() => getBuyerFeeFundingTargetCents({
        ...pendingInput, refunds: [{ ...child, metadata }, pendingPass(2, 1660, 160)],
      })).toThrow(/metadata/);
    }
    expect(() => getBuyerFeeFundingTargetCents({
      ...pendingInput, expectedPassRefunds: undefined, refunds: [child],
    })).toThrow("original pass");
    expect(() => getBuyerFeeFundingTargetCents({
      ...pendingInput, refunds: [{ ...full, metadata: { order_id: "1", pass_id: "" } }],
    })).toThrow("metadata");
  });

  it("rejects multiple active refunds of the same pass and inconsistent snapshots", () => {
    const child = pendingPass(1, 600, 100);
    expect(() => getBuyerFeeFundingTargetCents({
      ...pendingInput, refunds: [child, { ...child, id: "re_duplicate_pass" }],
    })).toThrow("same pass");
    expect(() => getBuyerFeeFundingTargetCents({
      ...pendingInput, refunds: [child, { ...child, amount: 601 }],
    })).toThrow("snapshots changed");
    expect(() => getBuyerFeeFundingTargetCents({
      ...pendingInput, refunds: [child, full],
    })).toThrow("totals changed");
  });

  it("retains successful fee accounting when an eligible request later succeeds or fails", () => {
    const pending = pendingPass(2, 1660, 160);
    const child = refund("re_1", 600, 100);
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput, chargeAmountRefundedCents: 600, refunds: [child, pending],
    })).toBe(260);
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput, chargeAmountRefundedCents: 2260,
      refunds: [child, { ...pending, status: "succeeded" }],
    })).toBe(260);
    expect(getBuyerFeeFundingTargetCents({
      ...pendingInput, chargeAmountRefundedCents: 600,
      refunds: [child, { ...pending, status: "failed" }],
    })).toBe(100);
  });
});
