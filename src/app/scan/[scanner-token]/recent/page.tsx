import type { Metadata } from "next";
import Link from "next/link";
import { recentScansForScanner } from "@/app/scan/[scanner-token]/actions";
import { RecentGateScans } from "@/components/recent-gate-scans";
import { ScannerUnavailable } from "@/components/scanner-unavailable";
import { getRecentScannerActivity } from "@/lib/recent-scans";
import { getScannerSessionByToken } from "@/lib/scanner-sessions";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Recent gate scans",
  referrer: "no-referrer",
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
};

export default async function RecentScansPage({
  params,
}: {
  params: Promise<{ "scanner-token": string }>;
}) {
  const { "scanner-token": scannerToken } = await params;

  if (getSupabaseAdminConfigurationIssues().length > 0) {
    return <ScannerUnavailable status="service" />;
  }

  let lookup: Awaited<ReturnType<typeof getScannerSessionByToken>>;

  try {
    lookup = await getScannerSessionByToken(scannerToken);
  } catch (error) {
    console.error("[recent-scans] session lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return <ScannerUnavailable status="service" />;
  }

  if (lookup.status !== "active") {
    return <ScannerUnavailable status={lookup.status} />;
  }

  if (!lookup.session.permissions.includes("recent")) {
    return <ScannerUnavailable status="permission" />;
  }

  const initialResult = await getRecentScannerActivity(scannerToken);
  const refreshScans = recentScansForScanner.bind(null, scannerToken);

  return (
    <main className="gate-dark app-grid min-h-screen bg-background pb-8">
      <header className="border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-white">TourniBase Gate</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {lookup.session.gateName}
            </p>
          </div>
          <Link
            href={`/scan/${scannerToken}`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
          >
            Back to scanner
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl px-4 py-5 sm:px-5 sm:py-7">
        <div className="mb-4 px-1">
          <p className="text-sm text-slate-400">
            {lookup.session.eventName}
          </p>
        </div>
        <RecentGateScans
          initialResult={initialResult}
          refreshScans={refreshScans}
        />
      </div>
    </main>
  );
}
