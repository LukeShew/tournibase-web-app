import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintPosterButton } from "@/components/print-poster-button";
import { requireDirector } from "@/lib/auth";
import { PARENT_PROMISE } from "@/lib/product-copy";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "@/lib/tournaments";

export const metadata: Metadata = {
  title: "Gate ticket poster",
  robots: {
    follow: false,
    index: false,
  },
};

type PosterTournament = {
  end_date: string;
  id: number;
  name: string;
  public_slug: string;
  start_date: string;
  venue_name: string;
};

export default async function GatePosterPage({
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
      "id, name, start_date, end_date, venue_name, public_slug",
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

  const tournament = tournamentRow as PosterTournament;
  const publicUrl = `${getSiteUrl()}/e/${tournament.public_slug}`;
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
    color: {
      dark: "#07101D",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
    margin: 2,
    width: 640,
  });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[8.5in] items-center justify-between gap-4 print:hidden">
        <Link
          href={`/dashboard/tournaments/${tournamentId}/gate`}
          className="text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          ← Back to gate access
        </Link>
        <PrintPosterButton />
      </div>

      <article className="mx-auto flex min-h-[11in] w-full max-w-[8.5in] flex-col items-center justify-center overflow-hidden rounded-3xl bg-white px-10 py-12 text-center shadow-xl print:min-h-[10.5in] print:rounded-none print:shadow-none">
        <p className="text-lg font-black uppercase tracking-[0.22em] text-blue-600">
          TourniBase Admission
        </p>
        <h1 className="mt-6 max-w-2xl text-5xl font-black tracking-[-0.05em] text-slate-950">
          Buy admission here
        </h1>
        <p className="mt-4 max-w-xl text-xl font-semibold leading-8 text-slate-700">
          {PARENT_PROMISE}
        </p>
        <p className="mt-3 max-w-xl text-lg leading-7 text-slate-600">
          Scan the code below to purchase admission on your phone.
        </p>

        <div className="mt-8 w-full max-w-[4.75in] rounded-[2rem] border-4 border-slate-950 bg-white p-5">
          <Image
            src={qrCodeDataUrl}
            alt={`QR code to buy admission for ${tournament.name}`}
            width={640}
            height={640}
            className="h-auto w-full"
            priority
            unoptimized
          />
        </div>

        <h2 className="mt-8 text-3xl font-black tracking-[-0.035em] text-slate-950">
          {tournament.name}
        </h2>
        <p className="mt-3 text-lg font-semibold text-slate-700">
          {formatEventDateRange(
            tournament.start_date,
            tournament.end_date,
          )}
          {" · "}
          {tournament.venue_name}
        </p>
        <p className="mt-5 max-w-2xl break-all font-mono text-sm text-blue-700">
          {publicUrl}
        </p>
      </article>
    </main>
  );
}
