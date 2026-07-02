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

type TicketTypeRecord = {
  description: string | null;
  id: number;
  name: string;
  price: number | string;
  quantity_limit: number | null;
  valid_from: string;
  valid_until: string;
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

  const supabase = getSupabaseAdmin();
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name, public_slug")
    .eq("public_slug", parsed.data.eventSlug)
    .eq("status", "published")
    .maybeSingle();

  if (tournamentError) {
    console.error("[checkout] tournament lookup failed", {
      code: tournamentError.code,
    });
    return checkoutError();
  }

  if (!tournament) {
    return NextResponse.json(
      { error: "This event is not currently accepting online orders." },
      { status: 404 },
    );
  }

  const ticketIds = [...uniqueTicketIds];
  const { data: ticketRows, error: ticketError } = await supabase
    .from("ticket_types")
    .select(
      "id, name, price, valid_from, valid_until, description, quantity_limit",
    )
    .eq("tournament_id", tournament.id)
    .eq("status", "active")
    .in("id", ticketIds);

  if (ticketError) {
    console.error("[checkout] ticket lookup failed", {
      code: ticketError.code,
    });
    return checkoutError();
  }

  const tickets = (ticketRows ?? []) as TicketTypeRecord[];

  if (tickets.length !== ticketIds.length) {
    return NextResponse.json(
      {
        error:
          "One or more selected tickets are no longer available. Refresh the page and try again.",
      },
      { status: 409 },
    );
  }

  const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const selectedTickets = parsed.data.items.map((item) => ({
    ...item,
    ticket: ticketsById.get(item.ticketTypeId)!,
  }));

  for (const selection of selectedTickets) {
    const unitAmountCents = toCents(selection.ticket.price);

    if (unitAmountCents === 0) {
      return NextResponse.json(
        {
          error: `${selection.ticket.name} is a free or comp pass and cannot be purchased through online checkout.`,
        },
        { status: 400 },
      );
    }

    if (selection.ticket.quantity_limit) {
      const { count, error: inventoryError } = await supabase
        .from("passes")
        .select("id", { count: "exact", head: true })
        .eq("ticket_type_id", selection.ticket.id)
        .in("status", ["active", "checked_in"]);

      if (inventoryError) {
        console.error("[checkout] inventory lookup failed", {
          code: inventoryError.code,
          ticketTypeId: selection.ticket.id,
        });
        return checkoutError();
      }

      if (
        (count ?? 0) + selection.quantity >
        selection.ticket.quantity_limit
      ) {
        return NextResponse.json(
          {
            error: `${selection.ticket.name} does not have enough passes remaining for that quantity.`,
          },
          { status: 409 },
        );
      }
    }
  }

  const amountTotalCents = selectedTickets.reduce(
    (total, selection) =>
      total + toCents(selection.ticket.price) * selection.quantity,
    0,
  );

  if (amountTotalCents < 50) {
    return NextResponse.json(
      { error: "The online checkout total must be at least $0.50." },
      { status: 400 },
    );
  }

  const buyerName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      tournament_id: tournament.id,
      buyer_name: buyerName,
      buyer_email: parsed.data.email,
      buyer_phone: parsed.data.phone || null,
      buyer_team_name: parsed.data.teamName || null,
      amount_total: (amountTotalCents / 100).toFixed(2),
      payment_status: "pending",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("[checkout] pending order creation failed", {
      code: orderError?.code,
    });
    return checkoutError();
  }

  const { error: itemInsertError } = await supabase.from("order_items").insert(
    selectedTickets.map((selection) => ({
      order_id: order.id,
      ticket_type_id: selection.ticket.id,
      ticket_name: selection.ticket.name,
      unit_amount_cents: toCents(selection.ticket.price),
      quantity: selection.quantity,
      valid_from: selection.ticket.valid_from,
      valid_until: selection.ticket.valid_until,
    })),
  );

  if (itemInsertError) {
    console.error("[checkout] order item creation failed", {
      code: itemInsertError.code,
      orderId: order.id,
    });
    await markOrderFailed(order.id);
    return checkoutError();
  }

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
            unit_amount: toCents(selection.ticket.price),
            product_data: {
              name: selection.ticket.name,
              description: selection.ticket.description || undefined,
            },
          },
        })),
        metadata: {
          order_id: String(order.id),
          tournament_id: String(tournament.id),
        },
        payment_intent_data: {
          metadata: {
            order_id: String(order.id),
            tournament_id: String(tournament.id),
          },
        },
        success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/e/${tournament.public_slug}?checkout=cancelled`,
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

function toCents(price: number | string) {
  return Math.round(Number(price) * 100);
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
