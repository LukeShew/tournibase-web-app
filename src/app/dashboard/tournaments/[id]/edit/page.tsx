import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventDetailsEditForm } from "@/components/event-details-edit-form";
import { requireDirector } from "@/lib/auth";
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

      <EventDetailsEditForm tournament={tournament} />
    </div>
  );
}
