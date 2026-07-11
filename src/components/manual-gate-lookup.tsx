"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ManualLookupCheckInInput,
  ManualLookupCheckInResult,
  ManualLookupOrder,
  ManualLookupResult,
} from "@/lib/manual-lookup-types";
import { formatEventValidity } from "@/lib/event-time";

export function ManualGateLookup({
  checkInPass,
  eventTimeZone,
  lookupOrders,
}: {
  checkInPass: (
    input: ManualLookupCheckInInput,
  ) => Promise<ManualLookupCheckInResult>;
  eventTimeZone: string;
  lookupOrders: (query: string) => Promise<ManualLookupResult>;
}) {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [orders, setOrders] = useState<ManualLookupOrder[]>([]);
  const [searchPending, setSearchPending] = useState(false);
  const [checkInPendingId, setCheckInPendingId] = useState<number | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [checkInResult, setCheckInResult] =
    useState<ManualLookupCheckInResult | null>(null);
  const lookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupRequestRef = useRef(0);

  const runLookup = useCallback(async (searchQuery: string) => {
    const requestId = lookupRequestRef.current + 1;
    lookupRequestRef.current = requestId;
    setSearchPending(true);
    setNotice(null);

    try {
      const result = await lookupOrders(searchQuery);

      if (lookupRequestRef.current !== requestId) {
        return;
      }

      if (result.status === "ok") {
        setOrders(result.orders);
        setSearchedQuery(searchQuery);
      } else {
        setOrders([]);
        setNotice(result.message);
      }
    } catch {
      if (lookupRequestRef.current !== requestId) {
        return;
      }

      setOrders([]);
      setNotice("TourniBase could not search orders. Try again.");
    } finally {
      if (lookupRequestRef.current === requestId) {
        setSearchPending(false);
      }
    }
  }, [lookupOrders]);

  useEffect(() => {
    const searchQuery = query.trim();

    if (searchQuery.length < 2) {
      return;
    }

    lookupTimeoutRef.current = setTimeout(() => {
      setCheckInResult(null);
      void runLookup(searchQuery);
    }, 300);

    return () => {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
    };
  }, [query, runLookup]);

  async function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckInResult(null);

    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    const searchQuery = query.trim();

    if (searchQuery.length < 2) {
      setNotice("Enter at least 2 characters.");
      return;
    }

    await runLookup(searchQuery);
  }

  async function checkInPassById(passId: number) {
    setCheckInPendingId(passId);
    setNotice(null);

    try {
      const result = await checkInPass({ passId });
      setCheckInResult(result);

      if (searchedQuery && result.status === "valid") {
        await runLookup(searchedQuery);
      }
    } catch {
      setCheckInResult({
        message: "TourniBase could not check in this pass. Try again.",
        status: "service_error",
      });
    } finally {
      setCheckInPendingId(null);
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
          Gate support
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
          Find a buyer or order
        </h1>
        <p className="mt-3 leading-7 text-slate-400">
          Search by buyer name, email, phone, or order number.
        </p>

        <form onSubmit={submitLookup} className="mt-5">
          <label
            htmlFor="gate-order-search"
            className="text-sm font-medium text-slate-200"
          >
            Buyer or order
          </label>
          <input
            id="gate-order-search"
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);

              if (nextQuery.trim().length < 2) {
                lookupRequestRef.current += 1;
                setOrders([]);
                setSearchedQuery("");
                setNotice(null);
                setSearchPending(false);
              }
            }}
            minLength={2}
            maxLength={100}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Name, email, phone, or TB-000001"
            className="mt-2 h-12 w-full rounded-xl border border-border bg-black/20 px-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <button
            type="submit"
            disabled={searchPending || query.trim().length < 2}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searchPending ? "Searching…" : "Search orders"}
          </button>
        </form>

        {notice ? (
          <p
            aria-live="polite"
            className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-sm leading-6 text-amber-100"
          >
            {notice}
          </p>
        ) : null}
      </section>

      {checkInResult ? (
        <ManualCheckInNotice result={checkInResult} />
      ) : null}

      {searchedQuery && orders.length === 0 && !searchPending && !notice ? (
        <section className="mt-4 rounded-3xl border border-border bg-card p-6 text-center">
          <h2 className="font-semibold text-white">No matching orders</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Check the spelling or try the buyer&apos;s email, phone, or order
            number.
          </p>
        </section>
      ) : null}

      {orders.length > 0 ? (
        <div className="mt-4 space-y-4">
          <p className="px-1 text-sm text-slate-400">
            {orders.length} {orders.length === 1 ? "order" : "orders"} found
          </p>
          {orders.map((order) => (
            <OrderResult
              key={order.orderId}
              checkInPendingId={checkInPendingId}
              eventTimeZone={eventTimeZone}
              onCheckIn={checkInPassById}
              order={order}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function OrderResult({
  checkInPendingId,
  eventTimeZone,
  onCheckIn,
  order,
}: {
  checkInPendingId: number | null;
  eventTimeZone: string;
  onCheckIn: (passId: number) => void;
  order: ManualLookupOrder;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-blue-300">
            {order.orderNumber}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {order.buyerName}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{order.buyerEmail}</p>
          {order.buyerPhone ? (
            <p className="mt-0.5 text-sm text-slate-400">
              {order.buyerPhone}
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-xs font-semibold text-emerald-200">
          {formatPaymentStatus(order.paymentStatus)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <OrderMetric label="Unused passes" value={order.unusedPasses} />
        <OrderMetric label="Already scanned" value={order.scannedPasses} />
      </div>

      <div className="mt-5 space-y-2">
        {order.passes.map((pass) => {
          const isPending = checkInPendingId === pass.passId;

          return (
            <div
              key={pass.passId}
              className="rounded-2xl border border-border bg-black/15 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">
                    {pass.ticketName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatEventValidity(
                      pass.validFrom,
                      pass.validUntil,
                      eventTimeZone,
                    )}
                  </p>
                </div>
                <PassStatus status={pass.status} />
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Admissions: {pass.admissionsUsed} of {pass.usesAllowed}
              </p>

              {pass.canCheckIn ? (
                <button
                  type="button"
                  disabled={checkInPendingId !== null}
                  onClick={() => onCheckIn(pass.passId)}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Checking in…" : "Check in this pass"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ManualCheckInNotice({
  result,
}: {
  result: ManualLookupCheckInResult;
}) {
  const presentation = getCheckInPresentation(result);

  return (
    <section
      aria-live="assertive"
      className={`mt-4 rounded-3xl border p-5 ${presentation.container}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${presentation.eyebrow}`}>
        {presentation.label}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
        {presentation.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {result.message}
      </p>
      {"ticketName" in result ? (
        <p className="mt-3 text-sm font-semibold text-white">
          {result.ticketName}
        </p>
      ) : null}
    </section>
  );
}

function OrderMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-black/15 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function PassStatus({
  status,
}: {
  status: ManualLookupOrder["passes"][number]["status"];
}) {
  const label = {
    active: "Unused",
    checked_in: "Scanned",
    expired: "Expired",
    refunded: "Refunded",
    voided: "Voided",
  }[status];

  return (
    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-slate-300">
      {label}
    </span>
  );
}

function getCheckInPresentation(result: ManualLookupCheckInResult) {
  if (result.status === "valid") {
    return {
      container: "border-emerald-300/20 bg-emerald-300/[0.08]",
      eyebrow: "text-emerald-200",
      label: "Manual check-in recorded",
      title: "VALID",
    };
  }

  if (result.status === "already_used") {
    return {
      container: "border-red-300/20 bg-red-300/[0.08]",
      eyebrow: "text-red-200",
      label: "Admission blocked",
      title: "ALREADY SCANNED",
    };
  }

  if (result.status === "wrong_day") {
    return {
      container: "border-amber-300/20 bg-amber-300/[0.07]",
      eyebrow: "text-amber-200",
      label: "Admission blocked",
      title: "NOT VALID TODAY",
    };
  }

  return {
    container: "border-red-300/20 bg-red-300/[0.08]",
    eyebrow: "text-red-200",
    label: "Check-in failed",
    title:
      result.status === "not_active" ? "PASS NOT ACTIVE" : "CHECK-IN FAILED",
  };
}

function formatPaymentStatus(
  status: ManualLookupOrder["paymentStatus"],
) {
  return {
    failed: "Payment failed",
    paid: "Paid order",
    partial_refund: "Partially refunded",
    pending: "Payment pending",
    refunded: "Refunded order",
  }[status];
}
