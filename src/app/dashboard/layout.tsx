import Link from "next/link";
import { Brand } from "@/components/brand";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
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
      <div className="grid min-h-screen w-full lg:grid-cols-[80px_minmax(0,1fr)] 2xl:grid-cols-[288px_minmax(0,1fr)]">
        <DashboardSidebar director={director} logoutAction={logout} />

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

          <main className="mx-auto w-full max-w-[1480px] px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
