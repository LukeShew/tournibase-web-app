"use client";

import { useState, type FormEvent } from "react";
import { formatEventDateRange } from "@/lib/tournaments";

export type PublicTicketOption = {
  description: string | null;
  id: number;
  name: string;
  price: number | string;
  quantityLimit: number | null;
  validFrom: string;
  validUntil: string;
};

export function PublicTicketForm({
  eventName,
  tickets,
}: {
  eventName: string;
  tickets: PublicTicketOption[];
}) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");
  const selectedCount = Object.values(quantities).reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const totalCents = tickets.reduce(
    (total, ticket) =>
      total +
      Math.round(Number(ticket.price) * 100) *
        (quantities[ticket.id] ?? 0),
    0,
  );

  function changeQuantity(ticket: PublicTicketOption, change: number) {
    const maximum = Math.min(ticket.quantityLimit ?? 10, 10);

    setQuantities((current) => {
      const nextQuantity = Math.max(
        0,
        Math.min(maximum, (current[ticket.id] ?? 0) + change),
      );

      return {
        ...current,
        [ticket.id]: nextQuantity,
      };
    });
    setMessage("");
  }

  function beginCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedCount === 0) {
      setMessage("Choose at least one pass before continuing.");
      return;
    }

    setMessage(
      "Online checkout is not available yet. No order was created and you have not been charged.",
    );
  }

  return (
    <form onSubmit={beginCheckout} className="space-y-6">
      <fieldset>
        <legend className="text-xl font-semibold text-white">
          Choose your passes
        </legend>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Select the number of people who need admission.
        </p>

        <div className="mt-4 space-y-3">
          {tickets.map((ticket) => {
            const quantity = quantities[ticket.id] ?? 0;
            const maximum = Math.min(ticket.quantityLimit ?? 10, 10);

            return (
              <div
                key={ticket.id}
                className={`rounded-2xl border p-4 transition sm:p-5 ${
                  quantity > 0
                    ? "border-brand/60 bg-brand-soft"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-white">{ticket.name}</h3>
                      <span className="font-mono text-sm font-semibold text-blue-300">
                        {formatCurrency(ticket.price)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      Valid{" "}
                      {formatEventDateRange(
                        ticket.validFrom.slice(0, 10),
                        ticket.validUntil.slice(0, 10),
                      )}
                    </p>
                    {ticket.description ? (
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                        {ticket.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center rounded-xl border border-border bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => changeQuantity(ticket, -1)}
                      disabled={quantity === 0}
                      aria-label={`Remove one ${ticket.name}`}
                      className="grid h-10 w-10 place-items-center rounded-lg text-lg text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      −
                    </button>
                    <output
                      aria-label={`${ticket.name} quantity`}
                      className="w-10 text-center font-mono font-semibold text-white"
                    >
                      {quantity}
                    </output>
                    <button
                      type="button"
                      onClick={() => changeQuantity(ticket, 1)}
                      disabled={quantity >= maximum}
                      aria-label={`Add one ${ticket.name}`}
                      className="grid h-10 w-10 place-items-center rounded-lg text-lg text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <legend className="px-1 text-xl font-semibold text-white">
          Buyer information
        </legend>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Pass links will be connected to this contact information.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <BuyerField id="first-name" label="First name">
            <input
              id="first-name"
              name="firstName"
              autoComplete="given-name"
              required
              maxLength={80}
              className={inputClassName}
            />
          </BuyerField>
          <BuyerField id="last-name" label="Last name">
            <input
              id="last-name"
              name="lastName"
              autoComplete="family-name"
              required
              maxLength={80}
              className={inputClassName}
            />
          </BuyerField>
          <BuyerField id="buyer-email" label="Email">
            <input
              id="buyer-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className={inputClassName}
            />
          </BuyerField>
          <BuyerField id="buyer-phone" label="Phone (optional)">
            <input
              id="buyer-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              className={inputClassName}
            />
          </BuyerField>
          <BuyerField
            id="team-name"
            label="Team name (optional)"
            className="sm:col-span-2"
          >
            <input
              id="team-name"
              name="teamName"
              autoComplete="organization"
              maxLength={120}
              className={inputClassName}
            />
          </BuyerField>
        </div>
      </fieldset>

      <div className="rounded-2xl border border-border bg-card-strong p-5 sm:p-6">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-sm text-slate-400">
              {selectedCount} {selectedCount === 1 ? "pass" : "passes"} selected
            </p>
            <p className="mt-1 text-xs text-slate-500">{eventName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Total
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-white">
              {formatCurrency(totalCents / 100)}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={selectedCount === 0}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Buy Digital Pass
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
          {selectedCount === 0
            ? "Choose at least one pass above to continue."
            : "Payment is not collected until secure checkout is connected."}
        </p>
        <div aria-live="polite" className="min-h-6">
          {message ? (
            <p
              className={`mt-3 rounded-xl px-4 py-3 text-sm leading-6 ${
                selectedCount === 0
                  ? "bg-red-400/10 text-red-200"
                  : "bg-amber-400/10 text-amber-200"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

const inputClassName =
  "mt-2 h-11 w-full rounded-xl border border-border bg-black/20 px-3 text-sm text-white placeholder:text-slate-600 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

function BuyerField({
  children,
  className = "",
  id,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  id: string;
  label: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
    </div>
  );
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}
