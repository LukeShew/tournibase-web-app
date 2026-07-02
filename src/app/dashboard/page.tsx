import type { Metadata } from "next";
import Link from "next/link";
import { requireDirector } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Dashboard",
};

type Organization = {
  id: number;
  name: string;
};

type Tournament = {
  id: number;
  name: string;
  status: "draft" | "published" | "closed" | "archived";
  start_date: string;
  end_date: string;
};

export default async function DashboardPage() {
  const director = await requireDirector();
  const supabase = await createClient();

  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("owner_user_id", director.id)
    .order("created_at", { ascending: true });

  const organizations = (organizationRows ?? []) as Organization[];
  const organizationIds = organizations.map((organization) => organization.id);

  let tournaments: Tournament[] = [];

  if (organizationIds.length > 0) {
    const { data: tournamentRows, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, name, status, start_date, end_date")
      .in("organization_id", organizationIds)
      .order("start_date", { ascending: false })
      .limit(8);

    if (tournamentError) {
      throw tournamentError;
    }

    tournaments = (tournamentRows ?? []) as Tournament[];
  }

  if (organizationError) {
    throw organizationError;
  }

  const publishedCount = tournaments.filter(
    (tournament) => tournament.status === "published",
  ).length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-300">Director dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
            Admission overview
          </h1>
          <p className="mt-2 text-slate-400">
            Your tournament sales and gate activity will live here.
          </p>
        </div>
        <Link
          href="/dashboard/tournaments/new"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          New admission event
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <DashboardStat label="Organizations" value={organizations.length} />
        <DashboardStat label="Tournaments" value={tournaments.length} />
        <DashboardStat label="Published" value={publishedCount} />
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-white">Recent tournaments</h2>
          <p className="mt-1 text-sm text-slate-500">
            Open an event to review setup and continue building admission.
          </p>
        </div>

        {tournaments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-xl text-blue-300">
              +
            </div>
            <h3 className="mt-4 font-semibold text-white">
              No tournaments yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Create your first event, add the tournament details, and reserve
              its public ticket link.
            </p>
            <Link
              href="/dashboard/tournaments/new"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Create admission event
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/dashboard/tournaments/${tournament.id}`}
                className="flex flex-col justify-between gap-3 px-5 py-4 transition hover:bg-white/[0.025] sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium text-slate-100">{tournament.name}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {formatEventDateRange(
                      tournament.start_date,
                      tournament.end_date,
                    )}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-border bg-white/5 px-2.5 py-1 text-xs font-medium capitalize text-slate-300">
                  {tournament.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
