import type { Metadata } from "next";
import Link from "next/link";
import { ProfileAvatarPicker } from "@/components/profile-avatar-picker";
import { requireDirector } from "@/lib/auth";
import {
  getStripeConnectConfigurationIssues,
  getStripeConnectStatus,
  getStripeConnectStatusLabel,
  type OrganizationStripeAccount,
  type StripeConnectStatus,
} from "@/lib/stripe-connect";
import { getStripeEnvironment } from "@/lib/stripe-connect-payments";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; payments?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const director = await requireDirector();
  const supabase = await createClient();
  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("owner_user_id", director.id)
    .order("created_at", { ascending: true });

  if (organizationError) {
    throw organizationError;
  }

  const organizations = (organizationRows ?? []) as Array<{
    id: number;
    name: string;
  }>;
  const organizationIds = organizations.map(
    (organization) => organization.id,
  );
  const environment = getStripeEnvironment();
  const { data: stripeAccountRows, error: stripeAccountError } =
    organizationIds.length > 0
      ? await supabase
          .from("organization_stripe_accounts")
          .select(
            "organization_id, stripe_account_id, stripe_environment, account_closed, onboarding_complete, charges_enabled, payouts_enabled, card_payments_status, payouts_status, requirements_currently_due, requirements_eventually_due, requirements_past_due, requirements_pending_verification, disabled_reason, last_synced_at",
          )
          .in("organization_id", organizationIds)
          .eq("stripe_environment", environment)
      : { data: [], error: null };

  if (stripeAccountError) {
    throw stripeAccountError;
  }

  const stripeAccounts = new Map(
    ((stripeAccountRows ?? []) as OrganizationStripeAccount[]).map(
      (account) => [account.organization_id, account],
    ),
  );
  const selectedEvent =
    resolvedSearchParams.event &&
    /^\d+$/.test(resolvedSearchParams.event)
      ? resolvedSearchParams.event
      : null;
  const configurationReady =
    getStripeConnectConfigurationIssues().length === 0;

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <p className="text-sm font-semibold text-blue-700">Director settings</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
        Settings
      </h1>
      <p className="mt-3 max-w-2xl text-slate-500">
        Account and support details for your TourniBase director workspace.
      </p>

      <section className="mt-8 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-card-strong px-6 py-5">
          <h2 className="font-semibold text-slate-950">Account</h2>
          <p className="mt-1 text-sm text-slate-500">
            This is the director account currently signed in.
          </p>
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-2">
          <SettingsItem label="Name" value={director.name} />
          <SettingsItem label="Email" value={director.email} />
        </dl>
      </section>

      <ProfileAvatarPicker initialAvatarId={director.avatarId} />

      <section
        id="payments"
        className="mt-6 scroll-mt-6 overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm"
      >
        <div className="border-b border-border bg-card-strong px-6 py-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-semibold text-slate-950">Payments</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Connect Stripe so paid admission orders go directly to the
                tournament organization. Stripe handles processing fees and
                bank payouts.
              </p>
            </div>
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              {environment === "test" ? "Stripe Sandbox" : "Stripe live"}
            </span>
          </div>
        </div>

        {resolvedSearchParams.payments ? (
          <PaymentNotice result={resolvedSearchParams.payments} />
        ) : null}

        {organizations.length > 0 ? (
          <div className="divide-y divide-border">
            {organizations.map((organization) => (
              <OrganizationPayments
                key={organization.id}
                account={stripeAccounts.get(organization.id) ?? null}
                configurationReady={configurationReady}
                organization={organization}
                selectedEvent={selectedEvent}
              />
            ))}
          </div>
        ) : (
          <div className="px-6 py-8">
            <p className="text-sm text-slate-500">
              Create an organization before connecting a Stripe account.
            </p>
          </div>
        )}

        <div className="border-t border-border bg-slate-50 px-6 py-5">
          <p className="text-sm leading-6 text-slate-600">
            The tournament organization is the seller for its admission
            orders. TourniBase’s pilot application fee is currently $0.
            Sandbox and live Stripe accounts are separate, so onboarding must
            be completed again before accepting live payments.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold text-slate-950">Support</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use the support page for refund policy questions, event setup issues,
          or problems with passes and scanner access.
        </p>
        <Link
          href="/support"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          Open support
        </Link>
      </section>
    </div>
  );
}

