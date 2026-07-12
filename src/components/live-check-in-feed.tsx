"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { matchesStrictText, matchesTightName } from "@/lib/search-match";

export type LiveCheckIn = {
  buyerName: string;
  gateName: string;
  id: number;
  result: "manual_check_in" | "override" | "valid";
  scannedAt: string;
  source: "camera" | "manual";
  ticketName: string;
};

export function LiveCheckInFeed({
  checkIns,
  timeZone,
}: {
  checkIns: LiveCheckIn[];
  timeZone: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const preview = checkIns.slice(0, 5);
  const filteredCheckIns = query.trim()
    ? checkIns.filter(
        (checkIn) =>
          matchesTightName(checkIn.buyerName, query) ||
          matchesStrictText(checkIn.ticketName, query) ||
          matchesStrictText(checkIn.gateName, query) ||
          matchesStrictText(formatResult(checkIn.result), query),
      )
    : checkIns;

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-card-strong px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-950">Live scanner feed</h2>
              <p className="mt-1 text-sm text-slate-500">
                Most recent successful check-ins for this event.
              </p>
            </div>
            <button
              type="button"
              className="rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={checkIns.length === 0}
              onClick={() => setIsOpen(true)}
            >
              View full list
            </button>
          </div>
        </div>

        {preview.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-lg text-blue-700">
              ✓
            </div>
            <h3 className="mt-4 font-semibold text-slate-950">
              No check-ins yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Successful scans will appear here after gate staff start checking
              people in.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {preview.map((checkIn) => (
              <CheckInRow key={checkIn.id} checkIn={checkIn} timeZone={timeZone} />
            ))}
          </div>
        )}
      </section>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Full live scanner feed"
        >
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-card-strong px-6 py-5">
              <div>
                <p className="text-sm font-semibold text-blue-700">
                  Live scanner feed
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  Full check-in list
                </h2>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl leading-none text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-950"
                aria-label="Close full check-in list"
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                ×
              </button>
            </div>
            <form
              className="flex flex-col gap-3 border-b border-border bg-card-strong px-6 py-4 sm:flex-row"
              onSubmit={(event) => event.preventDefault()}
              role="search"
            >
              <label className="sr-only" htmlFor="scanner-feed-search">
                Search check-ins
              </label>
              <input
                id="scanner-feed-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search buyer, ticket, or gate"
                autoComplete="off"
                className="min-h-11 min-w-0 flex-1 rounded-2xl border border-border bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                Search
              </button>
              {query ? (
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                  onClick={() => setQuery("")}
                >
                  Clear
                </button>
              ) : null}
            </form>
            <div className="max-h-[calc(85vh-193px)] overflow-y-auto divide-y divide-border">
              {filteredCheckIns.length > 0 ? (
                filteredCheckIns.map((checkIn) => (
                  <CheckInRow
                    key={checkIn.id}
                    checkIn={checkIn}
                    timeZone={timeZone}
                  />
                ))
              ) : (
                <div className="px-6 py-12 text-center">
                  <h3 className="font-semibold text-slate-950">
                    No matching check-ins
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Try another buyer name, ticket, or gate.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CheckInRow({
  checkIn,
  timeZone,
}: {
  checkIn: LiveCheckIn;
  timeZone: string;
}) {
  return (
    <article className="flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-950">{checkIn.buyerName}</h3>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            {formatResult(checkIn.result)}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{checkIn.ticketName}</p>
      </div>
      <div className="text-left sm:text-right">
        <p className="font-mono text-xs text-slate-500">
          {formatDateTime(checkIn.scannedAt, timeZone)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {checkIn.gateName} · {checkIn.source === "manual" ? "Manual" : "Scan"}
        </p>
      </div>
    </article>
  );
}

function formatResult(result: LiveCheckIn["result"]) {
  if (result === "manual_check_in") {
    return "Manual";
  }

  if (result === "override") {
    return "Override";
  }

  return "Checked in";
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
  }).format(new Date(value));
}
