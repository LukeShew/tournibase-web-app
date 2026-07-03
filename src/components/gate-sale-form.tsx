"use client";

import { type FormEvent, useState } from "react";
import {
  eventDateFromTimestamp,
} from "@/lib/event-time";
import type {
  GateSalePaymentMethod,
  GateSaleTicketOption,
  RecordGateSaleInput,
  RecordGateSaleResult,
} from "@/lib/gate-sales-types";
import { formatEventDateRange } from "@/lib/tournaments";

const paymentMethods: Array<{
  description: string;
  label: string;
  value: GateSalePaymentMethod;
}> = [
  {
    description: "Physical cash collected at the gate",
    label: "Cash",
    value: "cash",
  },
  {
    description: "Payment received through Venmo",
    label: "Venmo",
    value: "venmo",
  },
  {
    description: "Card charged outside TourniBase",
    label: "External card",
    value: "card_outside_tournibase",
  },
  {
    description: "No payment collected",
    label: "Comp",
    value: "comp",
  },
];

export function GateSaleForm({
  eventTimeZone,
  recordSale,
  tickets,
}: {
  eventTimeZone: string;
  recordSale: (input: RecordGateSaleInput) => Promise<RecordGateSaleResult>;
  tickets: GateSaleTicketOption[];
}) {
  const [ticketTypeId, setTicketTypeId] = useState(tickets[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] =
    useState<GateSalePaymentMethod>("cash");
  const [buyerName, setBuyerName] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RecordGateSaleResult | null>(null);
  const selectedTicket = tickets.find(
    (ticket) => ticket.id === ticketTypeId,
  );
  const amount =
    paymentMethod === "comp"
      ? 0
      : (selectedTicket?.price ?? 0) * quantity;

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);

    try {
      setResult(
        await recordSale({
          buyerName,
          notes,
          paymentMethod,
          quantity,
          ticketTypeId,
        }),
      );
    } catch {
      setResult({
        message: "TourniBase could not record this gate sale. Try again.",
        status: "service_error",
      });
    } finally {
      setPending(false);
    }
  }

  function resetForm() {
    setBuyerName("");
    setNotes("");
    setQuantity(1);
    setResult(null);
  }

  if (result?.status === "recorded") {
    return (
      <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.07] p-6 text-center">
        <p className="text-sm font-semibold text-emerald-200">
          Gate sale recorded
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-white">
          ADMIT {result.quantity}
        </h1>
        <p className="mt-3 text-lg font-semibold text-white">
          {result.ticketName}
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {formatCurrency(result.amount)} ·{" "}
          {formatPaymentMethod(result.paymentMethod)}
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          This sale is saved in the tournament&apos;s gate records.
        </p>
        <button
          type="button"
          onClick={resetForm}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200"
        >
          Record another sale
        </button>
      </section>
    );
  }

  if (tickets.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-white/15 bg-card/60 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">
          No active ticket types
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Ask the tournament director to activate a ticket type before
          recording gate sales.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={submitSale} className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
          In-person admission
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
          Record a gate sale
        </h1>
        <p className="mt-3 leading-7 text-slate-400">
          Track payment collected outside TourniBase. This does not charge a
          card or create a digital pass.
        </p>

        <label
          htmlFor="gate-sale-ticket"
          className="mt-5 block text-sm font-medium text-slate-200"
        >
          Ticket type
        </label>
        <select
          id="gate-sale-ticket"
          value={ticketTypeId}
          onChange={(event) => setTicketTypeId(Number(event.target.value))}
          disabled={pending}
          className="mt-2 h-12 w-full rounded-xl border border-border bg-[#091321] px-3 text-base text-white outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
        >
          {tickets.map((ticket) => (
            <option key={ticket.id} value={ticket.id}>
              {ticket.name} · {formatCurrency(ticket.price)}
            </option>
          ))}
        </select>

        {selectedTicket ? (
          <p className="mt-2 text-xs text-slate-500">
            Valid{" "}
            {formatEventDateRange(
              eventDateFromTimestamp(
                selectedTicket.validFrom,
                eventTimeZone,
              ),
              eventDateFromTimestamp(
                selectedTicket.validUntil,
                eventTimeZone,
              ),
            )}
          </p>
        ) : null}

        <div className="mt-5">
          <span className="text-sm font-medium text-slate-200">Quantity</span>
          <div className="mt-2 flex items-center rounded-xl border border-border bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={pending || quantity === 1}
              aria-label="Decrease quantity"
              className="grid h-11 w-11 place-items-center rounded-lg text-xl text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              −
            </button>
            <output
              aria-label="Gate sale quantity"
              className="flex-1 text-center font-mono text-lg font-semibold text-white"
            >
              {quantity}
            </output>
            <button
              type="button"
              onClick={() =>
                setQuantity((current) => Math.min(100, current + 1))
              }
              disabled={pending || quantity === 100}
              aria-label="Increase quantity"
              className="grid h-11 w-11 place-items-center rounded-lg text-xl text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              +
            </button>
          </div>
        </div>
      </section>

      <fieldset className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <legend className="px-1 font-semibold text-white">
          Payment method
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {paymentMethods.map((method) => (
            <label
              key={method.value}
              className={`cursor-pointer rounded-2xl border p-4 transition focus-within:ring-4 focus-within:ring-brand/10 ${
                paymentMethod === method.value
                  ? "border-brand/60 bg-brand-soft"
                  : "border-border bg-black/10"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.value}
                checked={paymentMethod === method.value}
                onChange={() => setPaymentMethod(method.value)}
                disabled={pending}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-white">
                {method.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {method.description}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <label
          htmlFor="gate-sale-buyer"
          className="block text-sm font-medium text-slate-200"
        >
          Buyer name <span className="text-slate-600">(optional)</span>
        </label>
        <input
          id="gate-sale-buyer"
          value={buyerName}
          onChange={(event) => setBuyerName(event.target.value)}
          maxLength={160}
          disabled={pending}
          autoComplete="name"
          className="mt-2 h-12 w-full rounded-xl border border-border bg-black/20 px-3 text-base text-white outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
        />

        <label
          htmlFor="gate-sale-notes"
          className="mt-5 block text-sm font-medium text-slate-200"
        >
          Notes <span className="text-slate-600">(optional)</span>
        </label>
        <textarea
          id="gate-sale-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={500}
          rows={3}
          disabled={pending}
          placeholder="Team, discount, payment reference, or other context"
          className="mt-2 w-full resize-none rounded-xl border border-border bg-black/20 px-3 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-brand focus:ring-4 focus:ring-brand/10"
        />
      </section>

      {result ? (
        <p
          aria-live="polite"
          className="rounded-2xl border border-red-300/20 bg-red-300/[0.07] p-4 text-sm leading-6 text-red-100"
        >
          {result.message}
        </p>
      ) : null}

      <section className="sticky bottom-3 rounded-3xl border border-border bg-[#0b1625]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">Sale total</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {formatCurrency(amount)}
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || !selectedTicket}
            className="inline-flex h-12 min-w-44 items-center justify-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Recording…" : "Record sale"}
          </button>
        </div>
      </section>
    </form>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatPaymentMethod(method: GateSalePaymentMethod) {
  return {
    card_outside_tournibase: "External card",
    cash: "Cash",
    comp: "Comp",
    venmo: "Venmo",
  }[method];
}
