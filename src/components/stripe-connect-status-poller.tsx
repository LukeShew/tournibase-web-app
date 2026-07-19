"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 24;

export function StripeConnectStatusPoller({
  organizationId,
}: {
  organizationId: number;
}) {
  const router = useRouter();

  useEffect(() => {
    let attempt = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function finish() {
      const url = new URL(window.location.href);
      url.searchParams.delete("organization");
      url.searchParams.delete("payments");
      window.location.replace(`${url.pathname}${url.search}${url.hash}`);
    }

    async function poll() {
      attempt += 1;

      try {
        const response = await fetch("/api/stripe/connect/status", {
          body: JSON.stringify({ organizationId }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Stripe status could not be refreshed.");
        }

        const result = (await response.json()) as { status?: string };

        if (cancelled) {
          return;
        }

        if (result.status === "ready" || attempt >= MAX_POLL_ATTEMPTS) {
          finish();
          return;
        }

        router.refresh();
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (cancelled) {
          return;
        }

        if (attempt >= MAX_POLL_ATTEMPTS) {
          finish();
          return;
        }

        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    timer = setTimeout(poll, 1_500);

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [organizationId, router]);

  return (
    <p className="mt-3 text-sm font-medium text-blue-700" role="status">
      Stripe is finalizing payment and payout access. This page will update
      automatically.
    </p>
  );
}
