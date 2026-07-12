import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getStripe,
  getStripeConfigurationIssues,
} from "@/lib/stripe";
import {
  getSupabaseAdmin,
  getSupabaseAdminConfigurationIssues,
} from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  eventSlug: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "The event link is not valid.",
    )
    .max(72),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase().max(254),
  phone: z.string().trim().max(40),
  teamName: z.string().trim().max(120),
  items: z
    .array(
      z.object({
        ticketTypeId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(20),
});

type ReservedCheckout = {
  amount_total_cents: number;
  inventory_expires_at: string;
  order_id: number;
  tournament_id: number;
  tournament_name: string;
  public_slug: string;
  items: Array<{
    description: string | null;
    name: string;
    quantity: number;
    ticket_type_id: number;
    unit_amount_cents: number;
  }>;
};

export async function POST(request: NextRequest) {
  const configurationIssues = [
    ...getStripeConfigurationIssues({
      includePublishableKey: true,
      includeWebhookSecret: true,
    }),
    ...getSupabaseAdminConfigurationIssues(),
  ];

  if (configurationIssues.length > 0) {
    return NextResponse.json(
      {
        error: `Checkout setup is incomplete. Missing server variables: ${configurationIssues.join(", ")}.`,
      },
      { status: 503 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The checkout request was not valid." },
      { status: 400 },
    );
  }

  const parsed = checkoutSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Check the buyer information and ticket quantities.",
      },
      { status: 400 },
    );
  }

  const uniqueTicketIds = new Set(
    parsed.data.items.map((item) => item.ticketTypeId),
  );

  if (uniqueTicketIds.size !== parsed.data.items.length) {
    return NextResponse.json(
      { error: "Each ticket type can appear only once per order." },
      { status: 400 },
    );
  }

  const forwardedIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const [ipAllowed, emailAllowed] = await Promise.all([
    checkRateLimit({
      key: `checkout-ip:${forwardedIp}`,
      limit: 12,
      windowSeconds: 600,
    }),
    checkRateLimit({
      key: `checkout-email:${parsed.data.email}`,
      limit: 6,
      windowSeconds: 600,
    }),
  ]);

  if (!ipAllowed || !emailAllowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const supabase = getSupabaseAdmin();
  const buyerName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
  const { data: reservationData, error: reservationError } = await supabase.rpc(
    "reserve_checkout_order",
    {
      p_buyer_email: parsed.data.email,
      p_buyer_name: buyerName,
      p_buyer_phone: parsed.data.phone || null,
      p_buyer_team_name: parsed.data.teamName || null,
      p_event_slug: parsed.data.eventSlug,
      p_items: parsed.data.items.map((item) => ({
        quantity: item.quantity,
        ticket_type_id: item.ticketTypeId,
      })),
    },
  );

  if (reservationError || !reservationData) {
    const message = reservationError?.message ?? "Checkout could not be reserved.";
    const expected = /not accepting|not available|expired|remaining|quantity|ticket/i.test(message);
    console.error("[checkout] atomic reservation failed", {
      code: reservationError?.code,
      message,
    });
    return NextResponse.json(
      { error: expected ? message : "Secure checkout could not be started. Try again." },
      { status: expected ? 409 : 500 },
    );
  }

  const reservation = reservationData as unknown as ReservedCheckout;

  if (
    (reservationData as { status?: string }).status !== "reserved" ||
    !Number.isSafeInteger(reservation.order_id) ||
    !Array.isArray(reservation.items)
  ) {
    const response = reservationData as { message?: string; status?: string };
    return NextResponse.json(
      { error: response.message || "The selected tickets could not be reserved." },
      { status: response.status === "invalid_request" ? 400 : 409 },
    );
  }
  const order = { id: reservation.order_id };
  const selectedTickets = reservation.items;
  const amountTotalCents = reservation.amount_total_cents;

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  ).replace(/\/+$/, "");
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: parsed.data.email,
        client_reference_id: String(order.id),
        line_items: selectedTickets.map((selection) => ({
          quantity: selection.quantity,
          price_data: {
            currency: "usd",
            unit_amount: selection.unit_amount_cents,
            product_data: {
              name: selection.name,
              description: selection.description || undefined,
            },
          },
        })),
        metadata: {
          order_id: String(order.id),
          tournament_id: String(reservation.tournament_id),
        },
        ...(amountTotalCents > 0
          ? {
              payment_intent_data: {
                metadata: {
                  order_id: String(order.id),
                  tournament_id: String(reservation.tournament_id),
                },
              },
            }
          : {}),
        expires_at: Math.floor(new Date(reservation.inventory_expires_at).getTime() / 1000),
        success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/e/${reservation.public_slug}?checkout=cancelled`,
      },
      {
        idempotencyKey: `tournibase-order-${order.id}`,
      },
    );

    if (!session.url) {
      await markOrderFailed(order.id);
      return checkoutError();
    }

    const { error: sessionUpdateError } = await supabase
      .from("orders")
      .update({ stripe_checkout_id: session.id })
      .eq("id", order.id);

    if (sessionUpdateError) {
      console.error("[checkout] session link persistence failed", {
        code: sessionUpdateError.code,
        orderId: order.id,
      });
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      await markOrderFailed(order.id);
      return checkoutError();
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout] Stripe session creation failed", {
      message: error instanceof Error ? error.message : "Unknown Stripe error",
      orderId: order.id,
    });
    await markOrderFailed(order.id);
    return checkoutError();
  }

  async function markOrderFailed(orderId: number) {
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", orderId)
      .eq("payment_status", "pending");

    if (error) {
      console.error("[checkout] failed order status update failed", {
        code: error.code,
        orderId,
      });
    }
  }
}

function checkoutError() {
  return NextResponse.json(
    {
      error:
        "Secure checkout could not be started. Try again or contact the event organizer.",
    },
    { status: 500 },
  );
}
