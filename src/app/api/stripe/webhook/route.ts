import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { attemptOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import { attemptRefundConfirmationEmail } from "@/lib/email/refund-confirmation";
import {
  fulfillCheckoutSession,
  markCheckoutFailed,
  syncStripeChargeRefund,
} from "@/lib/orders";
import {
  getStripe,
  getStripeConfigurationIssues,
  getStripePaymentWebhookSecret,
  getVerifiedStripe,
} from "@/lib/stripe";
import { assertStripeEventMatchesAppEnvironment } from "@/lib/stripe-connect-payments";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = getStripePaymentWebhookSecret();
  const configurationIssues = [
    ...getStripeConfigurationIssues(),
    ...(webhookSecret ? [] : ["STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET"]),
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
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret!);
  } catch {
    console.warn("[stripe-webhook] signature verification failed");
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  let eventEnvironment: "live" | "test";

  try {
    eventEnvironment = assertStripeEventMatchesAppEnvironment(event.livemode);
    await getVerifiedStripe();
  } catch (error) {
    console.warn("[stripe-webhook] environment mismatch", {
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Stripe event does not match this deployment." },
      { status: 400 },
    );
  }

  try {
    const eventConnectedAccountId = event.account ?? null;

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const fulfillment = await fulfillCheckoutSession(
        event.data.object.id,
        eventConnectedAccountId,
        eventEnvironment,
      );

      if (fulfillment.fulfilled) {
        const emailAttempt = await attemptOrderConfirmationEmail(
          fulfillment.orderId,
        );

        if (emailAttempt.status === "retryable_failure") {
          throw new Error(
            `Confirmation email needs a retry (${emailAttempt.code}).`,
          );
        }

        if (emailAttempt.status === "permanent_failure") {
          console.warn("[stripe-webhook] confirmation email not sent", {
            code: emailAttempt.code,
            eventId: event.id,
            orderId: fulfillment.orderId,
          });
        }
      }
    }

    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await markCheckoutFailed(
        event.data.object.id,
        eventConnectedAccountId,
        eventEnvironment,
      );
    }

    if (event.type === "charge.refunded") {
      const refundSync = await syncStripeChargeRefund(
        event.data.object as Stripe.Charge,
        eventConnectedAccountId,
      );

      if (refundSync.status === "order_not_found") {
        console.warn("[stripe-webhook] refunded charge had no matching order", {
          chargeId: refundSync.chargeId,
          eventId: event.id,
        });
      }

      if (
        refundSync.status === "refunded" ||
        refundSync.status === "partial_refund"
      ) {
        console.info("[stripe-webhook] refund synced", {
          amountRefundedCents: refundSync.amountRefundedCents,
          eventId: event.id,
          orderId: refundSync.orderId,
          status: refundSync.status,
        });

        const refundEmailAttempt = await attemptRefundConfirmationEmail({
          amountRefundedCents: refundSync.amountRefundedCents,
          amountTotalCents: refundSync.amountTotalCents,
          orderId: refundSync.orderId,
          status: refundSync.status,
        });

        if (refundEmailAttempt.status === "retryable_failure") {
          throw new Error(
            `Refund email needs a retry (${refundEmailAttempt.code}).`,
          );
        }

        if (refundEmailAttempt.status === "permanent_failure") {
          console.warn("[stripe-webhook] refund email not sent", {
            code: refundEmailAttempt.code,
            eventId: event.id,
            orderId: refundSync.orderId,
          });
        }
      }
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
