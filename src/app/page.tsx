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
    <main className="app-grid flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
        <Brand />
        <Link
          href="/login"
          className="rounded-full border border-border bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/25 hover:bg-white/10"
        >
          Director sign in
        </Link>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-soft px-3 py-1.5 text-sm font-medium text-blue-200">
            <span className="h-2 w-2 rounded-full bg-brand" />
            Web app foundation
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.045em] text-white sm:text-6xl">
            Sell admission. Move the gate. Stop duplicate tickets.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            TourniBase gives youth basketball directors one place to sell
            spectator passes, scan guests in, and see live gate activity.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-strong px-5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Open director dashboard
            </Link>
            <span className="inline-flex min-h-12 items-center justify-center px-4 text-sm text-slate-400">
              Director accounts are invite-only during the MVP.
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-2xl shadow-black/25 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Gate status
              </p>
              <p className="mt-1 font-semibold text-white">Saturday admission</p>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
              Ready
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 py-5">
            <div className="rounded-2xl bg-card-strong p-4">
              <p className="text-sm text-slate-400">Passes sold</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-white">—</p>
            </div>
            <div className="rounded-2xl bg-card-strong p-4">
              <p className="text-sm text-slate-400">Checked in</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-white">—</p>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-5 text-center text-sm leading-6 text-slate-400">
            Your first tournament will appear here after event setup is added.
          </div>
        </div>
      </section>
    </main>
  );
}
