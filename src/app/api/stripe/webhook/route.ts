import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  fulfillCheckoutSession,
  markCheckoutFailed,
} from "@/lib/orders";
import {
  getStripe,
  getStripeConfigurationIssues,
} from "@/lib/stripe";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const configurationIssues = [
    ...getStripeConfigurationIssues({ includeWebhookSecret: true }),
    ...getSupabaseAdminConfigurationIssues(),
  ];

  if (configurationIssues.length > 0) {
    console.error("[stripe-webhook] missing configuration", {
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

  const rawBody = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.warn("[stripe-webhook] signature verification failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await fulfillCheckoutSession(event.data.object.id);
    }

    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await markCheckoutFailed(event.data.object.id);
    }
  } catch (error) {
    console.error("[stripe-webhook] event processing failed", {
      eventId: event.id,
      eventType: event.type,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
