import "server-only";

import type Stripe from "stripe";
import { attemptOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import {
  getRefundPaymentStatusForCharge,
  parseStripeOrderIdMetadata,
} from "@/lib/order-refunds";
import { getStripe } from "@/lib/stripe";
import {
  assertStripeRoutingMatches,
  getApplicationFeeRefundTargetCents,
  getStripeRequestOptions,
  isCurrentStripeEnvironment,
  type StripeEnvironment,
  type StripePaymentRouting,
} from "@/lib/stripe-connect-payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partial_refund";

type OrderRecord = {
  amount_refunded: number | string;
  amount_total: number | string;
  buyer_name: string;
  id: number;
  payment_status: PaymentStatus;
  platform_fee_amount: number | string;
  platform_fee_refunded: number | string;
  stripe_charge_id: string | null;
  stripe_connected_account_id: string | null;
  stripe_environment: StripeEnvironment;
  stripe_payment_intent_id: string | null;
  tournament_id: number;
};

const orderRecordSelection =
  "id, tournament_id, buyer_name, amount_total, amount_refunded, payment_status, stripe_connected_account_id, stripe_environment, platform_fee_amount, platform_fee_refunded, stripe_payment_intent_id, stripe_charge_id";

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

export async function fulfillCheckoutSession(
  sessionId: string,
  eventConnectedAccountId?: string | null,
) {
  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select(orderRecordSelection)
    .eq("stripe_checkout_id", sessionId)
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!orderRow) {
    throw new Error("Paid checkout does not match a TourniBase order.");
  }

  const order = orderRow as OrderRecord;
  const routing = getOrderStripeRouting(order);

  assertStripeRoutingMatches({
    eventConnectedAccountId,
    routing,
  });

  let paymentIdentifiers: {
    chargeId: string | null;
    paymentIntentId: string | null;
  } = {
    chargeId: order.stripe_charge_id,
    paymentIntentId: order.stripe_payment_intent_id,
  };

  if (!isCurrentStripeEnvironment(routing.environment)) {
    if (
      order.payment_status === "paid" ||
      order.payment_status === "refunded" ||
      order.payment_status === "partial_refund"
    ) {
      return { fulfilled: true as const, orderId: order.id };
    }

    throw new Error(
      "This checkout belongs to a different Stripe environment and is read-only.",
    );
  }

  if (isFreeCheckoutId(sessionId)) {
    if (Number(order.amount_total) !== 0 || routing.connectedAccountId) {
      throw new Error("Free checkout routing does not match the TourniBase order.");
    }
  } else {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {},
      getStripeRequestOptions(routing),
    );

    assertStripeRoutingMatches({
      actualEnvironment: session.livemode ? "live" : "test",
      routing,
    });

    if (
      session.metadata?.order_id &&
      session.metadata.order_id !== String(order.id)
    ) {
      throw new Error("Stripe checkout metadata does not match the TourniBase order.");
    }

    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return {
        fulfilled: false as const,
        paymentStatus: session.payment_status,
      };
    }

    paymentIdentifiers = await getStripePaymentIdentifiers(session, routing);
  }

  if (
    order.payment_status === "refunded" ||
    order.payment_status === "partial_refund"
  ) {
    return { fulfilled: true as const, orderId: order.id };
  }
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
    .update({
      payment_status: "paid",
      stripe_charge_id: paymentIdentifiers.chargeId,
      stripe_payment_intent_id: paymentIdentifiers.paymentIntentId,
    })
    .eq("id", order.id)
    .in("payment_status", ["pending", "failed", "paid"]);

  if (paymentUpdateError) {
    throw paymentUpdateError;
  }

  return { fulfilled: true as const, orderId: order.id };
}

export async function markCheckoutFailed(
  sessionId: string,
  eventConnectedAccountId?: string | null,
) {
  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderLookupError } = await supabase
    .from("orders")
    .select(orderRecordSelection)
    .eq("stripe_checkout_id", sessionId)
    .maybeSingle();

  if (orderLookupError) {
    throw orderLookupError;
  }

  if (!orderRow) {
    return;
  }

  const order = orderRow as OrderRecord;

  assertStripeRoutingMatches({
    eventConnectedAccountId,
    routing: getOrderStripeRouting(order),
  });

  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "failed" })
    .eq("id", order.id)
    .eq("payment_status", "pending");

  if (error) {
    throw error;
  }
}

