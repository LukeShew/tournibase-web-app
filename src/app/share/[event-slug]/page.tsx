import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Brand } from "@/components/brand";
import { CopyTextButton } from "@/components/copy-text-button";
import { ShareByTextButton } from "@/components/share-by-text-button";
import {
  buildParentMessage,
  getPublicTicketPath,
} from "@/lib/coach-sharing";
import { PARENT_PROMISE } from "@/lib/product-copy";
import { getPublicEvent } from "@/lib/public-events";
import { getSiteUrl } from "@/lib/site-url";
import { formatEventDateRange } from "@/lib/tournaments";

type CoachSharePageProps = {
  params: Promise<{ "event-slug": string }>;
};

export async function generateMetadata({
  params,
}: CoachSharePageProps): Promise<Metadata> {
  const { "event-slug": eventSlug } = await params;
  const event = await getPublicEvent(eventSlug);

  if (!event) {
    return {
      title: "Coach share page unavailable",
    };
  }

  return {
    title: `Share ${event.name} admission`,
    description: `Share the ${event.name} TourniBase admission link with parents and spectators.`,
    robots: {
      follow: false,
      index: false,
    },
  };
}

export default async function CoachSharePage({
  params,
}: CoachSharePageProps) {
  const { "event-slug": eventSlug } = await params;
  const event = await getPublicEvent(eventSlug);

  if (!event) {
    notFound();
  }

  const ticketPath = getPublicTicketPath(event.public_slug);
  const ticketUrl = `${getSiteUrl()}${ticketPath}`;
  const parentMessage = buildParentMessage(ticketUrl);
  const qrCodeDataUrl = await QRCode.toDataURL(ticketUrl, {
    color: {
      dark: "#07101D",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
    margin: 2,
    width: 560,
  });
  const emailShareUrl = `mailto:?subject=${encodeURIComponent(
    `${event.name} admission`,
  )}&body=${encodeURIComponent(parentMessage)}`;

  return (
    <main className="min-h-screen bg-background text-white">
      <header className="border-b border-border bg-background/90">
        <div className="mx-auto flex h-18 w-full max-w-5xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <span className="rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400">
            Coach share page
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
        <section className="rounded-3xl border border-brand/20 bg-gradient-to-br from-blue-500/10 via-card to-card p-6 sm:p-8">
          <p className="text-sm font-medium text-blue-300">
            Share admission with your team
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            {event.name}
          </h1>
          <p className="mt-4 font-mono text-sm text-slate-400">
            {formatEventDateRange(event.start_date, event.end_date)}
          </p>
          <p className="mt-2 text-sm text-slate-400">{event.venue_name}</p>
          <p className="mt-5 text-lg font-semibold text-slate-200">
            {PARENT_PROMISE}
          </p>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold text-white">Message for parents</h2>
              <p className="mt-1 text-sm text-slate-500">
                Copy this into your team group chat.
              </p>
            </div>
            <div className="p-5">
              <div className="whitespace-pre-wrap rounded-xl border border-border bg-slate-950/40 p-5 text-sm leading-7 text-slate-200">
                {parentMessage}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CopyTextButton
                  label="Copy message"
                  text={parentMessage}
                />
                <ShareByTextButton
                  message={parentMessage}
                  title={`${event.name} admission`}
                />
                <a
                  href={emailShareUrl}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-white/5 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                  Share by email
                </a>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-blue-300">
              Parent ticket QR
            </p>
            <div className="mt-4 rounded-2xl bg-white p-4">
              <Image
                src={qrCodeDataUrl}
                alt={`QR code to buy admission for ${event.name}`}
                width={560}
                height={560}
                className="h-auto w-full"
                priority
                unoptimized
              />
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Parents can scan this code to open the ticket page.
            </p>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Public ticket link
          </p>
          <Link
            href={ticketPath}
            className="mt-3 block break-all font-mono text-sm leading-6 text-blue-300 underline decoration-blue-400/40 underline-offset-4 hover:text-blue-200"
          >
            {ticketUrl}
          </Link>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href={ticketPath}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Open ticket page
            </Link>
            <CopyTextButton
              label="Copy ticket link"
              text={ticketUrl}
              tone="secondary"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
