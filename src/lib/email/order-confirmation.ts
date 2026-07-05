import "server-only";

import { render } from "react-email";
import {
  createOrderConfirmationText,
  OrderConfirmationEmail,
  type OrderConfirmationEmailData,
} from "@/emails/order-confirmation";
import {
  EmailSendError,
  getEmailProvider,
  normalizeEmailSendError,
  type EmailProvider,
} from "@/lib/email/provider";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DeliveryStatus =
  | "pending"
  | "sending"
  | "sent"
  | "retryable_failure"
  | "permanent_failure";

type DeliveryRecord = {
  order_id: number;
  status: DeliveryStatus;
};

type OrderRecord = {
  amount_total: number | string;
  buyer_email: string;
  buyer_name: string;
  id: number;
  payment_status: "pending" | "paid" | "failed" | "refunded" | "partial_refund";
  tournament_id: number;
};

type TournamentRecord = {
  contact_email: string;
  end_date: string;
  name: string;
  organizer_name: string;
  start_date: string;
  venue_address: string | null;
  venue_name: string;
};

type OrderItemRecord = {
  id: number;
  quantity: number;
  ticket_name: string;
  unit_amount_cents: number;
};

type PassRecord = {
  id: number;
  order_item_id: number | null;
  public_token: string;
  sequence_number: number | null;
};

export type OrderEmailAttempt =
  | { status: "pending" }
  | { status: "sent"; messageId: string }
  | { status: "already_sent" }
  | { status: "in_progress" }
  | { status: "retryable_failure"; code: string }
  | { status: "permanent_failure"; code: string };

