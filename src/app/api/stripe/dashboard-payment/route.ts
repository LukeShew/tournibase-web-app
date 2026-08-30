import { NextResponse, type NextRequest } from "next/server";
import { getDirectorWorkspace } from "@/lib/auth";
import { getStripeDashboardPaymentUrl } from "@/lib/stripe-connect-payments";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const workspace = await getDirectorWorkspace();

  if (!workspace) {
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
      "id, stripe_connected_account_id, stripe_environment, stripe_payment_intent_id, tournaments!inner(organizations!inner(id, owner_user_id, operating_environment))",
    )
    .eq("id", orderId)
    .eq("stripe_environment", workspace.organization.operatingEnvironment)
    .eq("tournaments.organizations.id", workspace.organization.id)
    .eq(
      "tournaments.organizations.operating_environment",
      workspace.organization.operatingEnvironment,
    )
    .maybeSingle();

  if (error || !order) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const relation = order as unknown as typeof order & {
    tournaments: {
      organizations: {
        id: number;
        operating_environment: "live" | "test";
        owner_user_id: string;
      };
    };
  };

  if (
    relation.tournaments.organizations.owner_user_id !== workspace.director.id ||
    relation.tournaments.organizations.id !== workspace.organization.id ||
    relation.tournaments.organizations.operating_environment !==
      workspace.organization.operatingEnvironment ||
    relation.stripe_environment !== workspace.organization.operatingEnvironment
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!relation.stripe_connected_account_id) {
    return NextResponse.json(
      { error: "This legacy payment does not have a connected-account view." },
      { status: 409 },
    );
  }

  if (!relation.stripe_payment_intent_id) {
    return NextResponse.json(
      { error: "This order does not have a Stripe payment to open." },
      { status: 409 },
    );
  }

  return NextResponse.redirect(
    getStripeDashboardPaymentUrl({
      connectedAccountId: relation.stripe_connected_account_id,
      environment: relation.stripe_environment,
      paymentIntentId: relation.stripe_payment_intent_id,
    }),
  );
}
