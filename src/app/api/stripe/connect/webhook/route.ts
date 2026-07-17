import { NextResponse } from "next/server";
import {
  getStripe,
  getStripeConfigurationIssues,
} from "@/lib/stripe";
import { synchronizeStripeAccountById } from "@/lib/stripe-connect";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ACCOUNT_EVENT_TYPES = new Set([
  "v2.core.account.created",
  "v2.core.account.closed",
  "v2.core.account.updated",
  "v2.core.account[configuration.merchant].updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[requirements].updated",
  "v2.core.account[future_requirements].updated",
]);

export async function POST(request: Request) {
  const configurationIssues = [
    ...getStripeConfigurationIssues(),
    ...getSupabaseAdminConfigurationIssues(),
    ...(process.env.STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET
      ? []
      : ["STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET"]),
  ];

  if (configurationIssues.length > 0) {
    console.error("[stripe-connect-webhook] missing configuration", {
      variables: configurationIssues,
    });
    return NextResponse.json(
      { error: "Webhook configuration is incomplete." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  let notification: ReturnType<
    ReturnType<typeof getStripe>["parseEventNotification"]
  >;

  try {
    notification = getStripe().parseEventNotification(
      await request.text(),
      signature,
      process.env.STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.warn("[stripe-connect-webhook] signature verification failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    let accountId: string | null = null;

    if (
      ACCOUNT_EVENT_TYPES.has(notification.type) &&
      "related_object" in notification
    ) {
      accountId = notification.related_object?.id ?? null;
    } else if (notification.type === "v2.core.account_link.returned") {
      const event = await notification.fetchEvent();
      accountId = event.data.account_id;
    }

    if (accountId) {
      await synchronizeStripeAccountById(accountId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-connect-webhook] account sync failed", {
      eventId: notification.id,
      eventType: notification.type,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Connected account synchronization failed." },
      { status: 500 },
    );
  }
}
