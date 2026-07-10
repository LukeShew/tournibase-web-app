import { NextResponse, type NextRequest } from "next/server";
import { getDirector } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const director = await getDirector();

  if (!director) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_checkout_id", sessionId)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (paymentIntentId) {
      const modePath = session.livemode ? "" : "/test";

      return NextResponse.redirect(
        `https://dashboard.stripe.com${modePath}/payments/${encodeURIComponent(paymentIntentId)}`,
      );
    }
  } catch {
    // Fall through to Stripe's payment list if this older session cannot be retrieved.
  }

  const modePath = sessionId.startsWith("cs_test_") ? "/test" : "";

  return NextResponse.redirect(
    `https://dashboard.stripe.com${modePath}/payments`,
  );
}
