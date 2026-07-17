export type TournamentPublicationStatus =
  | "archived"
  | "closed"
  | "draft"
  | "published";

export function getIdlePublicationMessage({
  activeTicketCount,
  checkoutConfigured,
  hasPaidTickets,
  paymentReady,
  status,
}: {
  activeTicketCount: number;
  checkoutConfigured: boolean;
  hasPaidTickets: boolean;
  paymentReady: boolean;
  status: TournamentPublicationStatus;
}) {
  if (status === "closed" || status === "archived") {
    return {
      className: "text-slate-500",
      text: `This event is ${status}. Public ticket sales and publishing controls are unavailable.`,
    };
  }

  if (status === "draft" && activeTicketCount === 0) {
    return {
      className: "text-amber-700",
      text: "Add an active ticket before publishing.",
    };
  }

  if (status === "draft" && hasPaidTickets && !paymentReady) {
    return {
      className: "text-amber-700",
      text: "Connect a ready Stripe account in Settings before publishing paid tickets.",
    };
  }

  if (status === "draft" && hasPaidTickets && !checkoutConfigured) {
    return {
      className: "text-amber-700",
      text: "Paid checkout setup is incomplete. Finish the Stripe and server configuration before publishing.",
    };
  }

  if (status === "draft") {
    return {
      className: "text-slate-500",
      text: "Publishing makes the event and active ticket types publicly visible.",
    };
  }

  if (hasPaidTickets && !paymentReady) {
    return {
      className: "text-amber-700",
      text: "This page is public, but paid checkout is paused until the organizer’s Stripe account is ready.",
    };
  }

  if (!hasPaidTickets) {
    return {
      className: "text-emerald-700",
      text: "The free ticket page is public and ready for guests.",
    };
  }

  if (checkoutConfigured) {
    return {
      className: "text-emerald-700",
      text: "Stripe Checkout is connected and ready for buyers.",
    };
  }

  return {
    className: "text-amber-700",
    text: "The page is public, but paid checkout is paused because the Stripe or server configuration is incomplete.",
  };
}