function OrganizationPayments({
  account,
  configurationReady,
  organization,
  selectedEvent,
}: {
  account: OrganizationStripeAccount | null;
  configurationReady: boolean;
  organization: { id: number; name: string };
  selectedEvent: string | null;
}) {
  const status = getStripeConnectStatus(account);
  const action =
    status === "not_connected"
      ? {
          href: "/api/stripe/connect/start",
          label: "Connect Stripe",
        }
      : status === "ready"
        ? {
            href: "/api/stripe/connect/dashboard",
            label: "Open Stripe Dashboard",
          }
        : status === "under_review"
          ? null
          : {
              href: "/api/stripe/connect/start",
              label:
                status === "restricted"
                  ? "Resolve in Stripe"
                  : "Continue setup",
            };

  return (
    <div className="px-6 py-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div>
          <p className="font-semibold text-slate-950">{organization.name}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PaymentStatusBadge status={status} />
            <p className="text-sm text-slate-500">
              {getPaymentStatusDescription(status)}
            </p>
          </div>
          {account ? (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span>
                Card payments: {formatCapabilityStatus(account.card_payments_status)}
              </span>
              <span>
                Payouts: {formatCapabilityStatus(account.payouts_status)}
              </span>
              {account.last_synced_at ? (
                <span>
                  Synced{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(account.last_synced_at))}
                </span>
              ) : null}
            </div>
          ) : null}
          {account &&
          (account.requirements_currently_due.length > 0 ||
            account.requirements_past_due.length > 0) ? (
            <p className="mt-3 text-sm font-medium text-amber-700">
              Stripe needs more information before paid checkout can be used.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {action ? (
            <ConnectForm
              action={action.href}
              disabled={!configurationReady}
              label={action.label}
              organizationId={organization.id}
              primary
              selectedEvent={selectedEvent}
            />
          ) : null}
          {account ? (
            <ConnectForm
              action="/api/stripe/connect/refresh"
              disabled={!configurationReady}
              label="Refresh status"
              organizationId={organization.id}
              selectedEvent={selectedEvent}
            />
          ) : null}
        </div>
      </div>

      {!configurationReady ? (
        <p className="mt-4 text-sm font-medium text-red-700">
          Stripe Connect server settings are incomplete. Finish the server
          configuration before connecting an account.
        </p>
      ) : null}
    </div>
  );
}

function ConnectForm({
  action,
  disabled,
  label,
  organizationId,
  primary = false,
  selectedEvent,
}: {
  action: string;
  disabled: boolean;
  label: string;
  organizationId: number;
  primary?: boolean;
  selectedEvent: string | null;
}) {
  return (
    <form action={action} method="post">
      <input type="hidden" name="organizationId" value={organizationId} />
      {selectedEvent ? (
        <input type="hidden" name="event" value={selectedEvent} />
      ) : null}
      <button
        type="submit"
        disabled={disabled}
        className={`inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
          primary
            ? "bg-brand-strong text-white hover:bg-blue-500"
            : "border border-border bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function PaymentStatusBadge({ status }: { status: StripeConnectStatus }) {
  const className =
    status === "ready"
      ? "bg-emerald-100 text-emerald-800"
      : status === "restricted"
        ? "bg-red-100 text-red-800"
        : status === "under_review"
          ? "bg-blue-100 text-blue-800"
          : status === "setup_required"
            ? "bg-amber-100 text-amber-800"
            : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {getStripeConnectStatusLabel(status)}
    </span>
  );
}

function formatCapabilityStatus(status: string) {
  return status.replaceAll("_", " ");
}

function getPaymentStatusDescription(status: StripeConnectStatus) {
  switch (status) {
    case "not_connected":
      return "Connect an account before publishing paid events.";
    case "setup_required":
      return "Finish Stripe’s hosted setup to accept paid orders.";
    case "under_review":
      return "Stripe is reviewing submitted account information.";
    case "ready":
      return "Paid orders can be accepted and paid out by Stripe.";
    case "restricted":
      return "Paid checkout is paused until the Stripe restriction is resolved.";
  }
}

function PaymentNotice({ result }: { result: string }) {
  const successful =
    result === "onboarding_returned" || result === "synchronized";
  const text =
    result === "onboarding_returned"
      ? "Stripe setup was saved. Review the status below; Stripe may still be verifying some information."
      : result === "synchronized"
        ? "Stripe status refreshed."
        : result === "not_connected"
          ? "No Stripe account is connected yet."
          : result === "configuration_error"
            ? "Stripe Connect server settings are incomplete."
            : "Stripe account setup could not be updated. Try again or contact support.";

  return (
    <div
      role="status"
      className={`border-b px-6 py-4 text-sm ${
        successful
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {text}
    </div>
  );
}

function SettingsItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-6 py-5">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
