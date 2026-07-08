import Link from "next/link";
import { Brand } from "@/components/brand";
import { logout } from "@/app/login/actions";
import { requireDirector } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const director = await requireDirector();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-[1480px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-20 hidden h-screen flex-col border-r border-border bg-card/95 px-4 py-5 shadow-sm lg:flex">
          <Brand />

          <nav aria-label="Dashboard navigation" className="mt-6 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-2xl bg-brand-soft px-3 py-3 text-sm font-semibold text-blue-700"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-base shadow-sm">
                ▣
              </span>
              Events
            </Link>
          </nav>

          <div className="mt-auto space-y-3">
            <Link
              href="/support"
              className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-card-strong hover:text-slate-900"
            >
              <span className="grid h-7 w-7 place-items-center rounded-xl border border-border bg-white text-sm shadow-sm">
                ?
              </span>
              Support
            </Link>

            <div className="rounded-3xl bg-card-strong p-3">
              <p className="truncate text-sm font-semibold text-slate-950">
                {director.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {director.email}
              </p>
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-card-strong hover:text-slate-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-5 py-4 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <Brand />
              <Link
                href="/dashboard/tournaments/new"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-strong px-3 text-sm font-semibold text-white"
              >
                New event
              </Link>
            </div>
          </header>

          <main className="px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
