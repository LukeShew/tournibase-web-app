import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getDirector } from "@/lib/auth";

export default async function Home() {
  const director = await getDirector();

  if (director) {
    redirect("/dashboard");
  }

  return (
    <main className="overflow-hidden bg-[#f7f8fb] text-slate-950">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
        <Brand tone="light" />
        <div className="flex items-center gap-3">
          <PrimaryLink href="/support">Get started</PrimaryLink>
          <SecondaryLink href="/login">Sign in</SecondaryLink>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[650px] w-full max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
        <div className="pointer-events-none absolute -left-56 top-0 h-[520px] w-[520px] rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Built for youth basketball tournaments
          </div>
          <h1 className="mt-7 max-w-3xl text-5xl font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
            Faster entry. Fewer reused passes.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Sell admission online, send every buyer a mobile pass, and give
            gate staff one simple scanner.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <PrimaryLink href="/support" large>
              Get started
            </PrimaryLink>
            <SecondaryLink href="/login" large>
              Sign in
            </SecondaryLink>
          </div>
        </div>

        <GatePreview />
      </section>

      <section className="border-y border-border bg-white py-20">
        <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
          <SectionHeading
            eyebrow="Why TourniBase"
            title="Keep the gate moving."
            body="Use TourniBase to streamline admissions for your next tournament."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <BenefitCard
              icon="01"
              title="Buy before arrival"
              body="Parents receive their passes by email and can save a backup to their phone."
            />
            <BenefitCard
              icon="02"
              title="Scan in seconds"
              body="Gate staff open a secure link and use the camera already on their phone."
            />
            <BenefitCard
              icon="03"
              title="Stop repeat entry"
              body="Reused, refunded, and wrong-day passes are clearly blocked at the gate."
            />
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8fb] py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-start lg:px-8">
          <SectionHeading
            eyebrow="Fraud resistance"
            title="Every pass is checked, not just scanned."
            body="TourniBase helps reduce admission leakage by checking the order, event, date, refund status, and prior use before accepting a pass."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FraudCard
              title="Duplicate blocking"
              body="The first valid entry is recorded so the same pass cannot be reused at another gate."
            />
            <FraudCard
              title="Refund checks"
              body="Fully refunded orders are marked and their passes are blocked from entry."
            />
            <FraudCard
              title="Event and date checks"
              body="Wrong-event and wrong-day passes are rejected before admission is recorded."
            />
            <FraudCard
              title="Controlled scanner access"
              body="Gate links expire, can be revoked, and limit staff to the access they need."
            />
          </div>
        </div>
      </section>

      <section className="gate-dark bg-slate-950 py-24 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold text-blue-300">For directors</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Know what is happening at the gate.
            </h2>
            <ul className="mt-8 space-y-4 text-slate-300">
              <CheckItem>Sales and admission totals</CheckItem>
              <CheckItem>Live check-in activity</CheckItem>
              <CheckItem>Order lookup and refunds</CheckItem>
              <CheckItem>Secure links for each gate team</CheckItem>
            </ul>
          </div>
          <DirectorPreview />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-8">
        <SectionHeading
          eyebrow="One connected flow"
          title="From checkout to check-in."
          body="Every step stays tied to the same order, pass, and event."
        />
        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm sm:p-7">
          <FlowStep number="1" title="Spectator buys" detail="Stripe checkout" />
          <FlowConnector />
          <FlowStep number="2" title="TourniBase sends" detail="Email + mobile pass" />
          <FlowConnector />
          <FlowStep number="3" title="Gate staff scans" detail="Live validation" />
        </div>
      </section>

      <section className="w-full bg-white py-24">
        <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
          <div className="gate-dark relative overflow-hidden rounded-[2.25rem] bg-blue-600 px-7 py-12 text-white shadow-xl sm:px-12 sm:py-16">
            <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full border-[42px] border-white/10" />
            <div className="relative max-w-2xl">
              <p className="text-sm font-semibold text-blue-100">Start with one event</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
                Make your next gate easier to run.
              </h2>
              <p className="mt-4 text-lg text-blue-100">
                Click below to use TourniBase for your next tournament.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/support"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
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
      className={`inline-flex items-center justify-center rounded-2xl bg-blue-600 font-semibold text-white shadow-sm transition hover:bg-blue-500 ${
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
  large = false,
}: {
  children: React.ReactNode;
  href: string;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-2xl border border-border bg-white font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 ${
        large ? "min-h-12 px-5 text-sm" : "px-4 py-2 text-sm"
      }`}
    >
      {children}
    </Link>
  );
}

function GatePreview() {
  return (
    <div className="relative rounded-[2.25rem] border border-border bg-white p-5 shadow-xl shadow-blue-950/10">
      <div className="rounded-[1.75rem] border border-border bg-[#f7f8fb] p-6 text-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Gate 1
            </p>
            <p className="mt-2 text-xl font-semibold">Pass accepted</p>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-2xl font-bold text-emerald-950">
            ✓
          </span>
        </div>
        <div className="mt-8 rounded-3xl border border-border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Weekend pass</p>
          <p className="mt-2 text-2xl font-semibold">Taylor Johnson</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <PreviewStat label="Order" value="TB-000128" />
            <PreviewStat label="Status" value="Checked in" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f8fb] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-slate-950">{value}</p>
    </div>
  );
}

function SectionHeading({
  body,
  eyebrow,
  title,
}: {
  body: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-blue-700">{eyebrow}</p>
      <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-8 text-slate-600">{body}</p>
    </div>
  );
}

function BenefitCard({
  body,
  icon,
  title,
}: {
  body: string;
  icon: string;
  title: string;
}) {
  return (
    <article className="rounded-[2rem] bg-card-strong p-6">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white font-mono text-sm font-semibold text-blue-700 shadow-sm">
        {icon}
      </span>
      <h3 className="mt-6 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{body}</p>
    </article>
  );
}

function FraudCard({ body, title }: { body: string; title: string }) {
  return (
    <article className="rounded-[1.75rem] border border-border bg-white p-5 shadow-sm">
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-soft font-semibold text-blue-700"
      >
        ✓
      </span>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </article>
  );
}

function FlowStep({
  detail,
  number,
  title,
}: {
  detail: string;
  number: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-3xl bg-card-strong p-4 sm:p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 font-mono font-semibold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
      </div>
      <span className="text-2xl text-slate-300" aria-hidden="true">
        →
      </span>
    </div>
  );
}

function FlowConnector() {
  return <div className="ml-11 h-4 w-px bg-blue-200" aria-hidden="true" />;
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-300">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function DirectorPreview() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Saturday tournament</p>
          <p className="mt-1 text-xl font-semibold">Live gate snapshot</p>
        </div>
        <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          Live
        </span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <DarkMetric label="Passes sold" value="128" />
        <DarkMetric label="Checked in" value="91" />
        <DarkMetric label="Duplicates" value="3" />
      </div>
      <div className="mt-5 rounded-3xl bg-slate-900 p-4">
        <div className="flex justify-between text-sm text-slate-300">
          <span>Admission progress</span>
          <span className="font-mono text-blue-300">71%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[71%] rounded-full bg-blue-500" />
        </div>
      </div>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-900 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
