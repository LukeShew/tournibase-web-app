import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EventPublicationControl } from "@/components/event-publication-control";
import { requireDirector } from "@/lib/auth";
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
    { count: scannerCount, error: scannerError },
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
    supabase
      .from("scanner_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId),
  ]);

  if (ticketTypeError) {
    throw ticketTypeError;
  }

  if (activeTicketError) {
    throw activeTicketError;
  }

  if (scannerError) {
    throw scannerError;
  }

  const publicPath = `/e/${tournament.public_slug}`;
  const checkoutConfigured =
    getStripeConfigurationIssues({
      includePublishableKey: true,
      includeWebhookSecret: true,
    }).length === 0 && getSupabaseAdminConfigurationIssues().length === 0;

  return (
    <div className="pb-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span>
        Back to events
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-blue-300">
              Youth basketball admission
            </p>
            <span className="rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs font-medium capitalize text-slate-300">
              {tournament.status}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
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

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatusCard
          label="Ticket page"
          value={tournament.status === "published" ? "Live" : "Draft"}
          detail={
            tournament.status === "published"
              ? "Public page is visible to buyers."
              : "Not visible to buyers yet."
          }
        />
        <StatusCard
          label="Sales setup"
          value={ticketTypeCount ? "Tickets added" : "Not configured"}
          detail={`${activeTicketCount ?? 0} active of ${ticketTypeCount ?? 0} total`}
        />
        <StatusCard
          label="Scanner links"
          value={`${scannerCount ?? 0}`}
          detail="Secure gate links will be added in Phase 7."
        />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-white">Event details</h2>
            <p className="mt-1 text-sm text-slate-500">
              The information connected to this admission event.
            </p>
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
            <div className="border-t border-border px-5 py-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Description
              </p>
              <p className="mt-2 max-w-3xl leading-7 text-slate-300">
                {tournament.description}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
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
          <h2 className="font-semibold text-white">Event tools</h2>
          <p className="mt-1 text-sm text-slate-500">
            The event shell is ready. Each tool unlocks in its build phase.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <FutureTool
            title="Create scanner link"
            description="Authorize gate staff and specific entrances."
            phase="Phase 7"
          />
          <FutureTool
            title="Open gate dashboard"
            description="Track live admissions and scanner activity."
            phase="Phase 13"
          />
          <FutureTool
            title="Open sales dashboard"
            description="Review online and manual admission sales."
            phase="Phase 13"
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm leading-6 text-slate-200">{value}</dd>
    </div>
  );
}

function ActiveTool({
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
      className="rounded-2xl border border-brand/25 bg-brand-soft p-5 transition hover:border-brand/45 hover:bg-blue-500/20"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-blue-100">{title}</p>
        <span className="shrink-0 rounded-full bg-blue-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-blue-300">
          Ready
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-blue-200/70">{description}</p>
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-200">{title}</p>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {phase}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
