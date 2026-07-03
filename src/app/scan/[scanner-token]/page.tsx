import type { Metadata } from "next";
import {
  overridePassForScanner,
  undoCheckInForScanner,
  validatePassForScanner,
} from "@/app/scan/[scanner-token]/actions";
import { Brand } from "@/components/brand";
import { MobileGateScanner } from "@/components/mobile-gate-scanner";
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

function ScannerUnavailable({
  status,
}: {
  status: "expired" | "invalid" | "revoked" | "service";
}) {
  const content = {
    expired: {
      eyebrow: "Scanner link expired",
      title: "Ask the director for a new link",
      description:
        "This gate-access link has reached its expiration time and can no longer open the scanner.",
    },
    invalid: {
      eyebrow: "Scanner link unavailable",
      title: "Check the link",
      description:
        "This link is invalid or does not match an active TourniBase scanner session.",
    },
    revoked: {
      eyebrow: "Scanner access revoked",
      title: "This link is no longer active",
      description:
        "The tournament director disabled this scanner link. Ask the director to create a replacement if access is still needed.",
    },
    service: {
      eyebrow: "Scanner temporarily unavailable",
      title: "Try again in a moment",
      description:
        "TourniBase could not verify this scanner link. Refresh the page or contact the tournament director if the problem continues.",
    },
  } satisfies Record<
    "expired" | "invalid" | "revoked" | "service",
    { description: string; eyebrow: string; title: string }
  >;
  const message = content[status];

  return (
    <main className="app-grid min-h-screen bg-background">
      <header className="border-b border-border bg-background/90">
        <div className="mx-auto w-full max-w-xl px-5 py-4">
          <Brand />
        </div>
      </header>
      <div className="mx-auto w-full max-w-xl px-5 py-10">
        <section className="rounded-3xl border border-amber-300/20 bg-card p-6 sm:p-8">
          <p className="text-sm font-medium text-amber-200">
            {message.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
            {message.title}
          </h1>
          <p className="mt-3 leading-7 text-slate-400">
            {message.description}
          </p>
        </section>
      </div>
    </main>
  );
}
