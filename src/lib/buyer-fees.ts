export type BuyerFeeOrderItem = {
  id: number;
  quantity: number;
  unit_amount_cents: number;
  buyer_fee_unit_amount_cents?: number | null;
};

export type BuyerFeePolicy = "legacy_order_v1" | "per_ticket_v2";

/** Refund the saved per-ticket fee; legacy order fees retain their original allocation. */
export function getPassBuyerFeeCents({
  buyerFeeCents,
  orderItems,
  orderItemId,
  sequenceNumber,
  feePolicy,
}: {
  buyerFeeCents: number;
  orderItems: BuyerFeeOrderItem[];
  orderItemId: number;
  sequenceNumber: number;
  feePolicy?: BuyerFeePolicy | null;
}): number {
  assertNonnegativeCents(buyerFeeCents, "Buyer fee");
  const hasSnapshots = orderItems.some((item) => item.buyer_fee_unit_amount_cents != null);
  if (buyerFeeCents === 0 && !hasSnapshots && feePolicy !== "per_ticket_v2") return 0;

  const ids = new Set<number>();
  const orderedItems = [...orderItems].sort((left, right) => left.id - right.id);
  for (const item of orderedItems) {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id) ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Order items cannot allocate a buyer fee.");
    }
    ids.add(item.id);
    assertNonnegativeCents(item.unit_amount_cents, "Ticket price");
  }
  const selected = orderedItems.find((item) => item.id === orderItemId);
  if (!selected || !Number.isSafeInteger(sequenceNumber) ||
      sequenceNumber <= 0 || sequenceNumber > selected.quantity) {
    throw new Error("The pass does not match its order item.");
  }

  if (hasSnapshots || feePolicy === "per_ticket_v2") {
    let snapshotTotal = BigInt(0);
    for (const item of orderedItems) {
      const unitFee = item.buyer_fee_unit_amount_cents;
      if (unitFee == null) {
        throw new Error("The original per-ticket buyer fee snapshot is missing.");
      }
      assertNonnegativeCents(unitFee, "Per-ticket buyer fee");
      if (item.unit_amount_cents === 0 && unitFee !== 0) {
        throw new Error("Complimentary passes cannot have a buyer fee.");
      }
      snapshotTotal += BigInt(unitFee) * BigInt(item.quantity);
    }
    if (snapshotTotal !== BigInt(buyerFeeCents)) {
      throw new Error("The per-ticket buyer fees do not match the original order fee.");
    }
    return selected.buyer_fee_unit_amount_cents!;
  }

  const subtotal = orderedItems.reduce(
    (sum, item) => sum + BigInt(item.unit_amount_cents) * BigInt(item.quantity),
    BigInt(0),
  );
  if (subtotal === BigInt(0)) throw new Error("Free orders cannot have a buyer fee.");
  if (selected.unit_amount_cents === 0) return 0;

  const fee = BigInt(buyerFeeCents);
  const allocations = orderedItems.map((item) => {
    const numerator = fee * BigInt(item.unit_amount_cents);
    return { ...item, cents: numerator / subtotal, remainder: numerator % subtotal };
  });
  let remaining = fee - allocations.reduce(
    (sum, item) => sum + item.cents * BigInt(item.quantity),
    BigInt(0),
  );
  // Give the leftover cents to the largest fractional shares. All tickets of an
  // item share a remainder; sequence_number breaks ties within that item.
  allocations.sort((left, right) => left.remainder === right.remainder
    ? left.id - right.id
    : left.remainder > right.remainder ? -1 : 1);
  for (const item of allocations) {
    const extraCount = remaining < BigInt(item.quantity) ? remaining : BigInt(item.quantity);
    if (item.id === orderItemId) {
      return Number(item.cents + (BigInt(sequenceNumber) <= extraCount ? BigInt(1) : BigInt(0)));
    }
    remaining -= extraCount;
  }
  throw new Error("The pass buyer fee could not be allocated.");
}

type RefundedPayment = {
  id?: string;
  amount: number;
  status: string | null;
  pending_reason?: string | null;
  metadata?: Record<string, string> | null;
};

/**
 * Return only TourniBase's fee to fund refunds Stripe is holding for insufficient
 * funds. This is not a successful buyer refund: callers must keep buyer-facing
 * refund totals and pass status based on getBuyerFeeRefundedCents instead.
 */