export async function attemptOrderConfirmationEmail(
  orderId: number,
  provider: EmailProvider = getEmailProvider(),
): Promise<OrderEmailAttempt> {
  const supabase = getSupabaseAdmin();
  const { error: ensureError } = await supabase
    .from("order_email_deliveries")
    .upsert(
      {
        order_id: orderId,
        status: "pending",
      },
      {
        ignoreDuplicates: true,
        onConflict: "order_id",
      },
    );

  if (ensureError) {
    throw databaseError("email_delivery_create_failed", ensureError);
  }

  if (!provider.isConfigured) {
    return { status: "pending" };
  }

  const { data: claimRows, error: claimError } = await supabase.rpc(
    "claim_order_email_delivery",
    {
      p_order_id: orderId,
    },
  );

  if (claimError) {
    throw databaseError("email_delivery_claim_failed", claimError);
  }

  const claimed = ((claimRows ?? []) as DeliveryRecord[])[0];

  if (!claimed) {
    return getExistingAttemptResult(orderId);
  }

  try {
    const { email, recipient } = await loadOrderEmail(orderId);
    const html = await render(OrderConfirmationEmail(email));
    const text = createOrderConfirmationText(email);
    const result = await provider.send({
      html,
      idempotencyKey: `order-confirmation-${orderId}`,
      replyTo: email.organizerEmail,
      subject: `Your ${email.eventName} passes are ready`,
      text,
      to: recipient,
    });

    const { data: sentRow, error: sentError } = await supabase
      .from("order_email_deliveries")
      .update({
        last_error_code: null,
        last_error_message: null,
        locked_at: null,
        provider: provider.name,
        provider_message_id: result.messageId,
        sent_at: new Date().toISOString(),
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("status", "sending")
      .select("order_id")
      .maybeSingle();

    if (sentError || !sentRow) {
      throw databaseError(
        "email_delivery_sent_update_failed",
        sentError ?? new Error("The delivery claim was no longer active."),
      );
    }

    return { status: "sent", messageId: result.messageId };
  } catch (error) {
    const normalized = normalizeEmailSendError(error);
    const failureStatus = normalized.retryable
      ? "retryable_failure"
      : "permanent_failure";
    const { error: failureUpdateError } = await supabase
      .from("order_email_deliveries")
      .update({
        last_error_code: normalized.code,
        last_error_message: normalized.safeMessage,
        locked_at: null,
        provider: provider.name,
        status: failureStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("status", "sending");

    if (failureUpdateError) {
      throw databaseError(
        "email_delivery_failure_update_failed",
        failureUpdateError,
      );
    }

    return {
      status: failureStatus,
      code: normalized.code,
    };
  }
}

async function getExistingAttemptResult(
  orderId: number,
): Promise<OrderEmailAttempt> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("order_email_deliveries")
    .select("order_id, status")
    .eq("order_id", orderId)
    .single();

  if (error) {
    throw databaseError("email_delivery_status_failed", error);
  }

  const delivery = data as DeliveryRecord;

  switch (delivery.status) {
    case "sent":
      return { status: "already_sent" };
    case "sending":
      return { status: "in_progress" };
    case "permanent_failure":
      return {
        status: "permanent_failure",
        code: "previous_permanent_failure",
      };
    case "pending":
    case "retryable_failure":
      return { status: "pending" };
  }
}

async function loadOrderEmail(
  orderId: number,
): Promise<{
  email: OrderConfirmationEmailData;
  recipient: string;
}> {
  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, tournament_id, buyer_name, buyer_email, amount_total, payment_status",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    throw databaseError("email_order_lookup_failed", orderError);
  }

  if (!orderRow) {
    throw permanentDataError(
      "email_order_missing",
      "The order no longer exists.",
    );
  }

  const order = orderRow as OrderRecord;

  if (order.payment_status !== "paid") {
    throw permanentDataError(
      "email_order_not_paid",
      "The order is not marked paid.",
    );
  }

  const [
    { data: tournamentRow, error: tournamentError },
    { data: itemRows, error: itemError },
    { data: passRows, error: passError },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select(
        "name, start_date, end_date, venue_name, venue_address, organizer_name, contact_email",
      )
      .eq("id", order.tournament_id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("id, ticket_name, unit_amount_cents, quantity")
      .eq("order_id", order.id)
      .order("id", { ascending: true }),
    supabase
      .from("passes")
      .select("id, public_token, order_item_id, sequence_number")
      .eq("order_id", order.id)
      .order("id", { ascending: true }),
  ]);

  if (tournamentError) {
    throw databaseError("email_tournament_lookup_failed", tournamentError);
  }

  if (itemError) {
    throw databaseError("email_items_lookup_failed", itemError);
  }

  if (passError) {
    throw databaseError("email_passes_lookup_failed", passError);
  }

  if (!tournamentRow) {
    throw permanentDataError(
      "email_tournament_missing",
      "The event no longer exists.",
    );
  }

  const tournament = tournamentRow as TournamentRecord;
  const items = (itemRows ?? []) as OrderItemRecord[];
  const passes = (passRows ?? []) as PassRecord[];
  const expectedPassCount = items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  if (items.length === 0 || passes.length !== expectedPassCount) {
    throw new EmailSendError({
      code: "email_passes_not_ready",
      message: "The paid order passes are not ready for email delivery.",
      retryable: true,
      safeMessage:
        "The order passes were not ready when email delivery was attempted.",
    });
  }

  const itemNames = new Map(items.map((item) => [item.id, item.ticket_name]));
  const siteUrl = getSiteUrl();

  return {
    email: {
      amountPaid: formatCurrency(Number(order.amount_total)),
      buyerName: order.buyer_name,
      eventDate: formatCalendarDateRange(
        tournament.start_date,
        tournament.end_date,
      ),
      eventName: tournament.name,
      items: items.map((item) => ({
        lineTotal: formatCurrency(
          (item.unit_amount_cents * item.quantity) / 100,
        ),
        name: item.ticket_name,
        quantity: item.quantity,
      })),
      logoUrl: `${siteUrl}/icon.png`,
      orderNumber: `TB-${order.id.toString().padStart(6, "0")}`,
      organizerEmail: tournament.contact_email,
      organizerName: tournament.organizer_name,
      passes: passes.map((pass) => {
        if (!pass.order_item_id || !pass.sequence_number) {
          throw permanentDataError(
            "email_pass_snapshot_missing",
            "A pass is missing its order snapshot.",
          );
        }

        return {
          label: itemNames.get(pass.order_item_id) ?? "Admission pass",
          url: `${siteUrl}/p/${pass.public_token}`,
        };
      }),
      venueAddress: tournament.venue_address,
      venueName: tournament.venue_name,
    },
    recipient: order.buyer_email,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(amount);
}

function formatCalendarDateRange(startDate: string, endDate: string) {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);
  const fullFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });

  if (startDate === endDate) {
    return fullFormatter.format(start);
  }

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  if (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth()
  ) {
    return `${monthFormatter.format(start)} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }

  return `${fullFormatter.format(start)} – ${fullFormatter.format(end)}`;
}

function parseCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw permanentDataError(
      "email_event_date_invalid",
      "The event date is invalid.",
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function permanentDataError(code: string, message: string) {
  return new EmailSendError({
    code,
    message,
    retryable: false,
    safeMessage:
      "Order information was incomplete, so the confirmation email was not sent.",
  });
}

function databaseError(code: string, error: { code?: string; message: string }) {
  return new EmailSendError({
    code,
    message: `${code}: ${error.code ?? error.message}`,
    retryable: true,
    safeMessage:
      "A temporary database error prevented the confirmation email from being sent.",
  });
}
