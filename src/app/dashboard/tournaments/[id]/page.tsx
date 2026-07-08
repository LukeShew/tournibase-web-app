import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DashboardMetricCard } from "@/components/dashboard-metric-card";
import { EventPublicationControl } from "@/components/event-publication-control";
import { requireDirector } from "@/lib/auth";
import {
  formatCurrency,
  getTournamentDashboardMetrics,
} from "@/lib/dashboard-metrics";
import { getStripeConfigurationIssues } from "@/lib/stripe";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Event overview",
};

type Tournament = {
  id: number;
  name: string;
  sport: string;
  start_date: string;
  end_date: string;
  venue_name: string;
  venue_address: string | null;
  organizer_name: string;
  contact_email: string;
  description: string | null;
  status: "draft" | "published" | "closed" | "archived";
  public_slug: string;
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
      "id, name, sport, start_date, end_date, venue_name, venue_address, organizer_name, contact_email, description, status, public_slug",
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
  const [
    { count: ticketTypeCount, error: ticketTypeError },
    { count: activeTicketCount, error: activeTicketError },
    metrics,
  ] = await Promise.all([
    supabase
      .from("ticket_types")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId),
    supabase
      .from("ticket_types")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .eq("status", "active"),
    getTournamentDashboardMetrics(tournamentId),
  ]);

  if (ticketTypeError) {
    throw ticketTypeError;
  }

  if (activeTicketError) {
    throw activeTicketError;
  }

  if (!metrics) {
    notFound();
  }

  const publicPath = `/e/${tournament.public_slug}`;
  const checkoutConfigured =
    getStripeConfigurationIssues({
      includePublishableKey: true,
      includeWebhookSecret: true,
    }).length === 0 && getSupabaseAdminConfigurationIssues().length === 0;
  const salesOpen =
    tournament.status === "published" &&
    (activeTicketCount ?? 0) > 0 &&
    checkoutConfigured;

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
          <p className="mt-3 font-mono text-sm text-slate-400">
            {formatEventDateRange(
              tournament.start_date,
              tournament.end_date,
            )}
          </p>
        </div>
        <CopyLinkButton path={publicPath} />
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          label="Ticket page"
          value={
            tournament.status === "published"
              ? "Live"
              : tournament.status === "draft"
                ? "Draft"
                : "Closed"
          }
          detail={
            tournament.status === "published"
              ? "Public page is visible to buyers."
              : tournament.status === "draft"
                ? "Not visible to buyers yet."
                : "Public ticket sales are closed."
          }
        />
        <StatusCard
          label="Sales setup"
          value={ticketTypeCount ? "Tickets added" : "Not configured"}
          detail={`${activeTicketCount ?? 0} active of ${ticketTypeCount ?? 0} total`}
        />
        <StatusCard
          label="Sales status"
          value={
            salesOpen
              ? "Open"
              : tournament.status === "closed" ||
                  tournament.status === "archived"
                ? "Closed"
                : tournament.status === "published"
                  ? "Setup needed"
                  : "Not live"
          }
          detail={
            salesOpen
              ? "Buyers can complete online checkout."
              : "Online checkout is not currently available."
          }
        />
        <StatusCard
          label="Scanner links"
          value={`${metrics.scannerLinks.active} active`}
          detail={`${metrics.scannerLinks.total} created for this event`}
        />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border bg-card-strong px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Event details</h2>
              <p className="mt-1 text-sm text-slate-500">
                The information connected to this admission event.
              </p>
            </div>
            <Link
              href={`/dashboard/tournaments/${tournamentId}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
            >
              Edit event
            </Link>
          </div>
          <dl className="grid gap-px bg-border sm:grid-cols-2">
            <DetailItem
              label="Dates"
              value={formatEventDateRange(
                tournament.start_date,
                tournament.end_date,
              )}
            />
            <DetailItem label="Venue" value={tournament.venue_name} />
            <DetailItem
              label="Address"
              value={tournament.venue_address || "Not provided"}
            />
            <DetailItem label="Organizer" value={tournament.organizer_name} />
            <DetailItem
              label="Contact"
              value={tournament.contact_email}
            />
            <DetailItem label="Sport" value="Youth basketball" />
          </dl>
          {tournament.description ? (
            <div className="border-t border-border px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Description
              </p>
              <p className="mt-2 max-w-3xl leading-7 text-slate-300">
                {tournament.description}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Public ticket link
          </p>
          <p className="mt-3 break-all font-mono text-sm text-blue-300">
            {publicPath}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Share this link only after the page is published. Buyers can view
            event details and choose admission passes.
          </p>
          <div className="mt-5">
            <CopyLinkButton path={publicPath} />
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <EventPublicationControl
              activeTicketCount={activeTicketCount ?? 0}
              checkoutConfigured={checkoutConfigured}
              publicPath={publicPath}
              status={tournament.status}
              tournamentId={tournamentId}
            />
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            Live event snapshot
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Sales and admissions now
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Current totals from paid orders, gate activity, and recorded manual
            sales.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DashboardMetricCard
            detail="Paid online admission passes"
            label="Online tickets sold"
            value={metrics.sales.onlineTicketsSold}
          />
          <DashboardMetricCard
            detail="Online passes admitted at the gate"
            label="Checked in"
            value={metrics.gate.checkedInPasses}
          />
          <DashboardMetricCard
            detail="Paid online passes still unused"
            label="Unscanned passes"
            value={metrics.gate.unscannedPasses}
          />
          <DashboardMetricCard
            detail={`${metrics.sales.manualSaleCount} recorded gate sales`}
            label="Manual gate admissions"
            value={metrics.sales.manualAdmissions}
          />
          <DashboardMetricCard
            detail="Passes presented more than once"
            label="Duplicate attempts"
            value={metrics.gate.duplicateAttempts}
          />
          <DashboardMetricCard
            detail="Online and recorded gate revenue"
            label="Estimated revenue"
            value={formatCurrency(metrics.sales.totalEstimatedRevenue)}
          />
        </div>
      </section>

      <section className="mt-8">
        <div>
          <h2 className="font-semibold text-slate-950">Event tools</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sell passes, share the ticket link, and run the gate from here.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActiveTool
            href={`/dashboard/tournaments/${tournamentId}/edit`}
            title="Edit event details"
            description="Fix event dates, venue, description, and contact info."
          />
          <ActiveTool
            href={`/dashboard/tournaments/${tournamentId}/tickets`}
            title="Edit tickets"
            description="Create pricing and admission options."
          />
          {tournament.status === "published" ? (
            <ActiveTool
              href={publicPath}
              title="View public page"
              description="Open the buyer-facing event and ticket page."
            />
          ) : (
            <FutureTool
              title="View public page"
              description="Publish the ticket page before opening it publicly."
              phase="Publish first"
            />
          )}
          <ActiveTool
            href={`/dashboard/tournaments/${tournamentId}/gate`}
            title="Create scanner link"
            description="Authorize gate staff and specific entrances."
            highlight
          />
          <ActiveTool
            href={`/dashboard/tournaments/${tournamentId}/share`}
            title="Share with coaches"
            description="Give coaches a parent-ready message and ticket link."
          />
          <ActiveTool
            href={`/dashboard/tournaments/${tournamentId}/scans`}
            title="Open gate dashboard"
            description="Track live admissions and scanner activity."
          />
          <ActiveTool
            href={`/dashboard/tournaments/${tournamentId}/sales`}
            title="Open sales dashboard"
            description="Review online and manual admission sales."
          />
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-6 py-4">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium leading-6 text-slate-800">
        {value}
      </dd>
    </div>
  );
}

function ActiveTool({
  description,
  highlight = false,
  href,
  title,
}: {
  description: string;
  highlight?: boolean;
  href: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-[1.75rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        highlight
          ? "border-blue-200 bg-blue-600 text-white hover:bg-blue-500"
          : "border-border bg-card hover:border-blue-200 hover:bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`font-semibold ${
            highlight ? "text-blue-50" : "text-slate-950"
          }`}
        >
          {title}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            highlight
              ? "bg-white/20 text-blue-50"
              : "bg-brand-soft text-blue-700"
          }`}
        >
          Open
        </span>
      </div>
      <p
        className={`mt-2 text-sm leading-6 ${
          highlight ? "text-blue-50" : "text-slate-500"
        }`}
      >
        {description}
      </p>
    </Link>
  );
}

function FutureTool({
  description,
  phase,
  title,
}: {
  description: string;
  phase: string;
  title: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card-strong p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-slate-500">{title}</p>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {phase}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
