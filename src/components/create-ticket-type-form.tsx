"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createTicketType,
  initialTicketTypeFormState,
} from "@/app/dashboard/tournaments/[id]/tickets/actions";
import { TicketTypeFields } from "@/components/ticket-type-fields";

type CreateTicketTypeFormProps = {
  eventEndDate: string;
  eventStartDate: string;
  tournamentId: number;
};

export function CreateTicketTypeForm({
  eventEndDate,
  eventStartDate,
  tournamentId,
}: CreateTicketTypeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const createForTournament = createTicketType.bind(null, tournamentId);
  const [state, action, pending] = useActionState(
    createForTournament,
    initialTicketTypeFormState,
  );

  useEffect(() => {
    if (state.successId) {
      formRef.current?.reset();
    }
  }, [state.successId]);

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="border-b border-border pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
          New ticket type
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Add an admission option
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Create a day pass, weekend pass, child pass, comp pass, or another
          admission option.
        </p>
      </div>

      <div className="mt-6">
        <TicketTypeFields
          idPrefix="create-ticket"
          disabled={pending}
          errors={state.errors}
          defaults={{
            validFrom: eventStartDate,
            validUntil: eventEndDate,
            status: "active",
          }}
        />
      </div>

      <div
        aria-live="polite"
        className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-h-5">
          {state.message ? (
            <p
              className={`text-sm ${
                state.success ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {state.message}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Prices are stored to the nearest cent.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Creating…" : "Create ticket type"}
        </button>
      </div>
    </form>
  );
}
