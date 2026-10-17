import "server-only";

import type Stripe from "stripe";
import {
  getStripeRequestOptions,
  type StripePaymentRouting,
} from "@/lib/stripe-connect-payments";

/** Keep refund retries safe even after Stripe's idempotency-key retention ends. */
export async function createOrRetrieveStripeRefund({
  stripe,
  routing,
  orderId,
  passId,
  paymentIntentId,
  amountCents,
  platformFeeAmount,
  buyerFeeAmount = 0,
  buyerFeeRefundCents = 0,
}: {
  stripe: Stripe;
  routing: StripePaymentRouting;
  orderId: number;
  passId?: number;
  paymentIntentId: string;
  amountCents?: number;
  platformFeeAmount: number | string;
  buyerFeeAmount?: number | string;
  buyerFeeRefundCents?: number;
}): Promise<Stripe.Refund> {
  const fee = Number(platformFeeAmount);
  const buyerFeeCents = Math.round(Number(buyerFeeAmount) * 100);

  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("The order application fee is invalid.");
  }
  if (!Number.isSafeInteger(buyerFeeCents) || buyerFeeCents < 0 ||
      !Number.isSafeInteger(buyerFeeRefundCents) || buyerFeeRefundCents < 0 ||
      buyerFeeRefundCents > buyerFeeCents ||
      (passId !== undefined && (!Number.isSafeInteger(amountCents) ||
        (amountCents ?? 0) <= 0 || buyerFeeRefundCents > (amountCents ?? 0)))) {
    throw new Error("The buyer fee refund amount is invalid.");
  }

  // A previous refund can have succeeded while its database synchronization
  // failed. Reuse it instead of refunding this pass/order again, including when
  // it is still pending. Do not assume the first 100 refunds are the whole list.
  for await (const existing of stripe.refunds.list(
    { payment_intent: paymentIntentId, limit: 100 },
    getStripeRequestOptions(routing),
  )) {
    const sameOrder = existing.metadata?.order_id === String(orderId);
    const samePass = passId === undefined
      ? !existing.metadata?.pass_id
      : existing.metadata?.pass_id === String(passId);

    if (sameOrder && samePass) {
      if (existing.status === "failed" || existing.status === "canceled") {
        throw new Error("The previous refund needs review in Stripe before retrying.");
      }

      return existing;
    }
  }

  const originalKey = passId === undefined
    ? `tournibase-order-refund-${orderId}`
    : `tournibase-pass-refund-${passId}`;

  return stripe.refunds.create(
    {
      ...(amountCents === undefined ? {} : { amount: amountCents }),
      metadata: {
        order_id: String(orderId),
        ...(passId === undefined ? {} : { pass_id: String(passId) }),
        ...(buyerFeeCents > 0 && passId !== undefined ? {
          buyer_fee_policy: "buyer_fee_v1",
          buyer_fee_refund_cents: String(buyerFeeRefundCents),
          ticket_refund_cents: String(amountCents! - buyerFeeRefundCents),
        } : {}),
      },
      payment_intent: paymentIntentId,
      // Buyer-fee orders reverse their exact allocated fee during sync, avoiding
      // Stripe's per-refund proportional rounding. Historical orders keep their
      // original application-fee refund behavior.
      ...(fee > 0 && buyerFeeCents === 0 ? { refund_application_fee: true } : {}),
    },
    getStripeRequestOptions(
      routing,
      // Old zero-fee requests were rejected for asking to refund a nonexistent
      // fee. Use a stable new key for the corrected parameters; preserve keys
      // for fee-bearing requests. Never generate a fresh key on each retry.
      buyerFeeCents > 0 ? `${originalKey}-buyer-fee-v1`
        : fee > 0 ? originalKey : `${originalKey}-no-fee-v2`,
    ),
  );
}
