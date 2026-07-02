"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialPublicationState,
  setTournamentPublication,
} from "@/app/dashboard/tournaments/[id]/actions";

type TournamentStatus = "draft" | "published" | "closed" | "archived";

export function EventPublicationControl({
  activeTicketCount,
  publicPath,
  status,
  tournamentId,
}: {
  activeTicketCount: number;
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
  const [state, action, pending] = useActionState(
    updateThisEvent,
    initialPublicationState,
  );
  const canPublish =
    status === "published" || (status === "draft" && activeTicketCount > 0);

  if (status === "closed" || status === "archived") {
    return (
      <p className="text-sm leading-6 text-slate-500">
        This event is {status}. Reopening controls will be added with event
        lifecycle management.
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
                ? "border border-border bg-white/5 text-slate-200 hover:bg-white/10"
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
            className="inline-flex h-11 items-center justify-center rounded-xl border border-brand/30 bg-brand-soft px-4 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20"
          >
            View public page
          </Link>
        ) : null}
      </div>

      <div aria-live="polite" className="mt-3 min-h-5">
        {state.message ? (
          <p
            className={`text-sm ${
              state.success ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {state.message}
          </p>
        ) : status === "draft" && activeTicketCount === 0 ? (
          <p className="text-sm text-amber-300">
            Add an active ticket before publishing.
          </p>
        ) : status === "draft" ? (
          <p className="text-sm text-slate-500">
            Publishing makes the event and active ticket types publicly
            visible.
          </p>
        ) : (
          <p className="text-sm text-amber-300">
            The page is public, but Stripe checkout is not connected yet.
          </p>
        )}
      </div>
    </div>
  );
}
