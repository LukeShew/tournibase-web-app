export type BuyerFeeOrderItem = {
  id: number;
  quantity: number;
  unit_amount_cents: number;
};

/** Allocate the order fee by ticket value; ties use the persisted ticket order. */
export function getPassBuyerFeeCents({
  buyerFeeCents,
  orderItems,
  orderItemId,
  sequenceNumber,
}: {
  buyerFeeCents: number;
  orderItems: BuyerFeeOrderItem[];
  orderItemId: number;
  sequenceNumber: number;
}): number {
  assertNonnegativeCents(buyerFeeCents, "Buyer fee");
  if (buyerFeeCents === 0) return 0;

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
  metadata?: Record<string, string> | null;
};

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
