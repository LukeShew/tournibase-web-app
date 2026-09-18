import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LandingScrollStory } from "@/components/landing-scroll-story";
import { getPublicSignupHref } from "@/lib/app-environment";
import { getDirectorWorkspace } from "@/lib/auth";

export default async function Home() {
  const workspace = await getDirectorWorkspace();
  const signupHref = getPublicSignupHref();

  if (workspace) redirect("/dashboard");

  return (
    <main className="landing-page overflow-clip bg-[#f7f8fb] text-slate-950">
      <header className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Brand tone="light" />
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a className="transition hover:text-blue-700" href="#how-it-works">How it works</a>
          <a className="transition hover:text-blue-700" href="#gate-control">Gate control</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <SecondaryLink href="/login">Sign in</SecondaryLink>
          <PrimaryLink href={signupHref}>Get started</PrimaryLink>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[760px] w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:pb-28 lg:pt-20">
        <CourtBackdrop />
        <div className="relative z-10 max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            Tournament admissions, under control
          </p>
          <h1 className="mt-7 text-5xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-[4.7rem] lg:leading-[0.96]">
            Faster entry.
            <span className="block text-blue-600">Fewer reused passes.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
            Sell admission online, send every buyer a mobile pass, and give gate staff one simple scanner—all connected to one live view.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <PrimaryLink href={signupHref} large>Run your next event <span aria-hidden="true">→</span></PrimaryLink>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
              See how it works
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600">
            <HeroCheck>Online checkout</HeroCheck>
            <HeroCheck>Mobile passes</HeroCheck>
            <HeroCheck>Live gate validation</HeroCheck>
          </div>
        </div>
        <div className="relative z-10 lg:translate-x-4"><CommandCenterPreview /></div>
      </section>

      <div className="border-y border-blue-100 bg-white/80">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:justify-between sm:px-8 lg:px-10">
          <span>Sell before the doors open</span><span className="text-blue-300" aria-hidden="true">•</span>
          <span>Send every pass automatically</span><span className="text-blue-300" aria-hidden="true">•</span>
          <span>Know what happens at the gate</span>
        </div>
      </div>

      <LandingScrollStory />

      <section id="gate-control" className="gate-dark relative overflow-hidden bg-slate-950 py-24 text-white sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(37,99,235,0.24),transparent_34rem)]" />
        <div className="landing-court-lines-dark absolute inset-0 opacity-50" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-10">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Gate control</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">A scan should answer more than “is this a QR code?”</h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">TourniBase checks the event, valid date, refund status, and prior use before recording admission.</p>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/30 backdrop-blur sm:p-5">
            <div className="grid gap-px overflow-hidden rounded-[1.4rem] bg-white/10 sm:grid-cols-2">
              <GateRule label="Accepted" title="Valid pass" body="The entry is recorded and the gate keeps moving." tone="success" />
              <GateRule label="Blocked" title="Already checked in" body="Repeat use is flagged before another entry is recorded." tone="danger" />
              <GateRule label="Blocked" title="Wrong day" body="The pass date must match the day at the gate." tone="warning" />
              <GateRule label="Blocked" title="Refunded" body="Refunded admission cannot be presented for entry." tone="neutral" />
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-white py-24 sm:py-32">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-blue-600 px-7 py-14 text-white shadow-[0_30px_80px_rgba(37,99,235,0.24)] sm:px-12 sm:py-20 lg:px-20">
            <div className="landing-court-lines absolute inset-0 opacity-20" />
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[40px] border-white/10" />
            <div className="relative max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">Start with one event</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">Make your next tournament easier to run.</h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">Put checkout, passes, scanning, and gate reporting in one connected flow.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href={signupHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">Get started</Link>
                <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10">Sign in</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PrimaryLink({ children, href, large = false }: { children: React.ReactNode; href: string; large?: boolean }) {
  return <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 hover:bg-blue-500 ${large ? "min-h-12 px-5 text-sm" : "px-4 py-2 text-sm"}`}>{children}</Link>;
}

function SecondaryLink({ children, href }: { children: React.ReactNode; href: string }) {
  return <Link href={href} className="inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 sm:px-4">{children}</Link>;
}

function HeroCheck({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">✓</span>{children}</span>;
}

function CourtBackdrop() {
  return <div className="pointer-events-none absolute inset-0" aria-hidden="true"><div className="absolute -left-72 top-8 h-[540px] w-[540px] rounded-full bg-blue-200/50 blur-3xl" /><div className="absolute -right-64 -top-32 h-[620px] w-[620px] rounded-full bg-blue-100/80 blur-3xl" /><div className="landing-court-lines absolute inset-0 opacity-60" /></div>;
}

function CommandCenterPreview() {
  const navigation = ["Overview", "Orders", "Gate", "Scans"];
  return (
    <div className="landing-float relative mx-auto max-w-3xl">
      <div className="absolute -inset-5 rounded-[3rem] bg-gradient-to-br from-blue-400/20 via-white/20 to-blue-700/10 blur-2xl" />
      <div className="gate-dark relative rotate-[1deg] overflow-hidden rounded-[2.25rem] border border-slate-800/10 bg-[#081321] p-3 shadow-[0_40px_90px_rgba(15,23,42,0.28)] sm:p-4">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 pb-3"><span className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" /><span className="ml-3 text-[10px] font-medium text-slate-400">Director dashboard</span></div>
        <div className="grid min-h-[430px] grid-cols-[70px_1fr] sm:grid-cols-[110px_1fr]">
          <aside className="border-r border-white/10 px-2 py-5 sm:px-3">
            <div className="mb-7 flex items-center gap-2 text-white"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-xs font-bold">T</span><span className="hidden text-xs font-semibold sm:block">TourniBase</span></div>
            {navigation.map((label, index) => <div key={label} className={`mb-2 rounded-lg px-2 py-2 text-[9px] sm:text-[10px] ${index === 0 ? "bg-blue-600 text-white" : "text-slate-400"}`}>{label}</div>)}
          </aside>
          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.14em] text-blue-300">Live event</p><h2 className="mt-2 text-lg font-semibold text-white sm:text-2xl">Sample tournament</h2></div><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[9px] font-semibold text-emerald-300">Published</span></div>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3"><HeroMetric label="Online sales" value="$3,840" /><HeroMetric label="Passes sold" value="164" /><HeroMetric label="Checked in" value="118" /></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><div className="flex items-center justify-between text-[10px] text-slate-400"><span>Admissions by hour</span><span className="font-mono text-blue-300">Today</span></div><div className="mt-7 flex h-28 items-end gap-2">{[20,34,48,74,92,66,44,28].map((height,index) => <span key={`${height}-${index}`} className="flex-1 rounded-t bg-blue-500" style={{ height: `${height}%`, opacity: 0.45 + index * 0.06 }} />)}</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"><p className="text-[10px] text-slate-400">Recent gate activity</p><div className="mt-4 space-y-3"><ActivityItem label="Pass accepted" time="10:42" /><ActivityItem label="Pass accepted" time="10:41" /><ActivityItem label="Duplicate blocked" time="10:40" warning /></div></div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 -left-3 rounded-2xl border border-blue-100 bg-white p-3 shadow-xl sm:-left-8 sm:p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Gate status</p><p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-emerald-500" />Entry moving</p></div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5 sm:p-3"><p className="text-[8px] text-slate-400 sm:text-[10px]">{label}</p><p className="mt-1 font-mono text-sm font-semibold text-white sm:text-lg">{value}</p></div>;
}

function ActivityItem({ label, time, warning = false }: { label: string; time: string; warning?: boolean }) {
  return <div className="flex items-center gap-2 text-[9px] sm:text-[10px]"><span className={`h-2 w-2 shrink-0 rounded-full ${warning ? "bg-amber-400" : "bg-emerald-400"}`} /><span className="min-w-0 flex-1 truncate text-slate-200">{label}</span><span className="font-mono text-slate-500">{time}</span></div>;
}

function GateRule({ body, label, title, tone }: { body: string; label: string; title: string; tone: "danger" | "neutral" | "success" | "warning" }) {
  const tones = { danger: "bg-red-400/15 text-red-200", neutral: "bg-slate-400/15 text-slate-200", success: "bg-emerald-400/15 text-emerald-200", warning: "bg-amber-400/15 text-amber-200" };
  return <article className="bg-[#0c1727] p-6 sm:p-7"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</span><h3 className="mt-5 text-xl font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>;
}
