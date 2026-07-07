import "server-only";

import { render } from "react-email";
import {
  createRefundConfirmationText,
  RefundConfirmationEmail,
  type RefundConfirmationEmailData,
} from "@/emails/refund-confirmation";
import {
  EmailSendError,
  getEmailProvider,
  normalizeEmailSendError,
  type EmailProvider,
} from "@/lib/email/provider";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type OrderRecord = {
  buyer_email: string;
  buyer_name: string;
  id: number;
  tournament_id: number;
};

type TournamentRecord = {
  contact_email: string;
  end_date: string;
  name: string;
  organizer_name: string;
  start_date: string;
  venue_name: string;
};

export type RefundEmailAttempt =
  | { status: "pending" }
  | { status: "sent"; messageId: string }
  | { status: "retryable_failure"; code: string }
  | { status: "permanent_failure"; code: string };

export type RefundConfirmationInput = {
  amountRefundedCents: number;
  amountTotalCents: number;
  orderId: number;
  status: "refunded" | "partial_refund";
};

export async function attemptRefundConfirmationEmail(
  input: RefundConfirmationInput,
  provider: EmailProvider = getEmailProvider(),
): Promise<RefundEmailAttempt> {
  if (!provider.isConfigured) {
    return { status: "pending" };
  }

  try {
    const { email, recipient } = await loadRefundEmail(input);
    const html = await render(RefundConfirmationEmail(email));
    const text = createRefundConfirmationText(email);
    const result = await provider.send({
      html,
      idempotencyKey: `refund-confirmation-${input.orderId}-${input.status}-${input.amountRefundedCents}`,
      replyTo: email.organizerEmail,
      subject:
        input.status === "refunded"
          ? `Your ${email.eventName} refund was processed`
          : `Your ${email.eventName} partial refund was processed`,
      text,
      to: recipient,
    });

    return { status: "sent", messageId: result.messageId };
  } catch (error) {
    const normalized = normalizeEmailSendError(error);

    return {
      status: normalized.retryable ? "retryable_failure" : "permanent_failure",
      code: normalized.code,
    };
  }
}

async function loadRefundEmail(
  input: RefundConfirmationInput,
): Promise<{
  email: RefundConfirmationEmailData;
  recipient: string;
}> {
  const supabase = getSupabaseAdmin();
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("id, tournament_id, buyer_name, buyer_email")
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError) {
    throw databaseError("refund_email_order_lookup_failed", orderError);
  }

  if (!orderRow) {
    throw permanentDataError(
      "refund_email_order_missing",
      "The refunded order no longer exists.",
    );
  }

  const order = orderRow as OrderRecord;
  const { data: tournamentRow, error: tournamentError } = await supabase
    .from("tournaments")
    .select("name, start_date, end_date, venue_name, organizer_name, contact_email")
    .eq("id", order.tournament_id)
    .maybeSingle();

  if (tournamentError) {
    throw databaseError("refund_email_tournament_lookup_failed", tournamentError);
  }

  if (!tournamentRow) {
    throw permanentDataError(
      "refund_email_tournament_missing",
      "The refunded order event no longer exists.",
    );
  }

  const tournament = tournamentRow as TournamentRecord;
  const siteUrl = getSiteUrl();

  return {
    email: {
      amountPaid: formatCurrency(input.amountTotalCents / 100),
      amountRefunded: formatCurrency(input.amountRefundedCents / 100),
      buyerName: order.buyer_name,
      eventDate: formatCalendarDateRange(
        tournament.start_date,
        tournament.end_date,
      ),
      eventName: tournament.name,
      logoUrl: `${siteUrl}/icon.png`,
      orderNumber: `TB-${order.id.toString().padStart(6, "0")}`,
      organizerEmail: tournament.contact_email,
      organizerName: tournament.organizer_name,
      refundStatus: input.status,
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
      "refund_email_event_date_invalid",
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
      "Order information was incomplete, so the refund email was not sent.",
  });
}

function databaseError(code: string, error: { code?: string; message: string }) {
  return new EmailSendError({
    code,
    message: `${code}: ${error.code ?? error.message}`,
    retryable: true,
    safeMessage:
      "A temporary database error prevented the refund email from being sent.",
  });
}
