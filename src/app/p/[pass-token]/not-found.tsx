import Link from "next/link";
import { Brand } from "@/components/brand";

export default function PassNotFound() {
  return (
    <main className="app-grid min-h-screen bg-background">
      <header className="border-b border-border bg-background/90">
        <div className="mx-auto w-full max-w-lg px-5 py-4">
          <Brand />
        </div>
      </header>
      <div className="mx-auto w-full max-w-lg px-5 py-10">
        <section className="rounded-3xl border border-border bg-card p-6">
          <p className="text-sm font-medium text-amber-200">Pass not found</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
            Check the pass link
          </h1>
          <p className="mt-3 leading-7 text-slate-400">
            This link is invalid or the pass is not available. Use the original
            link from your order confirmation or contact the event organizer.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            Go to TourniBase
          </Link>
        </section>
      </div>
    </main>
  );
}
