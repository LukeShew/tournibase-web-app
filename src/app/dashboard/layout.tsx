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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-200">
                {director.name}
              </p>
              <p className="text-xs text-slate-500">{director.email}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside>
          <nav aria-label="Dashboard navigation" className="space-y-1">
            <Link
              href="/dashboard"
              aria-current="page"
              className="flex items-center gap-3 rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-medium text-blue-200"
            >
              <span className="h-2 w-2 rounded-full bg-brand" />
              Overview
            </Link>
            <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600">
              <span className="h-2 w-2 rounded-full bg-slate-700" />
              Tournaments
              <span className="ml-auto text-[10px] uppercase tracking-wider">
                Next
              </span>
            </span>
          </nav>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
