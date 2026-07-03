import { Brand } from "@/components/brand";

export type ScannerUnavailableStatus =
  | "expired"
  | "invalid"
  | "permission"
  | "revoked"
  | "service";

export function ScannerUnavailable({
  status,
}: {
  status: ScannerUnavailableStatus;
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
    permission: {
      eyebrow: "Lookup unavailable",
      title: "This link does not include lookup access",
      description:
        "Ask the tournament director for a standard or full gate link to search buyers and orders.",
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
    ScannerUnavailableStatus,
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
