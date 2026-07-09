import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateScannerSessionForm } from "@/components/create-scanner-session-form";
import {
  LiveCheckInFeed,
  type LiveCheckIn,
} from "@/components/live-check-in-feed";
import { RevokeScannerSessionButton } from "@/components/revoke-scanner-session-button";
import { requireDirector } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Gate tools",
};

type Tournament = {
  end_date: string;
  id: number;
  name: string;
  public_slug: string;
  start_date: string;
  status: "draft" | "published" | "closed" | "archived";
  time_zone: string;
  venue_name: string;
};

type ScannerSession = {
  created_at: string;
  expires_at: string;
  gate_name: string;
  id: number;
  last_active_at: string | null;
  permissions: string[];
  revoked_at: string | null;
  staff_label: string;
};

type CheckInFeedRow = {
  created_at: string;
  gate_name: string;
  id: number;
  passes: {
    orders: {
      buyer_email: string | null;
      buyer_name: string | null;
    } | null;
    ticket_types: {
      name: string;
    } | null;
  } | null;
  result: "manual_check_in" | "override" | "valid";
  source: "camera" | "manual";
};

type SessionStatus = "active" | "expired" | "revoked";

export default async function GateAccessPage({
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
      "id, name, start_date, end_date, venue_name, status, public_slug, time_zone",
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
  const { data: scannerRows, error: scannerError } = await supabase
    .from("scanner_sessions")
    .select(
      "id, gate_name, permissions, expires_at, staff_label, created_at, last_active_at, revoked_at",
    )
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: false });

  if (scannerError) {
    throw scannerError;
  }

  const scannerSessions = (scannerRows ?? []) as ScannerSession[];
  const { data: checkInRows, error: checkInError } = await supabase
    .from("check_ins")
    .select(
      "id, created_at, result, gate_name, source, passes(ticket_types(name), orders(buyer_name, buyer_email))",
    )
    .eq("tournament_id", tournamentId)
    .is("undone_at", null)
    .in("result", ["valid", "manual_check_in", "override"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (checkInError) {
    throw checkInError;
  }

  const liveCheckIns = mapLiveCheckIns(
    (checkInRows ?? []) as unknown as CheckInFeedRow[],
  );
  const activeCount = scannerSessions.filter(
    (session) => getSessionStatus(session) === "active",
  ).length;
  const lastActiveAt = scannerSessions
    .map((session) => session.last_active_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const canCreate =
    tournament.status !== "closed" && tournament.status !== "archived";

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
          <p className="text-sm font-semibold text-blue-700">Gate access</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
            Gate tools
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-400">
            Review scanner access and create secure gate links when needed.
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

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatusCard label="Active links" value={activeCount.toString()} />
        <StatusCard
          label="Total created"
          value={scannerSessions.length.toString()}
        />
        <StatusCard
          label="Last scanner activity"
          value={lastActiveAt ? formatDateTime(lastActiveAt) : "None yet"}
        />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2 xl:items-start">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
          <details className="group/create">
            <summary className="flex cursor-pointer list-none flex-col justify-between gap-4 border-b border-border bg-card-strong px-6 py-5 transition hover:bg-blue-50/70 sm:flex-row sm:items-start [&::-webkit-details-marker]:hidden">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Scanner access history
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Scanner links are shown once after creation.
                </p>
              </div>
              <span className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition group-open/create:bg-blue-700 group-hover/create:bg-blue-500">
                + Create scanner link
              </span>
            </summary>
            <div className="border-b border-border p-4 sm:p-5">
              {canCreate ? (
                <CreateScannerSessionForm
                  tournamentId={tournamentId}
                  tournamentName={tournament.name}
                />
              ) : (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <p className="text-sm font-medium text-amber-700">
                    Event {tournament.status}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    New scanner links are disabled
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Scanner access cannot be created for a closed or archived
                    event.
                  </p>
                </section>
              )}
            </div>
          </details>

          {scannerSessions.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-lg text-blue-700">
                ↗
              </div>
              <h3 className="mt-4 font-semibold text-slate-950">
                No scanner links yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Create a secure link for each entrance, gate team, or shared
                scanning device.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {scannerSessions.map((session) => {
                const status = getSessionStatus(session);

                return (
                  <article
                    key={session.id}
                    className="flex flex-col justify-between gap-4 px-5 py-5 lg:flex-row lg:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">
                          {session.gate_name}
                        </h3>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {session.staff_label}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {formatPermissions(session.permissions)} · Expires{" "}
                        {formatDateTime(session.expires_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <p className="text-xs text-slate-600">
                        Created {formatDateTime(session.created_at)}
                      </p>
                      {status === "active" ? (
                        <RevokeScannerSessionButton
                          scannerSessionId={session.id}
                          tournamentId={tournamentId}
                        />
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <LiveCheckInFeed
          checkIns={liveCheckIns}
          timeZone={tournament.time_zone}
        />
      </div>
    </div>
  );
}

function mapLiveCheckIns(rows: CheckInFeedRow[]): LiveCheckIn[] {
  return rows.map((row) => ({
    buyerName:
      row.passes?.orders?.buyer_name ??
      row.passes?.orders?.buyer_email ??
      "Unknown guest",
    gateName: row.gate_name,
    id: row.id,
    result: row.result,
    scannedAt: row.created_at,
    source: row.source,
    ticketName: row.passes?.ticket_types?.name ?? "Admission pass",
  }));
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-blue-700">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const styles = {
    active: "bg-emerald-50 text-emerald-700",
    expired: "bg-slate-100 text-slate-500",
    revoked: "bg-red-50 text-red-700",
  } satisfies Record<SessionStatus, string>;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function getSessionStatus(session: ScannerSession): SessionStatus {
  if (session.revoked_at) {
    return "revoked";
  }

  return new Date(session.expires_at).getTime() <= Date.now()
    ? "expired"
    : "active";
}

function formatPermissions(permissions: string[]) {
  if (permissions.includes("manual_sale")) {
    return "Full gate access";
  }

  if (permissions.includes("lookup") || permissions.includes("recent")) {
    return "Standard gate";
  }

  return "Scan only";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}
