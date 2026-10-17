import { describe, expect, it } from "vitest";
import { buildCheckoutLineItems } from "./checkout-pricing";

const ticket = { name: "Saturday pass", description: null, quantity: 1, unit_amount_cents: 1000 };
const live = { basisPoints: 200, fixedCents: 30 };
const reservation = {
  items: [ticket], ticketSubtotalCents: 1000, buyerFeeCents: 50,
  platformFeeCents: 50, amountTotalCents: 1050, feeConfiguration: live,
};

describe("buyer-paid checkout pricing", () => {
  it("charges $10.50 for a $10 ticket and routes only the added $0.50 as the platform fee", () => {
    const items = buildCheckoutLineItems(reservation);
    expect(items.map((item) => [item.quantity, item.price_data?.unit_amount])).toEqual([[1, 1000], [1, 50]]);
    expect(items[1].price_data?.product_data?.name).toBe("TourniBase service fee");
    const buyerCharge = items.reduce((sum, item) => sum + item.quantity! * item.price_data!.unit_amount!, 0);
    expect(buyerCharge - reservation.platformFeeCents).toBe(1000);
  });

  it("adds one fee per order, including mixed prices and quantities", () => {
    const items = buildCheckoutLineItems({
      ...reservation,
      items: [{ ...ticket, quantity: 2 }, { ...ticket, name: "Weekend", unit_amount_cents: 1499 }],
      ticketSubtotalCents: 3499, buyerFeeCents: 100, platformFeeCents: 100, amountTotalCents: 3599,
    });
    expect(items).toHaveLength(3);
    expect(items[2]).toMatchObject({ quantity: 1, price_data: { unit_amount: 100 } });
  });

  it("omits the fee line in zero-fee staging and for complimentary orders", () => {
    expect(buildCheckoutLineItems({ ...reservation, buyerFeeCents: 0, platformFeeCents: 0, amountTotalCents: 1000, feeConfiguration: { basisPoints: 0, fixedCents: 0 } })).toHaveLength(1);
    expect(buildCheckoutLineItems({ ...reservation, items: [{ ...ticket, unit_amount_cents: 0 }], ticketSubtotalCents: 0, buyerFeeCents: 0, platformFeeCents: 0, amountTotalCents: 0 })).toHaveLength(1);
  });

  it("rejects old subtractive reservations and mismatched fee/total snapshots before contacting Stripe", () => {
    for (const overrides of [
      { amountTotalCents: 1000 }, { buyerFeeCents: 49 }, { platformFeeCents: 0 },
      { ticketSubtotalCents: 999 }, { amountTotalCents: Number.NaN },
      { items: [{ ...ticket, unit_amount_cents: 900 }] },
    ]) {
      expect(() => buildCheckoutLineItems({ ...reservation, ...overrides })).toThrow();
    }
  });

  it("handles fractional-cent percentage rounding without charging a fee on the fee", () => {
    const items = buildCheckoutLineItems({ ...reservation, items: [{ ...ticket, unit_amount_cents: 1025 }], ticketSubtotalCents: 1025, buyerFeeCents: 51, platformFeeCents: 51, amountTotalCents: 1076 });
    expect(items[1].price_data?.unit_amount).toBe(51);
  });
});
