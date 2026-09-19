"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const chapters = [
  {
    eyebrow: "01 · Sell before arrival",
    title: "Give every family one clear place to buy admission.",
    body: "Create Saturday, Sunday, and weekend passes, then share the event’s public ticket page with teams and families.",
    points: ["Ticket quantities stay tied to the event", "Buyers continue to secure Stripe Checkout"],
  },
  {
    eyebrow: "02 · Deliver automatically",
    title: "Send a separate mobile pass for every admission.",
    body: "After payment, each attendee receives a unique pass that is easy to open, save, and present at the gate.",
    points: ["A unique QR code on every pass", "Email delivery with an offline backup"],
  },
  {
    eyebrow: "03 · Validate at the gate",
    title: "Let staff know exactly what to do next.",
    body: "A secure scanner checks the pass and records admission without giving gate staff access to the director dashboard.",
    points: ["Valid entries recorded immediately", "Duplicate and wrong-day use clearly blocked"],
  },
] as const;

export function LandingScrollStory({
  qrCodeDataUrl,
}: {
  qrCodeDataUrl: string;
}) {
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const centeredEntry = entries.find((entry) => entry.isIntersecting);

        if (centeredEntry) {
          setActiveChapter(
            Number(centeredEntry.target.getAttribute("data-chapter")),
          );
        }
      },
      { rootMargin: "-43% 0px -43% 0px", threshold: 0 },
    );

    const elements = chapterRefs.current;
    elements.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="bg-[#f7f8fb] py-24 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
            One connected flow
          </p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">
            From the first purchase to the final scan.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            These product views use the same components and visual system as
            TourniBase itself. The names and figures shown are demo data.
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[0.76fr_1.24fr] lg:gap-16">
          <div>
            {chapters.map((chapter, index) => (
              <article
                key={chapter.eyebrow}
                ref={(element) => {
                  chapterRefs.current[index] = element;
                }}
                data-chapter={index}
                className="border-t border-slate-200 py-12 first:border-t-0 first:pt-0 lg:flex lg:min-h-[62svh] lg:flex-col lg:justify-center lg:py-16"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  {chapter.eyebrow}
                </p>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  {chapter.title}
                </h3>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  {chapter.body}
                </p>
                <ul className="mt-7 space-y-3">
                  {chapter.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-3 text-sm font-medium text-slate-700"
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700"
                      >
                        ✓
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="mt-9 lg:hidden">
                  <StoryVisual
                    activeChapter={index}
                    compact
                    qrCodeDataUrl={qrCodeDataUrl}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="relative hidden lg:block">
            <div className="sticky top-10 flex h-[calc(100svh-5rem)] min-h-[590px] items-center">
              <StoryVisual
                activeChapter={activeChapter}
                qrCodeDataUrl={qrCodeDataUrl}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoryVisual({
  activeChapter,
  compact = false,
  qrCodeDataUrl,
}: {
  activeChapter: number;
  compact?: boolean;
  qrCodeDataUrl: string;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-[2rem] border border-border bg-white shadow-[0_24px_64px_rgba(15,23,42,0.14)]">
      <div className="relative z-20 flex h-16 items-center justify-between border-b border-border bg-white px-5">
        <div className="flex items-center gap-3">
          <Image
            src="/tournibase-app-icon.svg"
            alt=""
            width={32}
            height={32}
          />
          <div>
            <p className="text-sm font-semibold text-slate-950">TourniBase</p>
            <p className="text-xs text-slate-500">Demo event</p>
          </div>
        </div>
        <div className="flex items-center gap-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                activeChapter === index
                  ? "w-7 bg-blue-600"
                  : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      <div className={compact ? "relative h-[550px]" : "relative h-[min(620px,calc(100svh-9rem))] min-h-[560px]"}>
        <StoryPanel active={activeChapter === 0}>
          <CheckoutScene compact={compact} />
        </StoryPanel>
        <StoryPanel active={activeChapter === 1}>
          <PassScene qrCodeDataUrl={qrCodeDataUrl} />
        </StoryPanel>
        <StoryPanel active={activeChapter === 2}>
          <GateScene compact={compact} />
        </StoryPanel>
      </div>
    </div>
  );
}

function StoryPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

function CheckoutScene({ compact }: { compact: boolean }) {
  return (
    <div className="app-grid absolute inset-0 overflow-hidden bg-[#f6f7fb] p-5 sm:p-7">
      <div className="mx-auto max-w-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              Public ticket page
            </p>
            <h4 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">
              Choose your passes
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Carolina Hardwood Classic
            </p>
          </div>
          {!compact ? (
            <span className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              Secure digital admission
            </span>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          <TicketOption
            description="Valid Sep 19, 2026 – Sep 20, 2026"
            price="$28.00"
            quantity={1}
            title="Weekend Pass"
          />
          <TicketOption
            description="Valid Sep 19, 2026"
            price="$18.00"
            quantity={0}
            title="Saturday Pass"
          />
          <TicketOption
            description="Valid Sep 20, 2026"
            price="$18.00"
            quantity={0}
            title="Sunday Pass"
          />
        </div>

        {!compact ? (
          <div className="mt-4 rounded-2xl border border-border bg-card-strong p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">1 pass selected</p>
                <p className="mt-1 text-xs text-slate-500">
                  Carolina Hardwood Classic
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Total
                </p>
                <p className="mt-1 font-mono text-xl font-semibold text-slate-950">
                  $28.00
                </p>
              </div>
            </div>
            <div className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white">
              Buy Digital Pass
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TicketOption({
  description,
  price,
  quantity,
  title,
}: {
  description: string;
  price: string;
  quantity: number;
  title: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        quantity > 0
          ? "border-blue-400 bg-blue-50"
          : "border-border bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-semibold text-slate-950">{title}</p>
            <p className="font-mono text-sm font-semibold text-blue-700">
              {price}
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 items-center rounded-xl border border-border bg-card-strong p-1">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-lg text-slate-500">
            −
          </span>
          <span className="w-8 text-center font-mono text-sm font-semibold text-slate-950">
            {quantity}
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-lg text-lg text-slate-700">
            +
          </span>
        </div>
      </div>
    </div>
  );
}

function PassScene({ qrCodeDataUrl }: { qrCodeDataUrl: string }) {
  return (
    <div className="app-grid absolute inset-0 overflow-hidden bg-[#f6f7fb] p-4 sm:p-6">
      <div className="mx-auto max-w-[390px] overflow-hidden rounded-[1.75rem] border border-border bg-white shadow-xl shadow-slate-900/10">
        <div className="border-b border-border p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
            Active
          </div>
          <p className="mt-4 text-sm font-medium text-blue-700">
            Mobile admission pass
          </p>
          <h4 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">
            Carolina Hardwood Classic
          </h4>
          <p className="mt-1 text-sm text-slate-600">Weekend Pass</p>
        </div>

        <div className="p-5">
          <div className="relative mx-auto max-w-[250px] rounded-3xl bg-white p-3 shadow-lg shadow-slate-900/15">
            <Image
              src={qrCodeDataUrl}
              alt="Harmless demo QR code shown in the TourniBase pass design"
              width={320}
              height={320}
              className="h-auto w-full"
              unoptimized
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 grid h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-white p-1 shadow-sm"
            >
              <Image
                src="/tournibase-app-icon.svg"
                alt=""
                width={64}
                height={64}
                className="h-full w-full"
              />
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="font-semibold text-slate-950">
              Present this code at the gate
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Demo only. This QR cannot validate as an admission pass.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GateScene({ compact }: { compact: boolean }) {
  return (
    <div className="gate-dark app-grid absolute inset-0 overflow-hidden bg-[#07101d] p-5 text-white sm:p-7">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">
              Main Entrance
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Carolina Hardwood Classic
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-200">
            Scanner ready
          </span>
        </div>

        <section className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.09] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
            Secure validation complete
          </p>
          <h4 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            VALID
          </h4>
          <p className="mt-3 text-base text-emerald-100">
            Pass approved. Admit the guest.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ResultMetric label="Ticket" value="Weekend Pass" />
            <ResultMetric label="Guest" value="Jordan Miller" />
          </div>

          {!compact ? (
            <dl className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/15 px-4">
              <ResultDetail label="Tournament" value="Carolina Hardwood Classic" />
              <ResultDetail label="Gate" value="Main Entrance" />
              <ResultDetail label="Entry type" value="Camera scan" />
            </dl>
          ) : (
            <dl className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-black/15 px-4">
              <ResultDetail label="Gate" value="Main Entrance" />
              <ResultDetail label="Entry type" value="Camera scan" />
            </dl>
          )}
        </section>

        <div className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-emerald-300 px-5 text-sm font-semibold text-emerald-950">
          Scan next pass
        </div>
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ResultDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-200">{value}</dd>
    </div>
  );
}
