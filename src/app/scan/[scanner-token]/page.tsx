import type { Metadata } from "next";
import {
  overridePassForScanner,
  undoCheckInForScanner,
  validatePassForScanner,
} from "@/app/scan/[scanner-token]/actions";
import { MobileGateScanner } from "@/components/mobile-gate-scanner";
import { ScannerUnavailable } from "@/components/scanner-unavailable";
import { getScannerSessionByToken } from "@/lib/scanner-sessions";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Gate scanner",
  referrer: "no-referrer",
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
};

export default async function ScannerPage({
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
    console.error("[scanner] session lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return <ScannerUnavailable status="service" />;
  }

  if (lookup.status !== "active") {
    return <ScannerUnavailable status={lookup.status} />;
  }

  const overridePass = overridePassForScanner.bind(null, scannerToken);
  const undoCheckIn = undoCheckInForScanner.bind(null, scannerToken);
  const validatePass = validatePassForScanner.bind(null, scannerToken);

  return (
    <MobileGateScanner
      eventName={lookup.session.eventName}
      expiresAt={lookup.session.expiresAt}
      gateName={lookup.session.gateName}
      permissions={lookup.session.permissions}
      staffLabel={lookup.session.staffLabel}
      overridePass={overridePass}
      undoCheckIn={undoCheckIn}
      validatePass={validatePass}
      venueName={lookup.session.venueName}
    />
  );
}
