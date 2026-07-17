import { NextResponse, type NextRequest } from "next/server";
import { getDirector } from "@/lib/auth";
import { getStripeDashboardPaymentUrl } from "@/lib/stripe-connect-payments";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const director = await getDirector();

  if (!director) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const orderId = Number(request.nextUrl.searchParams.get("order_id"));

  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, stripe_connected_account_id, stripe_environment, stripe_payment_intent_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!order.stripe_connected_account_id) {
    return NextResponse.json(
      { error: "This legacy payment does not have a connected-account view." },
      { status: 409 },
    );
  }

  if (!order.stripe_payment_intent_id) {
    return NextResponse.json(
      { error: "This order does not have a Stripe payment to open." },
      { status: 409 },
    );
  }

  return NextResponse.redirect(
    getStripeDashboardPaymentUrl({
      connectedAccountId: order.stripe_connected_account_id,
      environment: order.stripe_environment,
      paymentIntentId: order.stripe_payment_intent_id,
    }),
  );
}
