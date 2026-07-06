import "server-only";

import type Stripe from "stripe";
import { attemptOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import {
  getRefundPaymentStatusForCharge,
  parseStripeOrderIdMetadata,
} from "@/lib/order-refunds";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partial_refund";

type OrderRecord = {
  amount_total: number | string;
  buyer_name: string;
  id: number;
  payment_status: PaymentStatus;
  tournament_id: number;
};

type OrderItemRecord = {
  id: number;
  order_id: number;
  quantity: number;
  ticket_name: string;
  ticket_type_id: number;
  valid_from: string;
  valid_until: string;
};

type PassRecord = {
  id: number;
  public_token: string;
  status: "active" | "checked_in" | "refunded" | "voided" | "expired";
  ticket_type_id: number;
};

export type StripeRefundSyncResult =
  | {
      amountRefundedCents: number;
      amountTotalCents: number;
      orderId: number;
      status: "refunded" | "partial_refund";
    }
  | { chargeId: string; status: "order_not_found" }
  | { status: "not_refunded" };

export type OrderConfirmation = {
  amountTotal: number;
  buyerName: string;
  eventName: string;
  orderNumber: string;
  passes: Array<{
    id: number;
    publicToken: string;
    status: PassRecord["status"];
    ticketName: string;
  }>;
};

export async function fulfillCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return { fulfilled: false as const, paymentStatus: session.payment_status };
  }

  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("id, tournament_id, buyer_name, amount_total, payment_status")
    .eq("stripe_checkout_id", session.id)
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!orderRow) {
    throw new Error("Paid checkout does not match a TourniBase order.");
  }

  const order = orderRow as OrderRecord;
  const { data: itemRows, error: itemError } = await supabase
    .from("order_items")
    .select(
      "id, order_id, ticket_type_id, ticket_name, quantity, valid_from, valid_until",
    )
    .eq("order_id", order.id)
    .order("id", { ascending: true });

  if (itemError) {
    throw itemError;
  }

  const orderItems = (itemRows ?? []) as OrderItemRecord[];

  if (orderItems.length === 0) {
    throw new Error("Paid order has no ticket selections to fulfill.");
  }

  const passes = orderItems.flatMap((item) =>
    Array.from({ length: item.quantity }, (_, index) => ({
      order_id: order.id,
      tournament_id: order.tournament_id,
      ticket_type_id: item.ticket_type_id,
      order_item_id: item.id,
      sequence_number: index + 1,
      status: "active",
      valid_from: item.valid_from,
      valid_until: item.valid_until,
      uses_allowed: 1,
    })),
  );

  const { error: passError } = await supabase.from("passes").upsert(passes, {
    ignoreDuplicates: true,
    onConflict: "order_item_id,sequence_number",
  });

  if (passError) {
    throw passError;
  }

  const { error: paymentUpdateError } = await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", order.id);

  if (paymentUpdateError) {
    throw paymentUpdateError;
  }

  return { fulfilled: true as const, orderId: order.id };
}

export async function markCheckoutFailed(sessionId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "failed" })
    .eq("stripe_checkout_id", sessionId)
    .eq("payment_status", "pending");

  if (error) {
    throw error;
  }
}

export async function syncStripeChargeRefund(
  charge: Stripe.Charge,
): Promise<StripeRefundSyncResult> {
  const refundStatus = getRefundPaymentStatusForCharge(charge);

  if (!refundStatus) {
    return { status: "not_refunded" };
  }

  const orderId = await resolveOrderIdForStripeCharge(charge);

  if (!orderId) {
    return { chargeId: charge.id, status: "order_not_found" };
  }

  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!orderRow) {
    return { chargeId: charge.id, status: "order_not_found" };
  }

  const order = orderRow as Pick<OrderRecord, "id" | "payment_status">;
  const nextStatus =
    order.payment_status === "refunded" ? "refunded" : refundStatus;

  const { error: orderUpdateError } = await supabase
    .from("orders")
    .update({ payment_status: nextStatus })
    .eq("id", order.id);

  if (orderUpdateError) {
    throw orderUpdateError;
  }

  if (nextStatus === "refunded") {
    const { error: passUpdateError } = await supabase
      .from("passes")
      .update({ status: "refunded" })
      .eq("order_id", order.id)
      .in("status", ["active", "checked_in"]);

    if (passUpdateError) {
      throw passUpdateError;
    }
  }

  return {
    amountRefundedCents: charge.amount_refunded,
    amountTotalCents: charge.amount,
    orderId: order.id,
    status: nextStatus,
  };
}

async function resolveOrderIdForStripeCharge(charge: Stripe.Charge) {
  const chargeMetadataOrderId = parseStripeOrderIdMetadata(charge.metadata);

  if (chargeMetadataOrderId) {
    return chargeMetadataOrderId;
  }

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    return null;
  }

  const paymentIntent = await getStripe().paymentIntents.retrieve(
    paymentIntentId,
  );

  return parseStripeOrderIdMetadata(paymentIntent.metadata);
}

export async function getOrderConfirmation(
  sessionId: string,
): Promise<
  | { status: "paid"; confirmation: OrderConfirmation }
  | { status: "processing" }
> {
  const fulfillment = await fulfillCheckoutSession(sessionId);

  if (!fulfillment.fulfilled) {
    return { status: "processing" };
  }

  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("id, tournament_id, buyer_name, amount_total, payment_status")
    .eq("id", fulfillment.orderId)
    .single();

  if (orderError) {
    throw orderError;
  }

  const order = orderRow as OrderRecord;
  const [
    { data: tournament, error: tournamentError },
    { data: itemRows, error: itemError },
    { data: passRows, error: passError },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("name")
      .eq("id", order.tournament_id)
      .single(),
    supabase
      .from("order_items")
      .select(
        "id, order_id, ticket_type_id, ticket_name, quantity, valid_from, valid_until",
      )
      .eq("order_id", order.id),
    supabase
      .from("passes")
      .select("id, public_token, status, ticket_type_id")
      .eq("order_id", order.id)
      .order("id", { ascending: true }),
  ]);

  if (tournamentError) {
    throw tournamentError;
  }

  if (itemError) {
    throw itemError;
  }

  if (passError) {
    throw passError;
  }

  const ticketNames = new Map(
    ((itemRows ?? []) as OrderItemRecord[]).map((item) => [
      item.ticket_type_id,
      item.ticket_name,
    ]),
  );

  const confirmation: OrderConfirmation = {
    amountTotal: Number(order.amount_total),
    buyerName: order.buyer_name,
    eventName: tournament.name as string,
    orderNumber: `TB-${order.id.toString().padStart(6, "0")}`,
    passes: ((passRows ?? []) as PassRecord[]).map((pass) => ({
      id: pass.id,
      publicToken: pass.public_token,
      status: pass.status,
      ticketName: ticketNames.get(pass.ticket_type_id) ?? "Admission pass",
    })),
  };

  try {
    await attemptOrderConfirmationEmail(order.id);
  } catch (error) {
    console.error("[order-success] email delivery attempt failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      orderId: order.id,
    });
  }

  return {
    status: "paid",
    confirmation,
  };
}
