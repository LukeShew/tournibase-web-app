"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  setTicketTypeStatus,
  updateTicketType,
} from "@/app/dashboard/tournaments/[id]/tickets/actions";
import { TicketTypeFields } from "@/components/ticket-type-fields";
import { initialTicketTypeFormState } from "@/lib/form-states";
import { formatEventDateRange } from "@/lib/tournaments";

export type TicketTypeRecord = {
  created_at: string;
  description: string | null;
  id: number;
  name: string;
  price: number | string;
  quantity_limit: number | null;
  status: "active" | "inactive" | "sold_out";
  valid_from: string;
  valid_until: string;
};

export function TicketTypeCard({ ticketType }: { ticketType: TicketTypeRecord }) {
  const updateThisTicket = updateTicketType.bind(null, ticketType.id);
  const [actionState, action, pending] = useActionState(
    updateThisTicket,
    initialTicketTypeFormState,
  );
  const state = actionState ?? initialTicketTypeFormState;
  const nextStatus = ticketType.status === "active" ? "inactive" : "active";
  const setStatusForTicket = setTicketTypeStatus.bind(
    null,
    ticketType.id,
    nextStatus,
  );

  return (
    <article className="rounded-2xl border border-border bg-card">
      <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{ticketType.name}</h3>
            <StatusBadge status={ticketType.status} />
          </div>
          <p className="mt-2 font-mono text-sm text-blue-300">
            {formatCurrency(ticketType.price)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {formatEventDateRange(
              ticketType.valid_from.slice(0, 10),
              ticketType.valid_until.slice(0, 10),
            )}
          </p>
          {ticketType.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              {ticketType.description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-400">
            {ticketType.quantity_limit
              ? `${ticketType.quantity_limit.toLocaleString()} max`
              : "Unlimited"}
          </span>
          <form action={setStatusForTicket}>
            <TicketStatusButton nextStatus={nextStatus} />
          </form>
        </div>
      </div>

      <details className="border-t border-border">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.025] hover:text-white">
          Edit ticket details
        </summary>
        <form action={action} className="border-t border-border px-5 py-5">
          <TicketTypeFields
            idPrefix={`ticket-${ticketType.id}`}
            disabled={pending}
            errors={state.errors}
            defaults={{
              name: ticketType.name,
              price: Number(ticketType.price).toFixed(2),
              validFrom: ticketType.valid_from.slice(0, 10),
              validUntil: ticketType.valid_until.slice(0, 10),
              description: ticketType.description ?? "",
              quantityLimit: ticketType.quantity_limit?.toString() ?? "",
              status: ticketType.status === "active" ? "active" : "inactive",
            }}
          />

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
              ) : null}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </details>
    </article>
  );
}

function TicketStatusButton({
  nextStatus,
}: {
  nextStatus: "active" | "inactive";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-white/5 px-3 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-70"
    >
      {pending
        ? "Updating…"
        : nextStatus === "active"
          ? "Activate"
          : "Deactivate"}
    </button>
  );
}

function StatusBadge({ status }: { status: TicketTypeRecord["status"] }) {
  const className =
    status === "active"
      ? "bg-emerald-400/10 text-emerald-300"
      : status === "sold_out"
        ? "bg-amber-400/10 text-amber-300"
        : "bg-white/5 text-slate-400";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${className}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}
