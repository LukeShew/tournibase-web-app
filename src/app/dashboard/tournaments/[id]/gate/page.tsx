import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CopyLinkButton } from "@/components/copy-link-button";
import { CreateScannerSessionForm } from "@/components/create-scanner-session-form";
import { RevokeScannerSessionButton } from "@/components/revoke-scanner-session-button";
import { requireDirector } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Gate access",
};

type Tournament = {
  end_date: string;
  id: number;
  name: string;
  public_slug: string;
  start_date: string;
  status: "draft" | "published" | "closed" | "archived";
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
      "id, name, start_date, end_date, venue_name, status, public_slug",
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
  const publicPath = `/e/${tournament.public_slug}`;
  const publicUrl = `${getSiteUrl()}${publicPath}`;
  const ticketQrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
    color: {
      dark: "#07101D",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
    margin: 2,
    width: 320,
  });

  return (
    <div className="pb-12">
      <Link
        href={`/dashboard/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span>
        Back to event
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-blue-300">Gate access</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
            Gate setup
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-400">
            Set up the public checkout QR for spectators and secure scanner
            links for gate staff.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-right">
          <p className="text-sm font-semibold text-white">{tournament.name}</p>
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

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid items-center gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
              Spectator checkout
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Public admission QR poster
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              This is not a scanner link. Put this QR code near the entrance so
              spectators can buy admission on their phones before reaching gate
              staff.
            </p>
            <p className="mt-3 break-all font-mono text-xs text-blue-300">
              {publicUrl}
            </p>
            {tournament.status !== "published" ? (
              <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100">
                Publish the ticket page before displaying this QR code.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <CopyLinkButton label="Copy checkout link" path={publicPath} />
              <Link
                href={`/print/tournaments/${tournamentId}/gate-poster`}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
              >
                Open printable poster
              </Link>
            </div>
          </div>
          <div className="mx-auto w-48 rounded-2xl bg-white p-3 lg:mx-0">
            <Image
              src={ticketQrCodeDataUrl}
              alt={`QR code to buy admission for ${tournament.name}`}
              width={320}
              height={320}
              className="h-auto w-full"
              unoptimized
            />
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {canCreate ? (
          <CreateScannerSessionForm
            tournamentId={tournamentId}
            tournamentName={tournament.name}
          />
        ) : (
          <section className="rounded-2xl border border-amber-300/20 bg-card p-6">
            <p className="text-sm font-medium text-amber-200">
              Event {tournament.status}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              New scanner links are disabled
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Scanner access cannot be created for a closed or archived event.
            </p>
          </section>
        )}

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
              Event assignment
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {tournament.name}
            </h2>
            <dl className="mt-4 divide-y divide-border border-y border-border">
              <SummaryItem label="Venue" value={tournament.venue_name} />
              <SummaryItem
                label="Dates"
                value={formatEventDateRange(
                  tournament.start_date,
                  tournament.end_date,
                )}
              />
              <SummaryItem
                label="Event status"
                value={capitalize(tournament.status)}
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold text-white">Link security</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-500">
              <li>Each link uses a cryptographically random token.</li>
              <li>Only a SHA-256 hash is stored in the database.</li>
              <li>Links stop working when expired or revoked.</li>
              <li>Share each link only with its assigned gate staff.</li>
            </ul>
          </section>
        </aside>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-white">Scanner access history</h2>
          <p className="mt-1 text-sm text-slate-500">
            Raw scanner links are hidden after creation and cannot be
            recovered.
          </p>
        </div>

        {scannerSessions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-lg text-blue-300">
              ↗
            </div>
            <h3 className="mt-4 font-semibold text-white">
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
                      <h3 className="font-semibold text-white">
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
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const styles = {
    active: "bg-emerald-300/10 text-emerald-300",
    expired: "bg-white/5 text-slate-400",
    revoked: "bg-red-300/10 text-red-300",
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

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
