type RefundSnapshot = { id: string; amount: number; status: string | null };

/** Financial totals include only refunds Stripe currently says succeeded. */
export function getRefundLifecycle(refunds: RefundSnapshot[], chargeAmountCents: number) {
  let succeededCents = 0;
  let pendingCents = 0;
  let failedCents = 0;
  const seen = new Set<string>();
  for (const refund of refunds) {
    if (!refund.id || !Number.isSafeInteger(refund.amount) || refund.amount < 0) {
      throw new Error("Stripe returned an invalid refund snapshot.");
    }
    if (seen.has(refund.id)) continue;
    seen.add(refund.id);
    if (refund.status === "succeeded") succeededCents += refund.amount;
    else if (refund.status === "pending" || refund.status === "requires_action") pendingCents += refund.amount;
    else if (refund.status === "failed" || refund.status === "canceled") failedCents += refund.amount;
    else throw new Error("Stripe returned an unknown refund status. Review the refund before retrying.");
  }
  if (succeededCents + pendingCents > chargeAmountCents) {
    throw new Error("Stripe refund totals changed during synchronization. Retry the event.");
  }
  return { succeededCents, pendingCents, failedCents };
}
