"use client";

import { useState } from "react";
import type {
  RecentScan,
  RecentScansResult,
} from "@/lib/recent-scans-types";

export function RecentGateScans({
  initialResult,
  refreshScans,
}: {
  initialResult: RecentScansResult;
  refreshScans: () => Promise<RecentScansResult>;
}) {
  const [result, setResult] = useState(initialResult);
  const [pending, setPending] = useState(false);

  async function refresh() {
    setPending(true);

    try {
      setResult(await refreshScans());
    } catch {
      setResult({
        message: "TourniBase could not load recent scans. Try again.",
        status: "service_error",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
              Scanner activity
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
              Recent scans
            </h1>
            <p className="mt-3 leading-7 text-slate-400">
              The latest results recorded by this scanner link.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={refresh}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      {result.status !== "ok" ? (
        <section
          aria-live="polite"
          className="mt-4 rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-amber-100"
        >
          {result.message}
        </section>
      ) : result.scans.length === 0 ? (
        <section className="mt-4 rounded-3xl border border-dashed border-white/15 bg-card/60 p-8 text-center">
          <h2 className="font-semibold text-white">No scans yet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Scan or manually validate a pass, then return here and refresh.
          </p>
        </section>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="px-1 text-sm text-slate-500">
            Showing {result.scans.length} most recent{" "}
            {result.scans.length === 1 ? "result" : "results"}
          </p>
          {result.scans.map((scan) => (
            <RecentScanCard
              key={scan.checkInId}
              scan={scan}
              timeZone={result.timeZone}
            />
          ))}
        </div>
      )}
    </>
  );
}

function RecentScanCard({
  scan,
  timeZone,
}: {
  scan: RecentScan;
  timeZone: string;
}) {
  const presentation = getResultPresentation(scan.result);

  return (
    <article className="rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-black ${presentation.text}`}>
            {presentation.label}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatScanTime(scan.scannedAt, timeZone)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {scan.wasOverride ? (
            <ScanBadge label="Override" tone="red" />
          ) : null}
          {scan.source === "manual" ? (
            <ScanBadge label="Manual" tone="blue" />
          ) : null}
          {scan.wasUndone ? (
            <ScanBadge label="Undone" tone="amber" />
          ) : null}
        </div>
      </div>

      <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-black/10 px-4">
        <ScanDetail
          label="Ticket"
          value={scan.ticketName ?? "Unknown pass"}
        />
        <ScanDetail
          label="Buyer"
          value={scan.buyerName ?? "Unavailable"}
        />
        <ScanDetail label="Gate" value={scan.gateName} />
        {scan.overrideReason ? (
          <ScanDetail label="Override reason" value={scan.overrideReason} />
        ) : null}
      </dl>
    </article>
  );
}

function ScanDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[65%] text-right font-medium text-slate-200">
        {value}
      </dd>
    </div>
  );
}

function ScanBadge({
  label,
  tone,
}: {
  label: string;
  tone: "amber" | "blue" | "red";
}) {
  const styles = {
    amber: "border-amber-300/20 bg-amber-300/[0.07] text-amber-200",
    blue: "border-blue-300/20 bg-blue-300/[0.07] text-blue-200",
    red: "border-red-300/20 bg-red-300/[0.07] text-red-200",
  }[tone];

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {label}
    </span>
  );
}

function getResultPresentation(result: RecentScan["result"]) {
  if (
    result === "valid" ||
    result === "manual_check_in" ||
    result === "override"
  ) {
    return { label: "VALID", text: "text-emerald-300" };
  }

  if (result === "already_used") {
    return { label: "ALREADY SCANNED", text: "text-red-300" };
  }

  if (result === "wrong_day") {
    return { label: "NOT VALID TODAY", text: "text-amber-300" };
  }

  if (result === "invalid") {
    return { label: "INVALID PASS", text: "text-red-300" };
  }

  return { label: "PASS NOT ACTIVE", text: "text-red-300" };
}

function formatScanTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(value));
}
