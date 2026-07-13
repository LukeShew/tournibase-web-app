import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getDirector } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Director sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ created?: string; confirmation?: string }>;
}) {
  const director = await getDirector();
  const { created, confirmation } = (await searchParams) ?? {};

  if (director) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-full bg-[#f7f8fb] px-6 py-6 text-slate-950 sm:px-10">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Brand tone="light" />
        <Link
          href="/signup"
          className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          Create account
        </Link>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-md flex-col justify-center py-14">
        <p className="text-sm font-semibold text-blue-700">Director access</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
          Sign in to TourniBase
        </h1>
        <p className="mt-3 leading-7 text-slate-500">
          Use the director account connected to your tournament dashboard.
        </p>
        {created === "1" || confirmation === "resent" ? (
          <div
            aria-live="polite"
            className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
          >
            {confirmation === "resent"
              ? "If this account still needs confirmation, a new email was sent. If it is already confirmed, sign in."
              : confirmation === "required"
              ? "Your account was created. Check your email to confirm it, then sign in."
              : "Your account was created. Sign in to continue."}
          </div>
        ) : null}
        {confirmation === "resend-error" ||
        confirmation === "resend-limited" ? (
          <div
            aria-live="polite"
            className="mt-6 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          >
            {confirmation === "resend-limited"
              ? "Too many confirmation requests. Try again later."
              : "The confirmation email could not be sent. Try again."}
          </div>
        ) : null}
        <div className="mt-8 rounded-[2rem] border border-border bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm leading-6 text-slate-500">
          Need an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-blue-700 hover:text-blue-500"
          >
            Create account
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
