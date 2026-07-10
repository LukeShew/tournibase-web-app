import type { Metadata } from "next";
import Link from "next/link";
import { requireDirector } from "@/lib/auth";
import { DIRECTOR_PROMISE } from "@/lib/product-copy";
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const query = ((await searchParams)?.q ?? "").trim();
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
      .limit(100);

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
  const normalizedQuery = query.toLocaleLowerCase();
  const matchingTournaments = normalizedQuery
    ? tournaments.filter((tournament) =>
        tournament.name.toLocaleLowerCase().includes(normalizedQuery),
      )
    : tournaments;
  const now = new Date();
  const upcomingTournaments = matchingTournaments
    .filter((tournament) => new Date(tournament.end_date) >= now)
    .sort(
      (first, second) =>
        new Date(first.start_date).getTime() -
        new Date(second.start_date).getTime(),
    );
  const previousTournaments = matchingTournaments
    .filter((tournament) => new Date(tournament.end_date) < now)
    .sort(
      (first, second) =>
        new Date(second.end_date).getTime() - new Date(first.end_date).getTime(),
    );
  const featuredTournament =
    upcomingTournaments[0] ?? matchingTournaments[0] ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            Director dashboard
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
            Admission control
          </h1>
          <p className="mt-3 max-w-2xl text-slate-500">
            {DIRECTOR_PROMISE}
          </p>
        </div>
        <Link
          href="/dashboard/tournaments/new"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          New admission event
        </Link>
      </div>

      <form
        action="/dashboard"
        className="flex flex-col gap-3 rounded-[2rem] border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
        role="search"
      >
        <label className="sr-only" htmlFor="tournament-search">
          Search tournaments
        </label>
        <div className="relative flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          >
            ⌕
          </span>
          <input
            id="tournament-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search tournaments"
            className="h-12 w-full rounded-2xl border border-border bg-card-strong pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-brand-strong px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          Search
        </button>
        {query ? (
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-card-strong hover:text-slate-950"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <section>
        <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-card-strong px-6 py-5">
            <p className="text-sm font-semibold text-slate-500">
              Most relevant event
            </p>
          </div>
          {featuredTournament ? (
            <Link
              href={`/dashboard/tournaments/${featuredTournament.id}`}
              className="block p-6 transition hover:bg-blue-50/60"
            >
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                    {featuredTournament.status}
                  </span>
                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
                    {featuredTournament.name}
                  </h2>
                  <p className="mt-3 font-mono text-sm text-slate-500">
                    {formatEventDateRange(
                      featuredTournament.start_date,
                      featuredTournament.end_date,
                    )}
                  </p>
                </div>
                <span className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm">
                  Open event
                </span>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <DashboardStat label="Organizations" value={organizations.length} />
                <DashboardStat label="Events" value={tournaments.length} />
                <DashboardStat label="Published" value={publishedCount} />
              </div>
            </Link>
          ) : (
            <div className="p-8 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-brand-soft text-2xl text-blue-700">
                +
              </div>
              <h2 className="mt-4 text-xl font-semibold text-slate-950">
                {query ? "No matching tournaments" : "No admission events yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {query
                  ? `No tournaments match “${query}”. Try another name or clear the search.`
                  : "Create your first event, add the tournament details, and reserve its public ticket link."}
              </p>
              {query ? (
                <Link
                  href="/dashboard"
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-card-strong"
                >
                  Clear search
                </Link>
              ) : (
                <Link
                  href="/dashboard/tournaments/new"
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
                >
                  Create admission event
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="space-y-4">
        <TournamentDropdown
          emptyText="No active or upcoming tournaments."
          title="Active / upcoming tournaments"
          tournaments={upcomingTournaments}
        />
        <TournamentDropdown
          emptyText="No previous tournaments yet."
          title="Previous tournaments"
          tournaments={previousTournaments}
        />
      </div>
    </div>
  );
}

function DashboardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-card-strong p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-blue-700">
        {value}
      </p>
    </div>
  );
}

function TournamentDropdown({
  emptyText,
  title,
  tournaments,
}: {
  emptyText: string;
  title: string;
  tournaments: Tournament[];
}) {
  return (
    <details className="group overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 transition hover:bg-blue-50/60 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {tournaments.length} {tournaments.length === 1 ? "event" : "events"}
          </p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-2xl border border-border bg-white text-lg text-slate-500 transition group-open:rotate-180">
          ⌄
        </span>
      </summary>

      {tournaments.length === 0 ? (
        <div className="border-t border-border px-6 py-8 text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/dashboard/tournaments/${tournament.id}`}
              className="flex flex-col justify-between gap-3 px-6 py-4 transition hover:bg-blue-50/60 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-semibold text-slate-950">
                  {tournament.name}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {formatEventDateRange(
                    tournament.start_date,
                    tournament.end_date,
                  )}
                </p>
              </div>
              <span className="w-fit rounded-full border border-border bg-card-strong px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                {tournament.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </details>
  );
}
