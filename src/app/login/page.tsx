import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getDirector } from "@/lib/auth";
import { DIRECTOR_PROMISE } from "@/lib/product-copy";

export const metadata: Metadata = {
  title: "Director sign in",
};

export default async function LoginPage() {
  const director = await getDirector();

  if (director) {
    redirect("/dashboard");
  }

  return (
    <main className="app-grid grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <section className="flex flex-col px-6 py-6 sm:px-10 lg:px-14">
        <Brand />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-14">
          <p className="text-sm font-medium text-blue-300">Director access</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
            Welcome back
          </h1>
          <p className="mt-3 leading-7 text-slate-400">
            {DIRECTOR_PROMISE}
          </p>
          <LoginForm />
          <p className="mt-6 text-center text-sm leading-6 text-slate-500">
            Director accounts are provisioned by invitation.
          </p>
        </div>
      </section>

      <aside className="hidden border-l border-border bg-card/60 p-10 lg:flex lg:items-center">
        <div className="mx-auto max-w-lg">
          <div className="rounded-3xl border border-border bg-card p-7 shadow-2xl shadow-black/25">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  TourniBase gate
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  Run a faster gate
                </p>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-blue-300">
                Digital gate system
              </span>
            </div>
            <div className="mt-8 space-y-3">
              {[
                "Sell tournament passes online",
                "Scan people in faster",
                "Stop duplicate tickets at the gate",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl bg-card-strong px-4 py-3.5 text-sm text-slate-200"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/10 text-xs text-emerald-300">
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
