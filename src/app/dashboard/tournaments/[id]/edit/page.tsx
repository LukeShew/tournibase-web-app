import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventDetailsEditForm } from "@/components/event-details-edit-form";
import { EventPublicationControl } from "@/components/event-publication-control";
import { requireDirector } from "@/lib/auth";
import { getIdlePublicationMessage } from "@/lib/publication-message";
import { getStripeConfigurationIssues } from "@/lib/stripe";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Edit event",
};

type EditableTournament = {
  contact_email: string;
  description: string | null;
  end_date: string;
  id: number;
  name: string;
  organizer_name: string;
  public_slug: string;
  start_date: string;
  status: "draft" | "published" | "closed" | "archived";
  venue_address: string | null;
  venue_name: string;
};

export default async function EditTournamentPage({
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
      "id, name, start_date, end_date, venue_name, venue_address, organizer_name, contact_email, description, status, public_slug",
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

  const tournament = tournamentRow as EditableTournament;
  const { count: activeTicketCount, error: activeTicketError } = await supabase
    .from("ticket_types")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("status", "active");

  if (activeTicketError) {
    throw activeTicketError;
  }

  const checkoutConfigured =
    getStripeConfigurationIssues({
      includePublishableKey: true,
      includeWebhookSecret: true,
    }).length === 0 && getSupabaseAdminConfigurationIssues().length === 0;
  const publicationMessage = getIdlePublicationMessage({
    activeTicketCount: activeTicketCount ?? 0,
    checkoutConfigured,
    status: tournament.status,
  });

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
          <p className="text-sm font-semibold text-blue-700">Event settings</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
            Edit event details
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-400">
            Correct the event name, dates, venue, description, and contact
            details buyers see on the public admission page.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-sm">
          <p className="text-sm font-semibold text-slate-950">
            {tournament.name}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {formatEventDateRange(
              tournament.start_date,
              tournament.end_date,
            )}
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              Public ticket page
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Publish controls
            </h2>
            <p
              className={`mt-2 max-w-2xl text-sm leading-6 ${publicationMessage.className}`}
            >
              {publicationMessage.text}
            </p>
          </div>
          <div className="w-full max-w-md">
            <EventPublicationControl
              activeTicketCount={activeTicketCount ?? 0}
              align="end"
              checkoutConfigured={checkoutConfigured}
              publicPath={`/e/${tournament.public_slug}`}
              showIdleMessage={false}
              status={tournament.status}
              tournamentId={tournamentId}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              Ticket details
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Edit admission options
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Change ticket names, prices, quantities, valid dates, and active
              status from the ticket editor.
            </p>
          </div>
          <Link
            href={`/dashboard/tournaments/${tournamentId}/tickets`}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
          >
            Edit ticket details
          </Link>
        </div>
      </section>

      <EventDetailsEditForm tournament={tournament} />
    </div>
  );
}