export function getBuyerFeeFundingTargetCents({
  buyerFeeCents,
  chargeAmountCents,
  chargeAmountRefundedCents,
  orderId,
  refunds,
  expectedPassRefunds,
}: {
  buyerFeeCents: number;
  chargeAmountCents: number;
  chargeAmountRefundedCents: number;
  orderId: number;
  refunds: RefundedPayment[];
  expectedPassRefunds?: ReadonlyMap<number, { ticketCents: number; buyerFeeCents: number }>;
}): number {
  const successfulFee = getBuyerFeeRefundedCents({
    buyerFeeCents, chargeAmountCents, chargeAmountRefundedCents,
    orderId, refunds, expectedPassRefunds,
  });
  if (buyerFeeCents === 0 || !refunds.some(isRefundWaitingForFunds)) {
    return successfulFee;
  }
  if (buyerFeeCents > chargeAmountCents) throw new Error("Buyer fee exceeds the charge.");

  let successfulAmount = 0;
  let activeAmount = 0;
  let eligiblePendingAmount = 0;
  let exactPendingFee = 0;
  let wholeOrderRefunds = 0;
  const seenRefunds = new Map<string, RefundedPayment>();
  const seenPassIds = new Set<number>();
  for (const refund of refunds) {
    if (!refund.id) throw new Error("Stripe returned a refund without an identifier.");
    const previous = seenRefunds.get(refund.id);
    if (previous) {
      if (previous.amount !== refund.amount || previous.status !== refund.status ||
          previous.pending_reason !== refund.pending_reason ||
          JSON.stringify(previous.metadata) !== JSON.stringify(refund.metadata)) {
        throw new Error("Stripe refund snapshots changed during synchronization. Retry the event.");
      }
      continue;
    }
    seenRefunds.set(refund.id, refund);
    assertNonnegativeCents(refund.amount, "Refund amount");
    const succeeded = refund.status === "succeeded";
    const waitingForFunds = isRefundWaitingForFunds(refund);
    if (succeeded) successfulAmount += refund.amount;
    if (succeeded || refund.status === "pending" || refund.status === "requires_action") {
      activeAmount += refund.amount;
    }
    if (!succeeded && !waitingForFunds) continue;

    const metadata = refund.metadata;
    if (metadata?.buyer_fee_policy === "buyer_fee_v1") {
      const fee = parseNonnegativeInteger(metadata.buyer_fee_refund_cents);
      const ticketAmount = parseNonnegativeInteger(metadata.ticket_refund_cents);
      const passId = parseNonnegativeInteger(metadata.pass_id);
      if (metadata.order_id !== String(orderId) || fee === null ||
          ticketAmount === null || !passId || fee > buyerFeeCents ||
          ticketAmount + fee !== refund.amount) {
        throw new Error("Stripe buyer-fee refund metadata is invalid.");
      }
      const expected = expectedPassRefunds?.get(passId);
      if (!expected || expected.ticketCents !== ticketAmount || expected.buyerFeeCents !== fee) {
        throw new Error("Stripe buyer-fee refund metadata does not match the original pass.");
      }
      if (seenPassIds.has(passId)) {
        throw new Error("Stripe returned multiple active refunds for the same pass.");
      }
      seenPassIds.add(passId);
      if (waitingForFunds) {
        eligiblePendingAmount += refund.amount;
        exactPendingFee += fee;
      }
    } else if (waitingForFunds && metadata?.order_id === String(orderId)) {
      // Our whole-order refunds carry only order_id. Do not interpret partial
      // or malformed pass metadata as a whole-order refund.
      if (metadata.pass_id !== undefined || metadata.buyer_fee_policy !== undefined ||
          metadata.buyer_fee_refund_cents !== undefined || metadata.ticket_refund_cents !== undefined) {
        throw new Error("Stripe buyer-fee refund metadata is invalid.");
      }
      wholeOrderRefunds += 1;
      eligiblePendingAmount += refund.amount;
    }
    // Unidentified external partial refunds cannot advance an estimated fee.
  }
  if (successfulAmount !== chargeAmountRefundedCents ||
      activeAmount > chargeAmountCents || wholeOrderRefunds > 1) {
    throw new Error("Stripe refund totals changed during synchronization. Retry the event.");
  }
  if (successfulFee + exactPendingFee > buyerFeeCents) {
    throw new Error("Stripe refund allocations exceed the original payment.");
  }

  // A remaining-order refund has an exact fee only when these verified requests
  // cover the entire original payment; mixed pass refunds use saved fees above.
  if (wholeOrderRefunds === 1 &&
      successfulAmount + eligiblePendingAmount === chargeAmountCents) {
    return buyerFeeCents;
  }
  return successfulFee + exactPendingFee;
}

