"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setTournamentPublication } from "@/app/dashboard/tournaments/[id]/actions";
import { initialPublicationState } from "@/lib/form-states";
import { getIdlePublicationMessage } from "@/lib/publication-message";

type TournamentStatus = "draft" | "published" | "closed" | "archived";

export function EventPublicationControl({
  activeTicketCount,
  align = "start",
  checkoutConfigured,
  hasPaidTickets,
  paymentReady,
  publicPath,
  showIdleMessage = true,
  status,
  tournamentId,
}: {
  activeTicketCount: number;
  align?: "end" | "start";
  checkoutConfigured: boolean;
  hasPaidTickets: boolean;
  paymentReady: boolean;
  publicPath: string;
  showIdleMessage?: boolean;
  status: TournamentStatus;
  tournamentId: number;
}) {
  const nextStatus = status === "published" ? "draft" : "published";
  const updateThisEvent = setTournamentPublication.bind(
    null,
    tournamentId,
    nextStatus,
  );
  const [actionState, action, pending] = useActionState(
    updateThisEvent,
    initialPublicationState,
  );
  const state = actionState ?? initialPublicationState;
  const canPublish =
    status === "published" ||
    (status === "draft" &&
      activeTicketCount > 0 &&
      (!hasPaidTickets || (paymentReady && checkoutConfigured)));

  if (status === "closed" || status === "archived") {
    return (
      <p
        className={`text-sm leading-6 text-slate-500 ${
          align === "end" ? "sm:text-right" : ""
        }`}
      >
        This event is {status}. Public ticket sales and publishing controls are
        unavailable.
      </p>
    );
  }

  const idleMessage = getIdlePublicationMessage({
    activeTicketCount,
    checkoutConfigured,
    hasPaidTickets,
    paymentReady,
    status,
  });
  const visibleMessage = state.message
    ? {
        className: state.success ? "text-emerald-700" : "text-red-600",
        text: state.message,
      }
    : showIdleMessage
      ? idleMessage
      : null;

  return (
    <div>
      <div
        className={`flex flex-col gap-3 sm:flex-row ${
          align === "end" ? "sm:justify-end" : ""
        }`}
      >
        <form action={action}>
          <button
            type="submit"
            disabled={pending || !canPublish}
            className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold transition sm:w-auto ${
              status === "published"
                ? "border border-border bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-950"
                : "bg-brand-strong text-white hover:bg-blue-500"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {pending
              ? "Updating…"
              : status === "published"
                ? "Return to draft"
                : "Publish ticket page"}
          </button>
        </form>
        {status === "published" ? (
          <Link
            href={publicPath}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-blue-100 bg-brand-soft px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            View public page
          </Link>
        ) : null}
      </div>

      {visibleMessage ? (
        <div
          aria-live="polite"
          className={`mt-3 min-h-5 ${align === "end" ? "sm:text-right" : ""}`}
        >
          <p className={`text-sm ${visibleMessage.className}`}>
            {visibleMessage.text}
          </p>
        </div>
      ) : null}
    </div>
  );
}
