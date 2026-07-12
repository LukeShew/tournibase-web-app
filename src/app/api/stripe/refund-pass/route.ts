import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDirector } from "@/lib/auth";
import { attemptRefundConfirmationEmail } from "@/lib/email/refund-confirmation";
import { syncStripeChargeRefund } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.number().int().positive(),
  passId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const director = await getDirector();

  if (!director) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "The refund request was not valid." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: pass, error } = await supabase
    .from("passes")
    .select("id, order_id, order_item_id, status, orders!inner(stripe_checkout_id, tournaments!inner(organizations!inner(owner_user_id))), order_items!inner(unit_amount_cents)")
    .eq("id", parsed.data.passId)
    .eq("order_id", parsed.data.orderId)
    .maybeSingle();

  if (error || !pass) {
    return NextResponse.json({ error: "That pass could not be found." }, { status: 404 });
  }

  const relation = pass as unknown as {
    id: number;
    status: string;
    orders: {
      stripe_checkout_id: string | null;
      tournaments: { organizations: { owner_user_id: string } };
    };
    order_items: { unit_amount_cents: number };
  };

  if (relation.orders.tournaments.organizations.owner_user_id !== director.id) {
    return NextResponse.json({ error: "You do not have access to that order." }, { status: 403 });
  }

  if (relation.status === "refunded" || relation.status === "voided") {
    return NextResponse.json({ error: "That pass is already inactive." }, { status: 409 });
  }

  if (!relation.orders.stripe_checkout_id) {
    return NextResponse.json({ error: "This order does not have a Stripe payment." }, { status: 409 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(relation.orders.stripe_checkout_id);
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntent) {
    return NextResponse.json({ error: "Free passes do not have a payment to refund." }, { status: 409 });
  }

  try {
    const refund = await stripe.refunds.create(
      {
        amount: relation.order_items.unit_amount_cents,
        metadata: {
          order_id: String(parsed.data.orderId),
          pass_id: String(parsed.data.passId),
        },
        payment_intent: paymentIntent,
      },
      { idempotencyKey: `tournibase-pass-refund-${parsed.data.passId}` },
    );
    const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;

    if (!chargeId) {
      throw new Error("Stripe did not return a charge for the refund.");
    }

    const charge = await stripe.charges.retrieve(chargeId);
    const result = await syncStripeChargeRefund(charge);

    if (result.status === "refunded" || result.status === "partial_refund") {
      await attemptRefundConfirmationEmail(result);
    }

    return NextResponse.json({ ok: true });
  } catch (refundError) {
    console.error("[refund-pass] Stripe refund failed", {
      message: refundError instanceof Error ? refundError.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "The refund could not be completed. Check Stripe and try again." },
      { status: 502 },
    );
  }
}
