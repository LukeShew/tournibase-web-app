import type Stripe from "stripe";
import { calculatePlatformFeeCents, type PlatformFeeConfiguration } from "./stripe-connect-payments";

type CheckoutTicket = {
  name: string;
  description: string | null;
  quantity: number;
  unit_amount_cents: number;
};

export function buildCheckoutLineItems({
  items,
  ticketSubtotalCents,
  buyerFeeCents,
  platformFeeCents,
  amountTotalCents,
  feeConfiguration,
}: {
  items: CheckoutTicket[];
  ticketSubtotalCents: number;
  buyerFeeCents: number;
  platformFeeCents: number;
  amountTotalCents: number;
  feeConfiguration: PlatformFeeConfiguration;
}): Stripe.Checkout.SessionCreateParams.LineItem[] {
  if (!items.length || items.some((item) =>
    !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
    !Number.isSafeInteger(item.unit_amount_cents) || item.unit_amount_cents < 0,
  )) {
    throw new Error("Invalid reserved ticket prices or quantities.");
  }
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_amount_cents, 0);
  const expectedFee = calculatePlatformFeeCents(subtotal, feeConfiguration);
  if (
    ![subtotal, ticketSubtotalCents, buyerFeeCents, platformFeeCents, amountTotalCents]
      .every((amount) => Number.isSafeInteger(amount) && amount >= 0) ||
    subtotal !== ticketSubtotalCents ||
    buyerFeeCents !== expectedFee || platformFeeCents !== buyerFeeCents ||
    amountTotalCents !== subtotal + buyerFeeCents
  ) {
    throw new Error("Reserved checkout totals do not match ticket prices and buyer fee.");
  }

  return [
    ...items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: item.unit_amount_cents,
        product_data: { name: item.name, description: item.description || undefined },
      },
    })),
    ...(buyerFeeCents > 0 ? [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: buyerFeeCents,
        product_data: { name: "TourniBase service fee", description: "Added to the ticket subtotal once per order." },
      },
    }] : []),
  ];
}
