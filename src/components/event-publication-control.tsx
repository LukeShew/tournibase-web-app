"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setTournamentPublication } from "@/app/dashboard/tournaments/[id]/actions";
import { initialPublicationState } from "@/lib/form-states";

type TournamentStatus = "draft" | "published" | "closed" | "archived";

export function EventPublicationControl({
  activeTicketCount,
  checkoutConfigured,
  publicPath,
  status,
  tournamentId,
}: {
  activeTicketCount: number;
  checkoutConfigured: boolean;
  publicPath: string;
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
    status === "published" || (status === "draft" && activeTicketCount > 0);

  if (status === "closed" || status === "archived") {
    return (
      <p className="text-sm leading-6 text-slate-500">
        This event is {status}. Public ticket sales and publishing controls are
        unavailable.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
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

      <div aria-live="polite" className="mt-3 min-h-5">
        {state.message ? (
          <p
            className={`text-sm ${
              state.success ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {state.message}
          </p>
        ) : status === "draft" && activeTicketCount === 0 ? (
          <p className="text-sm text-amber-700">
            Add an active ticket before publishing.
          </p>
        ) : status === "draft" ? (
          <p className="text-sm text-slate-500">
            Publishing makes the event and active ticket types publicly
            visible.
          </p>
        ) : checkoutConfigured ? (
          <p className="text-sm text-emerald-700">
            Stripe Checkout is connected and ready for buyers.
          </p>
        ) : (
          <p className="text-sm text-amber-700">
            The page is public, but payment environment variables are still
            missing.
          </p>
        )}
      </div>
    </div>
  );
}
