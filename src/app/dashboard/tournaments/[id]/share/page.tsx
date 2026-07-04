import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CopyTextButton } from "@/components/copy-text-button";
import { requireDirector } from "@/lib/auth";
import {
  buildParentMessage,
  getCoachSharePath,
  getPublicTicketPath,
} from "@/lib/coach-sharing";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Share with coaches",
};

type ShareTournament = {
  end_date: string;
  id: number;
  name: string;
  public_slug: string;
  start_date: string;
  status: "archived" | "closed" | "draft" | "published";
  venue_name: string;
};

export default async function TournamentSharePage({
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
      "id, name, start_date, end_date, venue_name, public_slug, status",
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

  const tournament = tournamentRow as ShareTournament;
  const siteUrl = getSiteUrl();
  const coachSharePath = getCoachSharePath(tournament.public_slug);
  const coachShareUrl = `${siteUrl}${coachSharePath}`;
  const publicTicketUrl = `${siteUrl}${getPublicTicketPath(
    tournament.public_slug,
  )}`;
  const parentMessage = buildParentMessage(publicTicketUrl);
  const qrCodeDataUrl = await QRCode.toDataURL(coachShareUrl, {
    color: {
      dark: "#07101D",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
    margin: 2,
    width: 480,
  });
  const isPublished = tournament.status === "published";

  return (
    <div className="pb-12">
      <Link
        href={`/dashboard/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
      >
        <span aria-hidden="true">←</span>
        Back to event
      </Link>

      <div className="mt-6">
        <p className="text-sm font-medium text-blue-300">
          Coach sharing flow
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
          Share admission with coaches
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Send one simple page to coaches. They can copy the parent message,
          text it, email it, or share the ticket QR code.
        </p>
      </div>

      {!isPublished ? (
        <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm leading-6 text-amber-100">
          Publish the ticket page before sending this coach link. The public
          coach page stays unavailable while the event is {tournament.status}.
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-white">Coach share link</h2>
            <p className="mt-1 text-sm text-slate-500">
              Coaches do not need a TourniBase account to open this page.
            </p>
          </div>
          <div className="p-5">
            <div className="rounded-xl border border-border bg-slate-950/40 p-4">
              <p className="break-all font-mono text-sm leading-6 text-blue-300">
                {coachShareUrl}
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <CopyTextButton label="Copy coach link" text={coachShareUrl} />
              {isPublished ? (
                <Link
                  href={coachSharePath}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white/5 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                  Preview coach page
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-blue-300">
            Coach access QR
          </p>
          <div className="mt-4 rounded-2xl bg-white p-4">
            <Image
              src={qrCodeDataUrl}
              alt={`QR code for the ${tournament.name} coach share page`}
              width={480}
              height={480}
              className="h-auto w-full"
              unoptimized
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            This code opens the coach page. The ticket QR is available inside
            that page.
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-white">Parent message preview</h2>
          <p className="mt-1 text-sm text-slate-500">
            The coach can copy this exact message from the public share page.
          </p>
        </div>
        <div className="p-5">
          <div className="whitespace-pre-wrap rounded-xl border border-border bg-slate-950/40 p-5 text-sm leading-7 text-slate-200">
            {parentMessage}
          </div>
          <div className="mt-4">
            <CopyTextButton
              label="Copy parent message"
              text={parentMessage}
              tone="secondary"
            />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
          Event
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {tournament.name}
        </h2>
        <p className="mt-2 font-mono text-sm text-slate-400">
          {formatEventDateRange(
            tournament.start_date,
            tournament.end_date,
          )}
        </p>
        <p className="mt-2 text-sm text-slate-500">{tournament.venue_name}</p>
      </section>
    </div>
  );
}
