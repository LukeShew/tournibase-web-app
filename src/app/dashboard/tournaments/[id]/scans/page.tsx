import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardMetricCard } from "@/components/dashboard-metric-card";
import { requireDirector } from "@/lib/auth";
import {
  formatCurrency,
  getTournamentDashboardMetrics,
} from "@/lib/dashboard-metrics";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Gate activity",
};

export default async function TournamentScansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    notFound();
  }

  await requireDirector();
  const metrics = await getTournamentDashboardMetrics(tournamentId);

  if (!metrics) {
    notFound();
  }

  const checkInRate =
    metrics.sales.onlineTicketsSold === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (metrics.gate.checkedInPasses /
              metrics.sales.onlineTicketsSold) *
              100,
          ),
        );

  return (
    <div className="pb-12">
      <Link
        href={`/dashboard/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <span aria-hidden="true">←</span>
        Back to event
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            {metrics.tournament.name}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
            Gate activity
          </h1>
          <p className="mt-3 font-mono text-sm text-slate-400">
            {formatEventDateRange(
              metrics.tournament.startDate,
              metrics.tournament.endDate,
            )}
          </p>
        </div>
        <Link
          href={`/dashboard/tournaments/${tournamentId}/gate`}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          Manage scanner links
        </Link>
      </div>

      <section className="mt-8 rounded-[2rem] border border-blue-100 bg-card p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              Live event snapshot
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Admission progress
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {metrics.gate.checkedInPasses} of{" "}
              {metrics.sales.onlineTicketsSold} online passes checked in.
            </p>
          </div>
          <p className="font-mono text-4xl font-semibold text-blue-700">
            {checkInRate}%
          </p>
        </div>
        <div
          className="mt-5 h-3 overflow-hidden rounded-full bg-card-strong"
          role="progressbar"
          aria-label="Online pass check-in progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={checkInRate}
        >
          <div
            className="h-full rounded-full bg-blue-600"
            style={{ width: `${checkInRate}%` }}
          />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SnapshotItem
            label="Online tickets sold"
            value={metrics.sales.onlineTicketsSold}
          />
          <SnapshotItem
            label="Checked in"
            value={metrics.gate.checkedInPasses}
          />
          <SnapshotItem
            label="Unscanned passes"
            value={metrics.gate.unscannedPasses}
          />
          <SnapshotItem
            label="Manual gate admissions"
            value={metrics.sales.manualAdmissions}
          />
          <SnapshotItem
            label="Duplicate attempts"
            value={metrics.gate.duplicateAttempts}
          />
          <SnapshotItem
            label="Estimated revenue"
            value={formatCurrency(metrics.sales.totalEstimatedRevenue)}
          />
        </div>
      </section>

      <section className="mt-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            Gate activity
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Validation results
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Successful check-ins exclude entries that gate staff later undid.
            Attempt categories remain in the audit history.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard
            detail="Every camera and manual validation"
            label="Total scan attempts"
            value={metrics.gate.totalScanAttempts}
          />
          <DashboardMetricCard
            detail="Valid, manual, and override admissions"
            label="Successful check-ins"
            value={metrics.gate.successfulCheckIns}
          />
          <DashboardMetricCard
            detail="Passes presented again"
            label="Duplicate attempts"
            value={metrics.gate.duplicateAttempts}
          />
          <DashboardMetricCard
            detail="Unknown or malformed passes"
            label="Invalid attempts"
            value={metrics.gate.invalidAttempts}
          />
          <DashboardMetricCard
            detail="Valid passes used on another day"
            label="Wrong-day attempts"
            value={metrics.gate.wrongDayAttempts}
          />
          <DashboardMetricCard
            detail="Passes entered through lookup"
            label="Manual check-ins"
            value={metrics.gate.manualCheckIns}
          />
          <DashboardMetricCard
            detail="Director-approved exceptions"
            label="Overrides"
            value={metrics.gate.overrides}
          />
          <DashboardMetricCard
            detail={`${metrics.scannerLinks.active} active of ${metrics.scannerLinks.total} total`}
            label="Scanner links"
            value={metrics.scannerLinks.active}
          />
        </div>
      </section>
    </div>
  );
}

function SnapshotItem({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-3xl bg-card-strong px-4 py-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-xl font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}