export function isRefundWaitingForFunds(refund: RefundedPayment) {
  return refund.status === "pending" && refund.pending_reason === "insufficient_funds";
}

/** Exact TourniBase refund shares, with a proportional fallback for Stripe UI refunds. */
export function getBuyerFeeRefundedCents({
  buyerFeeCents,
  chargeAmountCents,
  chargeAmountRefundedCents,
  orderId,
  refunds,
  expectedPassRefunds,
}: {
  buyerFeeCents: number;
  chargeAmountCents: number;
  chargeAmountRefundedCents: number;
  orderId: number;
  refunds: RefundedPayment[];
  expectedPassRefunds?: ReadonlyMap<number, { ticketCents: number; buyerFeeCents: number }>;
}): number {
  assertNonnegativeCents(buyerFeeCents, "Buyer fee");
  assertNonnegativeCents(chargeAmountCents, "Charge amount");
  assertNonnegativeCents(chargeAmountRefundedCents, "Refund amount");
  if (buyerFeeCents === 0 || chargeAmountRefundedCents === 0) return 0;
  if (buyerFeeCents > chargeAmountCents) throw new Error("Buyer fee exceeds the charge.");
  if (chargeAmountRefundedCents >= chargeAmountCents) return buyerFeeCents;

  let knownFee = 0;
  let knownAmount = 0;
  let successfulAmount = 0;
  const seenRefundIds = new Set<string>();
  for (const refund of refunds) {
    if (refund.status !== "succeeded") continue;
    if (refund.id && seenRefundIds.has(refund.id)) continue;
    if (refund.id) seenRefundIds.add(refund.id);
    assertNonnegativeCents(refund.amount, "Refund amount");
    successfulAmount += refund.amount;
    const metadata = refund.metadata;
    if (metadata?.buyer_fee_policy !== "buyer_fee_v1" ||
        metadata.order_id !== String(orderId)) continue;
    const fee = parseNonnegativeInteger(metadata.buyer_fee_refund_cents);
    const ticketAmount = parseNonnegativeInteger(metadata.ticket_refund_cents);
    const passId = parseNonnegativeInteger(metadata.pass_id);
    if (fee === null || ticketAmount === null || !passId ||
        fee > buyerFeeCents || fee > refund.amount || ticketAmount + fee !== refund.amount) {
      throw new Error("Stripe buyer-fee refund metadata is invalid.");
    }
    if (expectedPassRefunds) {
      const expected = expectedPassRefunds.get(passId);
      if (!expected || expected.ticketCents !== ticketAmount || expected.buyerFeeCents !== fee) {
        throw new Error("Stripe buyer-fee refund metadata does not match the original pass.");
      }
    }
    knownFee += fee;
    knownAmount += refund.amount;
  }
  if (successfulAmount > chargeAmountRefundedCents) {
    throw new Error("Stripe refund totals changed during synchronization. Retry the event.");
  }
  const externalAmount = chargeAmountRefundedCents - knownAmount;
  if (knownFee > buyerFeeCents || knownAmount > chargeAmountCents) {
    throw new Error("Stripe refund allocations exceed the original payment.");
  }
  // Exact pass refunds consume their original penny allocations. Apportion an
  // external refund over only the remaining ticket/fee balance, not the whole
  // original charge (which can otherwise refund more ticket revenue than sold).
  const remainingCharge = chargeAmountCents - knownAmount;
  const remainingFee = buyerFeeCents - knownFee;
  const externalFee = remainingCharge === 0 ? 0 : Math.round(remainingFee * externalAmount / remainingCharge);
  const minimumFee = Math.max(knownFee, chargeAmountRefundedCents - (chargeAmountCents - buyerFeeCents));
  return Math.max(minimumFee, Math.min(buyerFeeCents, chargeAmountRefundedCents, knownFee + externalFee));
}

function assertNonnegativeCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be nonnegative cents.`);
}

function parseNonnegativeInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
