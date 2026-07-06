import { describe, expect, it } from "vitest";
import {
  getRefundPaymentStatusForCharge,
  parseStripeOrderIdMetadata,
} from "./order-refunds";

describe("order refund helpers", () => {
  it("reads a positive TourniBase order ID from Stripe metadata", () => {
    expect(parseStripeOrderIdMetadata({ order_id: "123" })).toBe(123);
    expect(parseStripeOrderIdMetadata({ order_id: "0" })).toBeNull();
    expect(parseStripeOrderIdMetadata({ order_id: "abc" })).toBeNull();
    expect(parseStripeOrderIdMetadata({})).toBeNull();
  });

  it("maps Stripe refund amounts to TourniBase payment status", () => {
    expect(
      getRefundPaymentStatusForCharge({
        amount: 2500,
        amount_refunded: 0,
      }),
    ).toBeNull();
    expect(
      getRefundPaymentStatusForCharge({
        amount: 2500,
        amount_refunded: 1000,
      }),
    ).toBe("partial_refund");
    expect(
      getRefundPaymentStatusForCharge({
        amount: 2500,
        amount_refunded: 2500,
      }),
    ).toBe("refunded");
  });
});
