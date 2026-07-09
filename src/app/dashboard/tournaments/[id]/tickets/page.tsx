import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateTicketTypeForm } from "@/components/create-ticket-type-form";
import {
  TicketTypeCard,
  type TicketTypeRecord,
} from "@/components/ticket-type-card";
import { requireDirector } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Ticket types",
};

type Tournament = {
  end_date: string;
  id: number;
  name: string;
  start_date: string;
  status: "draft" | "published" | "closed" | "archived";
  time_zone: string;
};

export default async function TicketTypesPage({
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
    .select("id, name, start_date, end_date, status, time_zone")
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
  const { data: ticketRows, error: ticketsError } = await supabase
    .from("ticket_types")
    .select(
      "id, name, price, valid_from, valid_until, description, quantity_limit, status, created_at",
    )
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });

  if (ticketsError) {
    throw ticketsError;
  }

  const ticketTypes = (ticketRows ?? []) as TicketTypeRecord[];
  const activeCount = ticketTypes.filter(
    (ticketType) => ticketType.status === "active",
  ).length;

  return (
    <div className="pb-12">
      <Link
        href={`/dashboard/tournaments/${tournamentId}/edit`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <span aria-hidden="true">←</span>
        Back to event details
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            {tournament.name}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
            Ticket types
          </h1>
          <p className="mt-3 text-slate-400">
            Create the admission options parents can purchase.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
            Event dates
          </p>
          <p className="mt-1 font-mono text-sm text-slate-300">
            {formatEventDateRange(
              tournament.start_date,
              tournament.end_date,
            )}
          </p>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Ticket types" value={ticketTypes.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard
          label="Inactive"
          value={
            ticketTypes.filter(
              (ticketType) => ticketType.status === "inactive",
            ).length
          }
        />
      </section>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <CreateTicketTypeForm
          tournamentId={tournamentId}
          eventStartDate={tournament.start_date}
          eventEndDate={tournament.end_date}
        />

        <section>
          <div>
            <h2 className="font-semibold text-slate-950">Admission options</h2>
            <p className="mt-1 text-sm text-slate-500">
              Edit pricing and validity, or temporarily deactivate a ticket.
            </p>
          </div>

          {ticketTypes.length === 0 ? (
            <div className="mt-4 rounded-[2rem] border border-dashed border-border bg-card px-6 py-14 text-center shadow-sm">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-xl text-blue-300">
                +
              </div>
              <h3 className="mt-4 font-semibold text-slate-950">
                No ticket types yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Start with a Saturday Pass, Sunday Pass, Weekend Pass, child
                pass, or comp pass.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {ticketTypes.map((ticketType) => (
                <TicketTypeCard
                  key={ticketType.id}
                  eventTimeZone={tournament.time_zone}
                  ticketType={ticketType}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-blue-700">
        {value}
      </p>
    </div>
  );
}
