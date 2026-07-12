import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { getOrderConfirmation } from "@/lib/orders";
import { getOfflinePassSavePath } from "@/lib/pass-display";
import { getStripeConfigurationIssues } from "@/lib/stripe";
import { getSupabaseAdminConfigurationIssues } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Order confirmed",
};

export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const configurationIssues = [
    ...getStripeConfigurationIssues(),
    ...getSupabaseAdminConfigurationIssues(),
  ];

  if (configurationIssues.length > 0) {
    return (
      <OrderPageShell>
        <StatusPanel
          eyebrow="Checkout setup"
          title="Payment confirmation is not configured"
          description={`Missing server variables: ${configurationIssues.join(", ")}.`}
          tone="warning"
        />
      </OrderPageShell>
    );
  }

  if (!sessionId || !/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return (
      <OrderPageShell>
        <StatusPanel
          eyebrow="Order lookup"
          title="We could not find this checkout"
          description="Open the confirmation link provided after completing Stripe Checkout."
          tone="warning"
        />
      </OrderPageShell>
    );
  }

  let result: Awaited<ReturnType<typeof getOrderConfirmation>> | null = null;

  try {
    result = await getOrderConfirmation(sessionId);
  } catch (error) {
    console.error("[order-success] confirmation lookup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  if (!result) {
    return (
      <OrderPageShell>
        <StatusPanel
          eyebrow="Order confirmation"
          title="We could not load your passes"
          description="Your payment may still be processing. Refresh this page or contact the event organizer if the problem continues."
          tone="warning"
        />
      </OrderPageShell>
    );
  }

  if (result.status === "processing") {
    return (
      <OrderPageShell>
        <StatusPanel
          eyebrow="Payment processing"
          title="Your payment is still being confirmed"
          description="Refresh this page in a moment. Your passes will appear after Stripe confirms payment."
          tone="neutral"
        />
      </OrderPageShell>
    );
  }

  const { confirmation } = result;

  return (
    <OrderPageShell>
      <section className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-6 sm:p-8">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-400/15 text-xl text-emerald-300">
          ✓
        </div>
        <p className="mt-6 text-sm font-medium text-emerald-300">
          Payment confirmed
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
          Your passes are ready
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-300">
          {confirmation.buyerName}, your order for {confirmation.eventName} has
          been paid and uniquely issued.
        </p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <OrderDetail label="Order" value={confirmation.orderNumber} mono />
          <OrderDetail
            label="Amount paid"
            value={formatCurrency(confirmation.amountTotal)}
            mono
          />
          <OrderDetail
            label="Passes"
            value={confirmation.passes.length.toString()}
            mono
          />
        </dl>
      </section>

      <section className="mt-6">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Individual pass links
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Each guest receives a unique mobile pass and QR code for entry.
            Save each pass before arriving if service at the venue may be weak.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {confirmation.passes.map((pass, index) => (
            <article
              key={pass.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-white">
                    {pass.ticketName} · Pass {index + 1}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-emerald-300">
                    {pass.status}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/p/${pass.publicToken}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
                  >
                    Open mobile pass
                  </Link>
                  <Link
                    href={getOfflinePassSavePath(pass.publicToken)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 text-sm font-semibold text-blue-200 transition hover:bg-blue-400/15"
                  >
                    Save to photos
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </OrderPageShell>
  );
}

function OrderPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-grid min-h-screen bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-4xl px-5 py-5 sm:px-6">
          <Brand />
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
        {children}
      </div>
    </main>
  );
}

function StatusPanel({
  description,
  eyebrow,
  title,
  tone,
}: {
  description: string;
  eyebrow: string;
  title: string;
  tone: "neutral" | "warning";
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <p
        className={`text-sm font-medium ${
          tone === "warning" ? "text-amber-300" : "text-blue-300"
        }`}
      >
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-400">{description}</p>
    </section>
  );
}

function OrderDetail({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-2 text-sm font-semibold text-white ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}
