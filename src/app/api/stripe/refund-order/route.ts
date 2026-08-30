import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDirectorWorkspace } from "@/lib/auth";
import { attemptRefundConfirmationEmail } from "@/lib/email/refund-confirmation";
import { syncStripeChargeRefund } from "@/lib/orders";
import { getVerifiedStripe } from "@/lib/stripe";
import {
  assertStripeRoutingMatches,
  getStripeRequestOptions,
  isCurrentStripeEnvironment,
  type StripeEnvironment,
} from "@/lib/stripe-connect-payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const workspace = await getDirectorWorkspace();

  if (!workspace) {
    return NextResponse.json(
      { error: "Sign in again to continue." },
      { status: 401 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "The refund request was not valid." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, amount_total, amount_refunded, payment_status, stripe_checkout_id, stripe_connected_account_id, stripe_environment, stripe_payment_intent_id, tournaments!inner(organizations!inner(id, owner_user_id, operating_environment))",
    )
    .eq("id", parsed.data.orderId)
    .eq("stripe_environment", workspace.organization.operatingEnvironment)
    .eq("tournaments.organizations.id", workspace.organization.id)
    .eq(
      "tournaments.organizations.operating_environment",
      workspace.organization.operatingEnvironment,
    )
    .maybeSingle();

  if (orderError || !orderRow) {
    return NextResponse.json(
      { error: "That order could not be found." },
      { status: 404 },
    );
  }

  const order = orderRow as unknown as {
    amount_refunded: number | string;
    amount_total: number | string;
    id: number;
    payment_status: string;
    stripe_checkout_id: string | null;
    stripe_connected_account_id: string | null;
    stripe_environment: StripeEnvironment;
    stripe_payment_intent_id: string | null;
    tournaments: {
      organizations: {
        id: number;
        operating_environment: StripeEnvironment;
        owner_user_id: string;
      };
    };
  };

  if (
    order.tournaments.organizations.owner_user_id !== workspace.director.id ||
    order.tournaments.organizations.id !== workspace.organization.id ||
    order.tournaments.organizations.operating_environment !==
      workspace.organization.operatingEnvironment ||
    order.stripe_environment !== workspace.organization.operatingEnvironment
  ) {
    return NextResponse.json(
      { error: "You do not have access to that order." },
      { status: 403 },
    );
  }

  if (order.payment_status === "refunded") {
    return NextResponse.json(
      { error: "That order is already fully refunded." },
      { status: 409 },
    );
  }

  if (
    order.payment_status !== "paid" &&
    order.payment_status !== "partial_refund"
  ) {
    return NextResponse.json(
      { error: "Only captured payments can be refunded." },
      { status: 409 },
    );
  }

  if (
    Number(order.amount_total) <= 0 ||
    Number(order.amount_refunded) >= Number(order.amount_total)
  ) {
    return NextResponse.json(
      { error: "This order does not have a remaining payment to refund." },
      { status: 409 },
    );
  }

  if (!order.stripe_connected_account_id) {
    return NextResponse.json(
      {
        error:
          "This historical payment is read-only and cannot be refunded here.",
      },
      { status: 409 },
    );
  }

  const routing = {
    connectedAccountId: order.stripe_connected_account_id,
    environment: order.stripe_environment,
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

  const stripe = await getVerifiedStripe();
  let paymentIntentId = order.stripe_payment_intent_id;

  try {
    if (!paymentIntentId && order.stripe_checkout_id) {
      const session = await stripe.checkout.sessions.retrieve(
        order.stripe_checkout_id,
        {},
        getStripeRequestOptions(routing),
      );

      assertStripeRoutingMatches({
        actualEnvironment: session.livemode ? "live" : "test",
        routing,
      });

      paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
    }

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "This order does not have a Stripe payment to refund." },
        { status: 409 },
      );
    }

    const refund = await stripe.refunds.create(
      {
        metadata: { order_id: String(order.id) },
        payment_intent: paymentIntentId,
        refund_application_fee: true,
      },
      getStripeRequestOptions(
        routing,
        `tournibase-order-refund-${order.id}`,
      ),
    );
    const chargeId =
      typeof refund.charge === "string"
        ? refund.charge
        : refund.charge?.id;

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

    if (result.status === "refunded" || result.status === "partial_refund") {
      await attemptRefundConfirmationEmail(result);
    }

    return NextResponse.json({ ok: true });
  } catch (refundError) {
    console.error("[refund-order] Stripe refund failed", {
      message:
        refundError instanceof Error ? refundError.message : "Unknown error",
      orderId: order.id,
    });
    return NextResponse.json(
      {
        error:
          "The order refund could not be completed. Check Stripe and try again.",
      },
      { status: 502 },
    );
  }
}
