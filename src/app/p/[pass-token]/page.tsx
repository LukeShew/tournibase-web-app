import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Brand } from "@/components/brand";
import {
  formatPassValidity,
  getOfflinePassSavePath,
} from "@/lib/pass-display";
import { isValidPassToken } from "@/lib/pass-tokens";
import { getPublicPass, type PublicPass } from "@/lib/public-passes";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Mobile pass",
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
};

type PassState = {
  description: string;
  label: string;
  tone: "blue" | "green" | "amber" | "red";
};

const statusStyles = {
  amber: "border-amber-300/25 bg-amber-300/[0.08] text-amber-200",
  blue: "border-blue-300/25 bg-blue-300/[0.08] text-blue-200",
  green: "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200",
  red: "border-red-300/25 bg-red-300/[0.08] text-red-200",
} satisfies Record<PassState["tone"], string>;

export default async function PassPage({
  params,
}: {
  params: Promise<{ "pass-token": string }>;
}) {
  const { "pass-token": token } = await params;

  if (!isValidPassToken(token)) {
    notFound();
  }

  if (getSupabaseAdminConfigurationIssues().length > 0) {
    return <PassUnavailable />;
  }

  let pass: PublicPass | null = null;

  try {
    pass = await getPublicPass(token);
  } catch (error) {
    console.error("[public-pass] pass lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return <PassUnavailable />;
  }

  if (!pass) {
    notFound();
  }

  const qrCodeDataUrl = await QRCode.toDataURL(pass.publicToken, {
    color: {
      dark: "#07101D",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
    margin: 2,
    width: 320,
  });
  const passState = getPassState(pass);
  const canSaveOffline =
    pass.status !== "refunded" &&
    pass.status !== "voided" &&
    pass.status !== "expired";

  return (
    <main className="app-grid min-h-screen bg-background pb-10">
      <header className="border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-lg px-5 py-4">
          <Brand />
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-5 sm:py-8">
        <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-2xl shadow-black/20">
          <div className="border-b border-border p-5 sm:p-6">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${statusStyles[passState.tone]}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {passState.label}
            </div>
            <p className="mt-5 text-sm font-medium text-blue-300">
              Mobile admission pass
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
              {pass.eventName}
            </h1>
            <p className="mt-2 text-base text-slate-300">{pass.ticketName}</p>
          </div>

          <div className="p-5 sm:p-6">
            <div className="relative mx-auto max-w-[352px] rounded-3xl bg-white p-4 shadow-lg shadow-black/25">
              <Image
                src={qrCodeDataUrl}
                alt="Secure QR code for this admission pass"
                width={320}
                height={320}
                className="h-auto w-full"
                priority
                unoptimized
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 grid h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-white p-1 shadow-sm"
              >
                <Image
                  src="/tournibase-app-icon.svg"
                  alt=""
                  width={64}
                  height={64}
                  className="h-full w-full"
                />
              </div>
            </div>
            <div className="mt-5 text-center">
              <p className="font-semibold text-white">
                Present this code at the gate
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Turn up your screen brightness before the pass is scanned.
              </p>
            </div>

            {canSaveOffline ? (
              <>
                <a
                  href={getOfflinePassSavePath(pass.publicToken)}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong"
                >
                  Save for weak service
                </a>
                <p className="mt-2 text-center text-xs leading-5 text-slate-500">
                  Opens a simple save page with Photos and Files options.
                </p>
              </>
            ) : null}

            <div
              className={`mt-6 rounded-2xl border p-4 ${statusStyles[passState.tone]}`}
            >
              <p className="font-semibold">{passState.label}</p>
              <p className="mt-1 text-sm leading-6 opacity-85">
                {passState.description}
              </p>
            </div>

            <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-black/10 px-4">
              <PassDetail label="Ticket type" value={pass.ticketName} />
              <PassDetail
                label="Valid date"
                value={formatValidity(
                  pass.validFrom,
                  pass.validUntil,
                  pass.eventTimeZone,
                )}
              />
              <PassDetail label="Guest" value={pass.buyerName} />
              <PassDetail label="Order" value={pass.orderNumber} mono />
              <PassDetail label="Venue" value={pass.venueName} />
              <PassDetail label="Address" value={pass.venueAddress} />
            </dl>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-border bg-card/80 p-5">
          <h2 className="font-semibold text-white">Pass protection</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Every pass is uniquely issued, server-validated, and blocked from
            being used twice.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            The QR code contains a secure validation token, not buyer or
            ticket details.
          </p>
        </section>

        <section className="mt-4 rounded-3xl border border-border bg-card/80 p-5">
          <h2 className="font-semibold text-white">Need help?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Contact {pass.organizerName} if you have a question about this pass.
          </p>
          <a
            href={`mailto:${pass.contactEmail}`}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 text-sm font-semibold text-blue-200 transition hover:bg-blue-400/15"
          >
            {pass.contactEmail}
          </a>
        </section>
      </div>
    </main>
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
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-4">
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

function PassUnavailable() {
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

function getPassState(pass: PublicPass): PassState {
  if (pass.status === "checked_in") {
    return {
      description: "This pass has already been used for entry.",
      label: "Already used",
      tone: "amber",
    };
  }

  if (pass.status === "refunded") {
    return {
      description: "This pass was refunded and is no longer valid for entry.",
      label: "Refunded",
      tone: "red",
    };
  }

  if (pass.status === "voided") {
    return {
      description: "This pass was voided and is no longer valid for entry.",
      label: "Voided",
      tone: "red",
    };
  }

  if (pass.status === "expired") {
    return {
      description: "This pass is outside its valid admission period.",
      label: "Expired",
      tone: "red",
    };
  }

  const now = Date.now();
  const validFrom = new Date(pass.validFrom).getTime();
  const validUntil = new Date(pass.validUntil).getTime();

  if (now < validFrom) {
    return {
      description: `This pass becomes active ${formatValidity(
        pass.validFrom,
        pass.validUntil,
        pass.eventTimeZone,
      )}.`,
      label: "Upcoming",
      tone: "blue",
    };
  }

  if (now > validUntil) {
    return {
      description: "This pass is outside its valid admission period.",
      label: "Expired",
      tone: "red",
    };
  }

  return {
    description: "This pass is active and ready to be scanned for entry.",
    label: "Active",
    tone: "green",
  };
}

function formatValidity(
  validFrom: string,
  validUntil: string,
  timeZone: string,
) {
  return formatPassValidity(validFrom, validUntil, timeZone);
}
