import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Email confirmed",
};

export default function EmailConfirmedPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#f7f8fb] px-5 py-6 text-slate-950 sm:px-10">
      <header className="mx-auto flex w-full max-w-6xl items-center">
        <Brand tone="light" />
      </header>

      <section className="mx-auto flex w-full max-w-lg flex-1 items-center py-12 sm:py-16">
        <div className="w-full rounded-[2rem] border border-border bg-white px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
          <div
            aria-hidden="true"
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-semibold text-emerald-700"
          >
            ✓
          </div>
          <p className="mt-6 text-sm font-semibold text-blue-700">
            TourniBase director account
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Email confirmed
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-slate-600 sm:text-lg">
            Your email address has been confirmed. You can now sign in to
            access your director dashboard.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-strong px-6 text-sm font-semibold text-white transition hover:bg-blue-500 sm:w-auto"
          >
            Go to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
