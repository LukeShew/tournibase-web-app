import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RevenueTrendCard } from "@/components/revenue-trend-card";
import { requireDirector } from "@/lib/auth";
import {
  formatCurrency,
  getTournamentDashboardMetrics,
  type TournamentDashboardMetrics,
} from "@/lib/dashboard-metrics";
import {
  getOrganizationStripeAccount,
  getStripeConnectConfigurationIssues,
  getStripeConnectStatus,
} from "@/lib/stripe-connect";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Event overview",
};

type Tournament = {
  end_date: string;
  id: number;
  name: string;
  organization_id: number;
  public_slug: string;
  start_date: string;
  status: "draft" | "published" | "closed" | "archived";
};

export default async function TournamentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = Number(id);

  if (!Number.isSafeInteger(tournamentId) || tournamentId < 1) {
    notFound();
  }

  const director = await requireDirector();
  const supabase = await createClient();
  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", director.id);

  if (organizationError) {
    throw organizationError;
  }

  const organizationIds = (organizationRows ?? []).map(
    (organization) => organization.id as number,
  );

  if (organizationIds.length === 0) {
    notFound();
  }

  const { data: tournamentRow, error: tournamentError } = await supabase
    .from("tournaments")
    .select(
      "id, organization_id, name, start_date, end_date, status, public_slug",
    )
    .eq("id", tournamentId)
    .in("organization_id", organizationIds)
    .maybeSingle();

  if (tournamentError) {
    throw tournamentError;
  }

  if (!tournamentRow) {
    notFound();
  }

  const tournament = tournamentRow as Tournament;
  const [metrics, stripeAccount, paidTicketResult] = await Promise.all([
    getTournamentDashboardMetrics(tournamentId),
    getOrganizationStripeAccount(tournament.organization_id),
    supabase
      .from("ticket_types")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("status", "active")
      .gt("price", 0)
      .limit(1),
  ]);

  if (!metrics) {
    notFound();
  }

  if (paidTicketResult.error) {
    throw paidTicketResult.error;
  }

  const stripeStatus = getStripeConnectStatus(stripeAccount);
  const needsStripeConnection =
    (paidTicketResult.data?.length ?? 0) > 0 && stripeStatus !== "ready";
  const connectConfigured =
    getStripeConnectConfigurationIssues().length === 0;
  const publicPath = `/e/${tournament.public_slug}`;

  return (
    <div className="pb-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <span aria-hidden="true">←</span>
        Back to events
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-blue-700">
              Youth basketball admission
            </p>
            <span className="rounded-full border border-border bg-card-strong px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
              {tournament.status}
            </span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
            {tournament.name}
          </h1>
          <p className="mt-3 font-mono text-sm text-slate-500">
            {formatEventDateRange(
              tournament.start_date,
              tournament.end_date,
            )}
          </p>
        </div>
      </div>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="space-y-6">
          <RevenueTrendCard
            days={metrics.salesByDay}
            totalRevenue={metrics.sales.totalEstimatedRevenue}
          />
          <GateSnapshot metrics={metrics} />
        </div>

        <section className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            Event tools
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Run this event
          </h2>
          <div className="mt-5 space-y-3">
            {needsStripeConnection ? (
              <StripeToolForm
                configured={connectConfigured}
                organizationId={tournament.organization_id}
                tournamentId={tournamentId}
              />
            ) : null}
            <ToolLink
              href={publicPath}
              title="View public ticket page"
              description="Open the buyer-facing admission page."
            />
            <ToolLink
              href={`/dashboard/tournaments/${tournamentId}/gate`}
              title="Create scanner link"
              description="Create secure links for gate staff."
            />
            <ToolLink
              href={`/dashboard/tournaments/${tournamentId}/share`}
              title="Share with coaches"
              description="Copy a parent-ready message for teams."
            />
            <ToolLink
              href={`/dashboard/tournaments/${tournamentId}/tickets`}
              title="Edit tickets"
              description="Change pass names, prices, dates, and status."
            />
            <ToolLink
              href={`/dashboard/tournaments/${tournamentId}/edit`}
              title="Edit event details"
              description="Update dates, venue, description, and contact info."
            />
          </div>
        </section>
      </section>
    </div>
  );
}

function GateSnapshot({
  metrics,
}: {
  metrics: TournamentDashboardMetrics;
}) {
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
    <section className="rounded-[2rem] border border-blue-100 bg-card p-6 shadow-sm">
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

function StripeToolForm({
  configured,
  organizationId,
  tournamentId,
}: {
  configured: boolean;
  organizationId: number;
  tournamentId: number;
}) {
  return (
    <form action="/api/stripe/connect/start" method="post">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="event" value={tournamentId} />
      <button
        type="submit"
        disabled={!configured}
        className="block w-full rounded-3xl border border-border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/70 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block font-semibold text-slate-950">
              Connect Stripe
            </span>
            <span className="mt-1 block text-sm leading-6 text-slate-500">
              Complete Stripe setup to accept paid orders.
            </span>
          </span>
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-card-strong text-slate-500"
          >
            →
          </span>
        </span>
      </button>
    </form>
  );
}

function ToolLink({
  description,
  href,
  title,
}: {
  description: string;
  href: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-3xl border border-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/70 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-card-strong text-slate-500"
        >
          →
        </span>
      </div>
    </Link>
  );
}
