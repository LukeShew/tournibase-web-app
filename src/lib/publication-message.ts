export type TournamentPublicationStatus =
  | "archived"
  | "closed"
  | "draft"
  | "published";

export function getIdlePublicationMessage({
  activeTicketCount,
  checkoutConfigured,
  status,
}: {
  activeTicketCount: number;
  checkoutConfigured: boolean;
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

  if (status === "draft") {
    return {
      className: "text-slate-500",
      text: "Publishing makes the event and active ticket types publicly visible.",
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
    text: "The page is public, but payment environment variables are still missing.",
  };
}
