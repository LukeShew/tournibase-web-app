import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDirectorWorkspace } from "@/lib/auth";
import { getPassBuyerFeeCents, type BuyerFeeOrderItem, type BuyerFeePolicy } from "@/lib/buyer-fees";
import { attemptRefundConfirmationEmail } from "@/lib/email/refund-confirmation";
import { syncStripeChargeRefund } from "@/lib/orders";
import { getRefundActionResponse, RefundReviewRequiredError } from "@/lib/refund-action-response";
import { getVerifiedStripe } from "@/lib/stripe";
import { createOrRetrieveStripeRefund } from "@/lib/stripe-refund-request";
import {
  assertStripeRoutingMatches,
  getStripeRequestOptions,
  isCurrentStripeEnvironment,
  isPaidStripeRefundAmountCents,
  type StripeEnvironment,
} from "@/lib/stripe-connect-payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.number().int().positive(),
  passId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const workspace = await getDirectorWorkspace();

  if (!workspace) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "The refund request was not valid." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: pass, error } = await supabase
    .from("passes")
    .select("id, order_id, order_item_id, sequence_number, status, orders!passes_order_tournament_fk!inner(stripe_checkout_id, stripe_connected_account_id, stripe_environment, platform_fee_amount, buyer_fee_amount, fee_policy, tournaments!orders_tournament_id_fkey!inner(organizations!tournaments_organization_id_fkey!inner(id, owner_user_id, operating_environment))), order_items!passes_order_item_relationship_fk!inner(unit_amount_cents)")
    .eq("id", parsed.data.passId)
    .eq("order_id", parsed.data.orderId)
    .eq(
      "orders.stripe_environment",
      workspace.organization.operatingEnvironment,
    )
    .eq("orders.tournaments.organizations.id", workspace.organization.id)
    .eq(
      "orders.tournaments.organizations.operating_environment",
      workspace.organization.operatingEnvironment,
    )
    .maybeSingle();

  if (error) {
    console.error("[refund-pass] pass lookup failed", {
      code: error.code,
      orderId: parsed.data.orderId,
      passId: parsed.data.passId,
    });
    return NextResponse.json(
      { error: "The pass could not be loaded. Try again shortly." },
      { status: 503 },
    );
  }

  if (!pass) {
    return NextResponse.json({ error: "That pass could not be found." }, { status: 404 });
  }

  const relation = pass as unknown as {
    id: number;
    order_item_id: number;
    sequence_number: number;
    status: string;
    orders: {
      stripe_checkout_id: string | null;
      stripe_connected_account_id: string | null;
      stripe_environment: StripeEnvironment;
      platform_fee_amount: number | string;
      buyer_fee_amount: number | string;
      fee_policy?: BuyerFeePolicy;
      tournaments: {
        organizations: {
          id: number;
          operating_environment: StripeEnvironment;
          owner_user_id: string;
        };
      };
    };
    order_items: { unit_amount_cents: number };
  };

  if (
    relation.orders.tournaments.organizations.owner_user_id !==
      workspace.director.id ||
    relation.orders.tournaments.organizations.id !== workspace.organization.id ||
    relation.orders.tournaments.organizations.operating_environment !==
      workspace.organization.operatingEnvironment ||
    relation.orders.stripe_environment !==
      workspace.organization.operatingEnvironment
  ) {
    return NextResponse.json({ error: "You do not have access to that order." }, { status: 403 });
  }

  if (relation.status === "refunded" || relation.status === "voided") {
    return NextResponse.json({ error: "That pass is already inactive." }, { status: 409 });
  }

  if (!isPaidStripeRefundAmountCents(relation.order_items.unit_amount_cents)) {
    return NextResponse.json(
      { error: "Complimentary passes do not have a Stripe payment to refund." },
      { status: 409 },
    );
  }

  if (!relation.orders.stripe_checkout_id) {
    return NextResponse.json({ error: "This order does not have a Stripe payment." }, { status: 409 });
  }

  if (!relation.orders.stripe_connected_account_id) {
    return NextResponse.json(
      {
        error:
          "This historical payment is read-only and cannot be refunded here.",
      },
      { status: 409 },
    );
  }

  const routing = {
    connectedAccountId: relation.orders.stripe_connected_account_id,
    environment: relation.orders.stripe_environment,
  };

  if (!isCurrentStripeEnvironment(routing.environment)) {
    return NextResponse.json(
      {
        error:
          "This payment was created in a different Stripe environment and is read-only here.",
      },
      { status: 409 },
    );
  }

  let acceptedRefund: Awaited<ReturnType<typeof createOrRetrieveStripeRefund>> | null = null;

  try {
    const buyerFeeCents = Math.round(Number(relation.orders.buyer_fee_amount ?? 0) * 100);
    let passBuyerFeeCents = 0;
    if (buyerFeeCents > 0 || relation.orders.fee_policy === "per_ticket_v2") {
      const { data: itemRows, error: itemError } = await supabase
        .from("order_items")
        .select("id, quantity, unit_amount_cents, buyer_fee_unit_amount_cents")
        .eq("order_id", parsed.data.orderId);
      if (itemError) throw itemError;
      passBuyerFeeCents = getPassBuyerFeeCents({
        buyerFeeCents,
        orderItems: (itemRows ?? []) as BuyerFeeOrderItem[],
        orderItemId: relation.order_item_id,
        sequenceNumber: relation.sequence_number,
        feePolicy: relation.orders.fee_policy,
      });
    }
    const stripe = await getVerifiedStripe();
    const session = await stripe.checkout.sessions.retrieve(
      relation.orders.stripe_checkout_id,
      {},
      getStripeRequestOptions(routing),
    );

    assertStripeRoutingMatches({
      actualEnvironment: session.livemode ? "live" : "test",
      routing,
    });

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntent) {
      return NextResponse.json({ error: "Free passes do not have a payment to refund." }, { status: 409 });
    }

    const refund = await createOrRetrieveStripeRefund({
      stripe,
      routing,
      orderId: parsed.data.orderId,
      passId: parsed.data.passId,
      paymentIntentId: paymentIntent,
      amountCents: relation.order_items.unit_amount_cents + passBuyerFeeCents,
      platformFeeAmount: relation.orders.platform_fee_amount,
      buyerFeeAmount: relation.orders.buyer_fee_amount ?? 0,
      buyerFeeRefundCents: passBuyerFeeCents,
    });
    // Never report a local reconciliation error as a rejected Stripe refund.
    acceptedRefund = refund;
    const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;

    if (!chargeId) {
      throw new Error("Stripe did not return a charge for the refund.");
    }

    const charge = await stripe.charges.retrieve(
      chargeId,
      {},
      getStripeRequestOptions(routing),
    );
    const result = await syncStripeChargeRefund(
      charge,
      routing.connectedAccountId,
    );

    const response = getRefundActionResponse(
      refund.status,
      (result.status === "refunded" || result.status === "partial_refund") &&
        result.succeededRefundIds.includes(refund.id),
    );

    if (response.ok && (result.status === "refunded" || result.status === "partial_refund")) {
      await attemptRefundConfirmationEmail(result);
    }

    return NextResponse.json(response, { status: response.ok ? 200 : 202 });
  } catch (refundError) {
    if (refundError instanceof RefundReviewRequiredError ||
        acceptedRefund?.status === "failed" || acceptedRefund?.status === "canceled") {
      return NextResponse.json({ error: new RefundReviewRequiredError().message }, { status: 409 });
    }
    if (acceptedRefund) {
      console.warn("[refund-pass] accepted refund synchronization delayed", {
        message: refundError instanceof Error ? refundError.message : "Unknown error",
        orderId: parsed.data.orderId,
        passId: parsed.data.passId,
        refundId: acceptedRefund.id,
      });
      return NextResponse.json(getRefundActionResponse(acceptedRefund.status, false), { status: 202 });
    }
    console.error("[refund-pass] Stripe refund failed", {
      message: refundError instanceof Error ? refundError.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The refund could not be completed. Check Stripe and try again." },
      { status: 502 },
    );
  }
}