export async function syncStripeChargeRefund(
  charge: Stripe.Charge,
  eventConnectedAccountId: string | null = null,
): Promise<StripeRefundSyncResult> {
  const stripe = getStripe();
  const eventRouting: StripePaymentRouting = {
    connectedAccountId: eventConnectedAccountId,
    environment: charge.livemode ? "live" : "test",
  };
  const latestCharge = await stripe.charges.retrieve(
    charge.id,
    {},
    getStripeRequestOptions(eventRouting),
  );
  const refundStatus = getRefundPaymentStatusForCharge(latestCharge);

  if (!refundStatus) {
    return { status: "not_refunded" };
  }

  const order = await resolveOrderForStripeCharge(
    latestCharge,
    eventRouting,
  );

  if (!order) {
    return { chargeId: latestCharge.id, status: "order_not_found" };
  }

  const routing = getOrderStripeRouting(order);

  assertStripeRoutingMatches({
    actualEnvironment: latestCharge.livemode ? "live" : "test",
    eventConnectedAccountId,
    routing,
  });

  const nextStatus =
    order.payment_status === "refunded" ? "refunded" : refundStatus;
  const platformFeeRefundedCents =
    await synchronizeApplicationFeeRefund(latestCharge, order);
  const paymentIntentId =
    typeof latestCharge.payment_intent === "string"
      ? latestCharge.payment_intent
      : latestCharge.payment_intent?.id ?? order.stripe_payment_intent_id;

  const supabase = getSupabaseAdmin();
  let orderUpdate = supabase
    .from("orders")
    .update({
      amount_refunded: (latestCharge.amount_refunded / 100).toFixed(2),
      payment_status: nextStatus,
      platform_fee_refunded: (platformFeeRefundedCents / 100).toFixed(2),
      stripe_charge_id: latestCharge.id,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", order.id)
    .eq("stripe_environment", routing.environment);

  orderUpdate = routing.connectedAccountId
    ? orderUpdate.eq(
        "stripe_connected_account_id",
        routing.connectedAccountId,
      )
    : orderUpdate.is("stripe_connected_account_id", null);

  const { error: orderUpdateError } = await orderUpdate;

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

  if (nextStatus === "partial_refund") {
    const refunds = await stripe.refunds.list(
      { charge: latestCharge.id, limit: 100 },
      getStripeRequestOptions(routing),
    );
    const refundedPassIds = refunds.data
      .filter((refund) => refund.status === "succeeded")
      .map((refund) => Number(refund.metadata?.pass_id))
      .filter((passId) => Number.isSafeInteger(passId) && passId > 0);

    if (refundedPassIds.length > 0) {
      const { error: passUpdateError } = await supabase
        .from("passes")
        .update({ status: "refunded" })
        .eq("order_id", order.id)
        .in("id", refundedPassIds)
        .in("status", ["active", "checked_in"]);

      if (passUpdateError) {
        throw passUpdateError;
      }
    } else {
      console.warn(
        "[stripe-refund-sync] partial refund did not identify a pass; order totals were synchronized without changing pass status",
        {
          chargeId: latestCharge.id,
          orderId: order.id,
        },
      );
    }
  }

  return {
    amountRefundedCents: latestCharge.amount_refunded,
    amountTotalCents: latestCharge.amount,
    orderId: order.id,
    status: nextStatus,
  };
}

async function resolveOrderForStripeCharge(
  charge: Stripe.Charge,
  routing: StripePaymentRouting,
): Promise<OrderRecord | null> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  const [chargeOrder, paymentIntentOrder] = await Promise.all([
    findOrderByStripeIdentifier("stripe_charge_id", charge.id, routing),
    paymentIntentId
      ? findOrderByStripeIdentifier(
          "stripe_payment_intent_id",
          paymentIntentId,
          routing,
        )
      : Promise.resolve(null),
  ]);

  if (
    chargeOrder &&
    paymentIntentOrder &&
    chargeOrder.id !== paymentIntentOrder.id
  ) {
    throw new Error(
      "Stripe charge and PaymentIntent resolve to different TourniBase orders.",
    );
  }

  const storedOrder = chargeOrder ?? paymentIntentOrder;

  if (storedOrder) {
    assertOrderPaymentIdentifiers(storedOrder, charge.id, paymentIntentId);
    return storedOrder;
  }

  const chargeMetadataOrderId = parseStripeOrderIdMetadata(charge.metadata);
  let paymentIntentMetadataOrderId: number | null = null;

  if (paymentIntentId) {
    const paymentIntent = await getStripe().paymentIntents.retrieve(
      paymentIntentId,
      {},
      getStripeRequestOptions(routing),
    );

    assertStripeRoutingMatches({
      actualEnvironment: paymentIntent.livemode ? "live" : "test",
      routing,
    });
    paymentIntentMetadataOrderId = parseStripeOrderIdMetadata(
      paymentIntent.metadata,
    );
  }

  if (
    chargeMetadataOrderId &&
    paymentIntentMetadataOrderId &&
    chargeMetadataOrderId !== paymentIntentMetadataOrderId
  ) {
    throw new Error(
      "Stripe charge and PaymentIntent metadata identify different TourniBase orders.",
    );
  }

  const metadataOrderId =
    chargeMetadataOrderId ?? paymentIntentMetadataOrderId;

  if (!metadataOrderId) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select(orderRecordSelection)
    .eq("id", metadataOrderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const metadataOrder = data as OrderRecord;

  assertStripeRoutingMatches({
    actualEnvironment: charge.livemode ? "live" : "test",
    eventConnectedAccountId: routing.connectedAccountId,
    routing: getOrderStripeRouting(metadataOrder),
  });
  assertOrderPaymentIdentifiers(metadataOrder, charge.id, paymentIntentId);

  return metadataOrder;
}

async function findOrderByStripeIdentifier(
  field: "stripe_charge_id" | "stripe_payment_intent_id",
  value: string,
  routing: StripePaymentRouting,
) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("orders")
    .select(orderRecordSelection)
    .eq(field, value)
    .eq("stripe_environment", routing.environment);

  query = routing.connectedAccountId
    ? query.eq("stripe_connected_account_id", routing.connectedAccountId)
    : query.is("stripe_connected_account_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data as OrderRecord) : null;
}

function assertOrderPaymentIdentifiers(
  order: OrderRecord,
  chargeId: string,
  paymentIntentId?: string | null,
) {
  if (order.stripe_charge_id && order.stripe_charge_id !== chargeId) {
    throw new Error("Stripe charge does not match the TourniBase order.");
  }

  if (
    order.stripe_payment_intent_id &&
    order.stripe_payment_intent_id !== paymentIntentId
  ) {
    throw new Error("Stripe PaymentIntent does not match the TourniBase order.");
  }
}

function getOrderStripeRouting(order: OrderRecord): StripePaymentRouting {
  return {
    connectedAccountId: order.stripe_connected_account_id,
    environment: order.stripe_environment,
  };
}

async function getStripePaymentIdentifiers(
  session: Stripe.Checkout.Session,
  routing: StripePaymentRouting,
) {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    return { chargeId: null, paymentIntentId: null };
  }

  const paymentIntent = await getStripe().paymentIntents.retrieve(
    paymentIntentId,
    {},
    getStripeRequestOptions(routing),
  );
  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id ?? null;

  return { chargeId, paymentIntentId };
}

async function synchronizeApplicationFeeRefund(
  charge: Stripe.Charge,
  order: OrderRecord,
) {
  const applicationFeeId =
    typeof charge.application_fee === "string"
      ? charge.application_fee
      : charge.application_fee?.id;

  if (!applicationFeeId) {
    return 0;
  }

  const stripe = getStripe();
  let applicationFee = await stripe.applicationFees.retrieve(
    applicationFeeId,
  );

  const targetRefundCents = getApplicationFeeRefundTargetCents({
    applicationFeeCents: applicationFee.amount,
    chargeAmountCents: charge.amount,
    chargeAmountRefundedCents: charge.amount_refunded,
  });
  const missingRefundCents =
    targetRefundCents - applicationFee.amount_refunded;

  if (missingRefundCents > 0) {
    await stripe.applicationFees.createRefund(
      applicationFeeId,
      {
        amount: missingRefundCents,
        metadata: {
          charge_id: charge.id,
          order_id: String(order.id),
          source: "tournibase_refund_sync",
        },
      },
      {
        idempotencyKey: `tournibase-fee-refund-${applicationFeeId}-${charge.amount_refunded}`,
      },
    );
    applicationFee = await stripe.applicationFees.retrieve(applicationFeeId);
  }

  return applicationFee.amount_refunded;
}

function isFreeCheckoutId(sessionId: string) {
  return /^free_[a-f0-9]{32}$/.test(sessionId);
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
    .select(orderRecordSelection)
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
