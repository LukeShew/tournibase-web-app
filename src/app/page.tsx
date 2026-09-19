import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Brand } from "@/components/brand";
import { LandingScrollStory } from "@/components/landing-scroll-story";
import { RevenueTrendCard } from "@/components/revenue-trend-card";
import { getPublicSignupHref } from "@/lib/app-environment";
import { getDirectorWorkspace } from "@/lib/auth";

const demoSales = [
  { date: "2026-09-14", totalRevenue: 748 },
  { date: "2026-09-15", totalRevenue: 1116 },
  { date: "2026-09-16", totalRevenue: 1852 },
  { date: "2026-09-17", totalRevenue: 2812 },
  { date: "2026-09-18", totalRevenue: 5952 },
  { date: "2026-09-19", totalRevenue: 9214 },
];

export default async function Home() {
  const workspace = await getDirectorWorkspace();
  const signupHref = getPublicSignupHref();

  if (workspace) redirect("/dashboard");

  const demoQrCode = await QRCode.toDataURL(
    "https://tournibase.com/demo-pass",
    {
      color: {
        dark: "#07101D",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
      margin: 2,
      width: 320,
    },
  );

  return (
    <main className="landing-page bg-[#f7f8fb] text-slate-950">
      <header className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Brand tone="light" />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex"
        >
          <a className="transition hover:text-blue-700" href="#how-it-works">
            How it works
          </a>
          <a className="transition hover:text-blue-700" href="#gate-control">
            Gate control
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <SecondaryLink href="/login">Sign in</SecondaryLink>
          <PrimaryLink href={signupHref}>Get started</PrimaryLink>
        </div>
      </header>

      <section className="app-grid relative border-y border-slate-200/80 bg-[#f7f8fb]">
        <div className="mx-auto grid min-w-0 w-full max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-24">
          <div className="relative z-10 min-w-0 max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 shadow-sm">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-600" />
              Built for youth basketball tournaments
            </p>
            <h1 className="mt-7 max-w-[12ch] text-balance text-[clamp(3.25rem,5.4vw,4.6rem)] font-semibold leading-[1.01] tracking-[-0.05em] text-slate-950">
              Faster entry. Fewer reused passes.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
              Sell admission online, send every buyer a mobile pass, and give
              gate staff one clear answer at the door.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <PrimaryLink href={signupHref} large>
                Run your next event <span aria-hidden="true">→</span>
              </PrimaryLink>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                See how it works
              </a>
            </div>
            <ul className="mt-10 grid max-w-lg gap-3 text-sm font-medium text-slate-700 sm:grid-cols-3">
              <HeroCheck>Online checkout</HeroCheck>
              <HeroCheck>Mobile passes</HeroCheck>
              <HeroCheck>Gate validation</HeroCheck>
            </ul>
          </div>

          <DirectorDashboardPreview />
        </div>
      </section>

      <LandingScrollStory qrCodeDataUrl={demoQrCode} />

      <section
        id="gate-control"
        className="gate-dark app-grid relative bg-[#07101d] py-24 text-white sm:py-28"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:px-10">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">
              Gate control
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              A clear decision for every scan.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">
              TourniBase checks the event, valid date, refund status, and prior
              use before recording admission.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ScannerState
              eyebrow="Secure validation complete"
              title="VALID"
              body="Pass approved. Admit the guest."
              tone="green"
            />
            <ScannerState
              eyebrow="Duplicate admission blocked"
              title="ALREADY SCANNED"
              body="Do not admit without a documented override."
              tone="red"
            />
            <ScannerState
              eyebrow="Date check failed"
              title="NOT VALID TODAY"
              body="This pass is outside its valid date or time."
              tone="amber"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-28">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-8 px-5 sm:px-8 md:flex-row md:items-end lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
              Start with one event
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">
              Make your next tournament easier to run.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Put checkout, passes, scanning, and gate reporting in one
              connected flow.
            </p>
          </div>
          <PrimaryLink href={signupHref} large>
            Get started <span aria-hidden="true">→</span>
          </PrimaryLink>
        </div>
      </section>
    </main>
  );
}

function DirectorDashboardPreview() {
  return (
    <div className="relative z-10 mx-auto min-w-0 w-full max-w-[700px]">
      <div className="overflow-hidden rounded-[2rem] border border-border bg-white shadow-[0_24px_64px_rgba(15,23,42,0.14)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/tournibase-app-icon.svg"
              alt=""
              width={34}
              height={34}
            />
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Director dashboard
              </p>
              <p className="text-xs text-slate-500">Demo data</p>
            </div>
          </div>
          <span className="rounded-full border border-border bg-card-strong px-2.5 py-1 text-xs font-semibold text-slate-600">
            Published
          </span>
        </div>

        <div className="bg-[#f6f7fb] p-4 sm:p-6">
          <div className="mb-5">
            <p className="text-sm font-semibold text-blue-700">
              Youth basketball admission
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-3xl">
              Carolina Hardwood Classic
            </h2>
            <p className="mt-2 font-mono text-xs text-slate-500 sm:text-sm">
              Sep 19, 2026 – Sep 20, 2026
            </p>
          </div>

          <RevenueTrendCard days={demoSales} totalRevenue={21694} />

          <div className="mt-4 rounded-[1.75rem] border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                  Live event snapshot
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  Admission progress
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  613 of 917 online passes checked in.
                </p>
              </div>
              <p className="font-mono text-3xl font-semibold text-blue-700">
                67%
              </p>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-card-strong">
              <div className="h-full w-[67%] rounded-full bg-blue-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrimaryLink({
  children,
  href,
  large = false,
}: {
  children: React.ReactNode;
  href: string;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)] transition hover:-translate-y-0.5 hover:bg-blue-500 ${
        large ? "min-h-12 px-5 text-sm" : "px-4 py-2 text-sm"
      }`}
    >
      {children}
    </Link>
  );
}

function SecondaryLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-4"
    >
      {children}
    </Link>
  );
}

function HeroCheck({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700"
      >
        ✓
      </span>
      {children}
    </li>
  );
}

function ScannerState({
  body,
  eyebrow,
  title,
  tone,
}: {
  body: string;
  eyebrow: string;
  title: string;
  tone: "amber" | "green" | "red";
}) {
  const styles = {
    amber: "border-amber-300/15 bg-amber-300/[0.08] text-amber-200",
    green: "border-emerald-300/15 bg-emerald-300/[0.08] text-emerald-200",
    red: "border-red-300/15 bg-red-300/[0.08] text-red-200",
  };

  return (
    <article className={`rounded-2xl border p-5 ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase leading-5 tracking-[0.12em]">
        {eyebrow}
      </p>
      <h3 className="mt-8 break-words text-xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
    </article>
  );
}
