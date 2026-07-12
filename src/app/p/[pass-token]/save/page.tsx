import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import {
  formatPassValidity,
  getOfflinePassFilename,
  getOfflinePassPath,
} from "@/lib/pass-display";
import { SavePassActions } from "@/components/save-pass-actions";
import { isValidPassToken } from "@/lib/pass-tokens";
import { getPublicPass } from "@/lib/public-passes";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Save pass",
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
};

export default async function SavePassPage({
  params,
}: {
  params: Promise<{ "pass-token": string }>;
}) {
  const { "pass-token": token } = await params;

  if (!isValidPassToken(token)) {
    notFound();
  }

  if (getSupabaseAdminConfigurationIssues().length > 0) {
    return <SavePassUnavailable />;
  }

  let pass: Awaited<ReturnType<typeof getPublicPass>> = null;

  try {
    pass = await getPublicPass(token);
  } catch (error) {
    console.error("[save-pass] pass lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return <SavePassUnavailable />;
  }

  if (!pass) {
    notFound();
  }

  if (
    pass.status === "refunded" ||
    pass.status === "voided" ||
    pass.status === "expired"
  ) {
    return <SavePassUnavailable />;
  }

  const imagePath = `${getOfflinePassPath(pass.publicToken)}?view=1`;
  const downloadPath = getOfflinePassPath(pass.publicToken);
  const filename = getOfflinePassFilename({
    orderNumber: pass.orderNumber,
    passId: pass.id,
  });

  return (
    <main className="app-grid min-h-screen bg-background pb-10">
      <header className="border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-5 py-4">
          <Brand />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-5 sm:py-8">
        <Link
          href={`/p/${pass.publicToken}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
        >
          <span aria-hidden="true">←</span>
          Back to mobile pass
        </Link>

        <section className="mt-5 rounded-[1.75rem] border border-border bg-card p-5 shadow-2xl shadow-black/20 sm:p-6">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-blue-300">
            Offline backup
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
            Save this pass to your device
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-400">
            This is a backup image of your QR pass. Save it now so it is
            available even if cell service is weak at the gate.
          </p>

          <div className="mt-6 rounded-3xl border border-border bg-background/60 p-3 sm:p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePath}
              alt={`Offline QR pass for ${pass.eventName}`}
              className="mx-auto h-auto w-full max-w-[440px] rounded-2xl"
            />
          </div>

          <SavePassActions
            downloadPath={downloadPath}
            filename={filename}
            imagePath={imagePath}
          />
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <InstructionCard
            title="Save to Photos"
            steps={[
              "Tap Save to photos.",
              "If your phone opens the share sheet, choose Save Image or Save to Photos.",
              "If it opens as an image instead, touch and hold the pass, then save it.",
            ]}
          />
          <InstructionCard
            title="Save to Files"
            steps={[
              "Tap Download file if Save to photos is not available.",
              "Choose where to save it if your phone asks.",
              "Open it from Files at the gate if service is weak.",
            ]}
          />
        </section>

        <section className="mt-4 rounded-3xl border border-border bg-card/80 p-5">
          <dl className="divide-y divide-border">
            <PassDetail label="Ticket" value={pass.ticketName} />
            <PassDetail
              label="Valid"
              value={formatPassValidity(
                pass.validFrom,
                pass.validUntil,
                pass.eventTimeZone,
              )}
            />
            <PassDetail label="Guest" value={pass.buyerName} />
            <PassDetail label="Order" value={pass.orderNumber} mono />
          </dl>
        </section>
      </div>
    </main>
  );
}

function InstructionCard({
  steps,
  title,
}: {
  steps: string[];
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card/80 p-5">
      <h2 className="font-semibold text-white">{title}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-400">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

function PassDetail({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd
        className={`break-words text-right text-sm font-medium text-slate-100 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function SavePassUnavailable() {
  return (
    <main className="app-grid min-h-screen bg-background">
      <header className="border-b border-border bg-background/90">
        <div className="mx-auto w-full max-w-lg px-5 py-4">
          <Brand />
        </div>
      </header>
      <div className="mx-auto w-full max-w-lg px-5 py-10">
        <section className="rounded-3xl border border-amber-300/20 bg-card p-6">
          <p className="text-sm font-medium text-amber-200">Pass unavailable</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
            This pass could not be loaded
          </h1>
          <p className="mt-3 leading-7 text-slate-400">
            Refresh the page in a moment or contact the event organizer if the
            problem continues.
          </p>
        </section>
      </div>
    </main>
  );
}
