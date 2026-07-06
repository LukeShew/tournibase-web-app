import type Stripe from "stripe";

export function getRefundPaymentStatusForCharge({
  amount,
  amount_refunded,
}: {
  amount: number;
  amount_refunded: number;
}): "refunded" | "partial_refund" | null {
  if (amount_refunded <= 0) {
    return null;
  }

  return amount_refunded >= amount ? "refunded" : "partial_refund";
}

export function parseStripeOrderIdMetadata(
  metadata: Stripe.Metadata | null | undefined,
) {
  const rawOrderId = metadata?.order_id;

  if (!rawOrderId || !/^\d+$/.test(rawOrderId)) {
    return null;
  }

  const orderId = Number(rawOrderId);

  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}
