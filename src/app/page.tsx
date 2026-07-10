import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getDirector } from "@/lib/auth";
import {
  DIRECTOR_PROMISE,
  PRODUCT_POSITIONING,
} from "@/lib/product-copy";

export default async function Home() {
  const director = await getDirector();

  if (director) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-full bg-[#f7f8fb] text-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
        <Brand tone="light" />
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            Sign in
          </Link>
          <Link
            href="/support"
            className="rounded-full bg-brand-strong px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Youth basketball admission control
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-6xl">
            {DIRECTOR_PROMISE}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {PRODUCT_POSITIONING}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/support"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-strong px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-white p-5 shadow-sm">
          <div className="rounded-[1.5rem] bg-card-strong p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  Gate status
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  Saturday admission
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                Ready
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <DemoMetric label="Passes sold" value="128" />
              <DemoMetric label="Checked in" value="91" />
            </div>
            <div className="mt-5 rounded-3xl bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">
                  Admission progress
                </span>
                <span className="font-mono font-semibold text-blue-700">
                  71%
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[71%] rounded-full bg-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-16 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <ValueCard
          title="Shorter lines"
          body="Spectators can purchase passes in seconds, skip cash or paper tickets, and open their passes from email. Each pass also includes a backup save option for venues with weak service."
        />
        <ValueCard
          title="Cleaner scanning"
          body="Gate staff use secure scanner links to validate passes in real time with server-side duplicate detection. No special hardware or app install is required."
        />
        <ValueCard
          title="Less leakage"
          body="TourniBase blocks refunded, reused, duplicate, and wrong-day passes so tournament revenue is protected at the gate."
        />
        <ValueCard
          title="Reliability and ease"
          body="Scanner links use hashed credentials, Stripe handles payments securely, and directors can look up orders, process refunds, and review gate activity from one admissions dashboard."
        />
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20 lg:px-8">
        <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-blue-700">
            Built for the current wedge
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
            Start with tournament-day admissions.
          </h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600">
            TourniBase is purpose-built for youth tournament admissions, not
            general event management. The first focus is youth basketball gate
            control: online passes, pass emails, offline backups, scanner
            links, order lookup, refunds, and gate activity. Early adopters
            help shape the admissions platform before it expands to other
            sports.
          </p>
        </div>
      </section>
    </main>
  );
}

function DemoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-blue-700">
        {value}
      </p>
    </div>
  );
}

function ValueCard({ body, title }: { body: string; title: string }) {
  return (
    <div className="rounded-[2rem] border border-border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 leading-7 text-slate-600">{body}</p>
    </div>
  );
}
