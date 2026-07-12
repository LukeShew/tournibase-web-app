"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export function DashboardMobileNavigation({
  logoutAction,
}: {
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const pathTournamentId = pathname.match(/^\/dashboard\/tournaments\/(\d+)/)?.[1];
  const settingsTournamentId =
    pathname === "/dashboard/settings" && /^\d+$/.test(searchParams.get("event") || "")
      ? searchParams.get("event")
      : null;
  const tournamentId = pathTournamentId ?? settingsTournamentId;
  const base = tournamentId ? `/dashboard/tournaments/${tournamentId}` : null;
  const items = [
    ["Home", "/dashboard"],
    ["Overview", base],
    ["Gate tools", base ? `${base}/gate` : null],
    ["Gate activity", base ? `${base}/scans` : null],
    ["Orders", base ? `${base}/orders` : null],
    ["Event details", base ? `${base}/edit` : null],
  ] as const;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/35 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <nav
            aria-label="Mobile dashboard navigation"
            className="ml-auto flex h-full w-full max-w-sm flex-col rounded-[2rem] bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-950">TourniBase menu</p>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-2xl" onClick={() => setOpen(false)} aria-label="Close menu">×</button>
            </div>
            <div className="mt-6 space-y-2">
              {items.map(([label, href]) =>
                href ? (
                  <Link key={label} href={href} onClick={() => setOpen(false)} className={`block rounded-2xl px-4 py-3 text-sm font-semibold ${pathname === href ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"}`}>{label}</Link>
                ) : (
                  <button key={label} type="button" disabled className="block w-full cursor-not-allowed rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-300">{label} · Select an event</button>
                ),
              )}
            </div>
            <div className="mt-auto grid gap-2">
              <Link href={base ? `/dashboard/settings?event=${tournamentId}` : "/dashboard/settings"} onClick={() => setOpen(false)} className="rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-slate-700">Settings</Link>
              <Link href="/support" onClick={() => setOpen(false)} className="rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-slate-700">Support</Link>
              {confirmingSignOut ? (
                <div className="rounded-2xl border border-border bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Sign out of this director account?</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setConfirmingSignOut(false)} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">Cancel</button>
                    <form action={logoutAction}>
                      <button type="submit" className="w-full rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Sign out</button>
                    </form>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmingSignOut(true)} className="w-full rounded-2xl border border-border px-4 py-3 text-left text-sm font-semibold text-slate-700">Sign out</button>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
