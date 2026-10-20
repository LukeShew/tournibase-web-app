import "server-only";

import type Stripe from "stripe";
import { getAppEnvironment } from "@/lib/app-environment";
import { getVerifiedStripe } from "@/lib/stripe";
import { getPlatformFeeConfiguration, getStripeDashboardPaymentUrl } from "@/lib/stripe-connect-payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type StripeConnectStatus =
  | "not_connected"
  | "setup_required"
  | "under_review"
  | "ready"
  | "restricted";

export type OrganizationStripeAccount = {
  account_closed: boolean;
  card_payments_status: string;
  charges_enabled: boolean;
  disabled_reason: string | null;
  fees_collector: string | null;
  losses_collector: string | null;
  dashboard: string | null;
  last_synced_at: string | null;
  onboarding_complete: boolean;
  organization_id: number;
  payouts_enabled: boolean;
  payouts_status: string;
  requirements_currently_due: string[];
  requirements_eventually_due: string[];
  requirements_past_due: string[];
  requirements_pending_verification: string[];
  stripe_account_id: string;
  stripe_environment: "live" | "test";
};

const ACCOUNT_INCLUDES: Stripe.V2.Core.AccountRetrieveParams.Include[] = [
  "configuration.merchant",
  "defaults",
  "future_requirements",
  "identity",
  "requirements",
];

// Only Connect lifecycle requests use this preview. Payment/refund requests
// retain the SDK's stable version and existing webhook contracts.
export const CONNECT_PREVIEW_OPTIONS = { apiVersion: "2026-09-30.preview" };

export function hasDirectorFreeProcessing(
  account: Pick<OrganizationStripeAccount, "fees_collector" | "losses_collector"> | null | undefined,
) {
  return account?.fees_collector === "application" && account.losses_collector === "stripe";
}

/** Call only after authorizing ownership of this account (or its historical order). */
export async function createStripeDirectorDashboardUrl({
  connectedAccountId, environment, paymentIntentId,
}: {
  connectedAccountId: string;
  environment: "live" | "test";
  paymentIntentId?: string;
}) {
  if (environment !== getAppEnvironment()) throw new Error("Stripe environment mismatch.");
  const stripe = await getVerifiedStripe();
  const account = await stripe.v2.core.accounts.retrieve(connectedAccountId, {}, CONNECT_PREVIEW_OPTIONS);
  if (account.id !== connectedAccountId || account.closed || account.livemode !== (environment === "live")) {
    throw new Error("Stripe account is unavailable.");
  }
  if (account.dashboard === "express") {
    // Stripe supplies the single-use URL. Do not invent unsupported payment
    // deep links or log/cache this credential-bearing URL.
    const link = await stripe.accounts.createLoginLink(connectedAccountId);
    return link.url;
  }
  if (account.dashboard !== "full") throw new Error("Stripe dashboard access is unavailable.");
  if (paymentIntentId) return getStripeDashboardPaymentUrl({ connectedAccountId, environment, paymentIntentId });
  return `https://dashboard.stripe.com/${encodeURIComponent(connectedAccountId)}${environment === "test" ? "/test" : ""}/dashboard`;
}

export class StripeConnectFeeConfigurationError extends Error {
  readonly code = "STRIPE_DIRECTOR_FEE_CONFIGURATION_REQUIRED";

  constructor(message?: string, options?: ErrorOptions) {
    super(
      message ??
        "Paid checkout is unavailable while this organization's Stripe payment setup is updated. TourniBase must cover processing fees before director-free checkout can start. Contact TourniBase support.",
      options,
    );
    this.name = "StripeConnectFeeConfigurationError";
  }
}

/** Validate the exact account reserved for a new director-free payment. */
export async function assertStripeAccountCoversProcessing({
  connectedAccountId,
  environment,
}: {
  connectedAccountId: string | null;
  environment: "live" | "test";
}): Promise<void> {
  if (!connectedAccountId?.trim() || environment !== getAppEnvironment()) {
    throw new StripeConnectFeeConfigurationError();
  }

  const stripe = await getVerifiedStripe();
  const account = await stripe.v2.core.accounts.retrieve(connectedAccountId, {
    include: ["defaults"],
  }, CONNECT_PREVIEW_OPTIONS);

  if (
    account.id !== connectedAccountId ||
    (account.livemode ? "live" : "test") !== environment ||
    account.closed === true ||
    account.defaults?.responsibilities?.fees_collector !== "application" ||
    account.defaults?.responsibilities?.losses_collector !== "stripe"
  ) {
    // Responsibilities cannot be changed after Merchant configuration is added.
    // Preserve existing accounts and never fall back to charging the director.
    throw new StripeConnectFeeConfigurationError();
  }
}

export function getStripeConnectConfigurationIssues() {
  return [
    ...(process.env.STRIPE_SECRET_KEY ? [] : ["STRIPE_SECRET_KEY"]),
    ...(process.env.TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID
      ? []
      : ["TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID"]),
    ...(process.env.NEXT_PUBLIC_SITE_URL ? [] : ["NEXT_PUBLIC_SITE_URL"]),
  ];
}

export function getStripeConnectStatus(
  account: OrganizationStripeAccount | null,
): StripeConnectStatus {
  if (!account) {
    return "not_connected";
  }

  if (
    account.onboarding_complete &&
    !account.account_closed &&
    account.charges_enabled &&
    account.payouts_enabled &&
    account.card_payments_status === "active" &&
    account.payouts_status === "active" &&
    account.requirements_currently_due.length === 0 &&
    account.requirements_past_due.length === 0 &&
    !account.disabled_reason
  ) {
    return "ready";
  }

  if (
    account.account_closed ||
    account.disabled_reason ||
    account.card_payments_status === "restricted" ||
    account.card_payments_status === "unsupported" ||
    account.payouts_status === "restricted" ||
    account.payouts_status === "unsupported" ||
    account.requirements_past_due.length > 0
  ) {
    return "restricted";
  }

  if (
    account.card_payments_status === "pending" ||
    account.payouts_status === "pending" ||
    account.requirements_pending_verification.length > 0
  ) {
    return "under_review";
  }

  return "setup_required";
}

export function getStripeConnectStatusLabel(status: StripeConnectStatus) {
  switch (status) {
    case "not_connected":
      return "Not connected";
    case "setup_required":
      return "Setup required";
    case "under_review":
      return "Under review";
    case "ready":
      return "Ready";
    case "restricted":
      return "Restricted";
  }
}

export async function getOrganizationStripeAccount(
  organizationId: number,
): Promise<OrganizationStripeAccount | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("organization_stripe_accounts")
    .select(
      "organization_id, stripe_account_id, stripe_environment, account_closed, onboarding_complete, charges_enabled, payouts_enabled, card_payments_status, payouts_status, requirements_currently_due, requirements_eventually_due, requirements_past_due, requirements_pending_verification, disabled_reason, fees_collector, losses_collector, dashboard, last_synced_at",
    )
    .eq("organization_id", organizationId)
    .eq("stripe_environment", getAppEnvironment())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as OrganizationStripeAccount | null;
}

export async function isOrganizationStripeAccountReady(
  organizationId: number,
) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc(
    "organization_stripe_account_is_ready",
    {
      p_organization_id: organizationId,
      p_stripe_environment: getAppEnvironment(),
    },
  );

  if (error) {
    throw error;
  }

  if (data !== true) {
    return false;
  }

  if (getPlatformFeeConfiguration().policy === "per_ticket_v2") {
    const account = await getOrganizationStripeAccount(organizationId);
    return hasDirectorFreeProcessing(account);
  }

  return true;
}

export async function isOrganizationStripeProcessingSetupRequired(
  organizationId: number,
) {
  if (getPlatformFeeConfiguration().policy !== "per_ticket_v2") {
    return false;
  }

  const account = await getOrganizationStripeAccount(organizationId);
  return account !== null && !hasDirectorFreeProcessing(account);
}

export async function createOrganizationStripeAccount({
  contactEmail,
  displayName,
  organizationId,
}: {
  contactEmail: string;
  displayName: string;
  organizationId: number;
}) {
  const existingAccount = await getOrganizationStripeAccount(organizationId);
  if (existingAccount) {
    return synchronizeOrganizationStripeAccount(existingAccount);
  }

  const directorFree = getPlatformFeeConfiguration().policy === "per_ticket_v2";

  const stripe = await getVerifiedStripe();
  const environment = getAppEnvironment();
  const account = await stripe.v2.core.accounts.create(
    {
      configuration: {
        merchant: {
          capabilities: {
            card_payments: {
              requested: true,
            },
          },
        },
      },
      contact_email: contactEmail,
      dashboard: directorFree ? "express" : "full",
      defaults: {
        currency: "usd",
        profile: {
          doing_business_as: displayName,
          product_description:
            "Digital spectator admission passes for youth basketball tournaments.",
        },
        responsibilities: {
          fees_collector: directorFree ? "application" : "stripe",
          losses_collector: "stripe",
        },
      },
      display_name: displayName,
      identity: {
        country: "us",
      },
      include: ACCOUNT_INCLUDES,
      metadata: {
        operating_environment: environment,
        organization_id: String(organizationId),
        platform: "tournibase",
      },
    },
    {
      idempotencyKey: `tournibase-connect-${environment}-${organizationId}${directorFree ? "-express-v2" : ""}`,
      ...(directorFree ? CONNECT_PREVIEW_OPTIONS : {}),
    },
  );

  return persistStripeAccountState({
    account,
    organizationId,
  });
}

export async function synchronizeOrganizationStripeAccount(
  record: Pick<
    OrganizationStripeAccount,
    "organization_id" | "stripe_account_id"
  >,
) {
  const stripe = await getVerifiedStripe();
  const account = await stripe.v2.core.accounts.retrieve(
    record.stripe_account_id,
    {
      include: ACCOUNT_INCLUDES,
    },
    CONNECT_PREVIEW_OPTIONS,
  );

  return persistStripeAccountState({
    account,
    organizationId: record.organization_id,
  });
}

export async function createStripeConnectOnboardingLink({
  accountId,
  refreshUrl,
  returnUrl,
}: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  const stripe = await getVerifiedStripe();

  return stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      account_onboarding: {
        collection_options: {
          fields: "eventually_due",
          future_requirements: "include",
        },
        configurations: ["merchant"],
        refresh_url: refreshUrl,
        return_url: returnUrl,
      },
      type: "account_onboarding",
    },
  }, CONNECT_PREVIEW_OPTIONS);
}

export async function synchronizeStripeAccountById(accountId: string) {
  const environment = getAppEnvironment();
  const admin = getSupabaseAdmin();
  const { data: record, error } = await admin
    .from("organization_stripe_accounts")
    .select("organization_id, stripe_account_id")
    .eq("stripe_account_id", accountId)
    .eq("stripe_environment", environment)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!record) {
    return null;
  }

  return synchronizeOrganizationStripeAccount({
    organization_id: record.organization_id as number,
    stripe_account_id: record.stripe_account_id as string,
  });
}

async function persistStripeAccountState({
  account,
  organizationId,
}: {
  account: Stripe.V2.Core.Account;
  organizationId: number;
}) {
  const snapshot = mapStripeAccountState(account, organizationId);
  const environment = getAppEnvironment();
  const admin = getSupabaseAdmin();

  if (snapshot.stripe_environment !== environment) {
    throw new Error(
      `Stripe account ${account.id} is in ${snapshot.stripe_environment} mode, not the ${environment} TourniBase environment.`,
    );
  }

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .eq("operating_environment", environment)
    .maybeSingle();

  if (organizationError) {
    throw organizationError;
  }

  if (!organization) {
    throw new Error(
      "Stripe account does not belong to an organization in this TourniBase environment.",
    );
  }

  const { data, error } = await admin
    .from("organization_stripe_accounts")
    .upsert(snapshot, {
      onConflict: "organization_id,stripe_environment",
    })
    .select(
      "organization_id, stripe_account_id, stripe_environment, account_closed, onboarding_complete, charges_enabled, payouts_enabled, card_payments_status, payouts_status, requirements_currently_due, requirements_eventually_due, requirements_past_due, requirements_pending_verification, disabled_reason, fees_collector, losses_collector, dashboard, last_synced_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return data as OrganizationStripeAccount;
}

export function mapStripeAccountState(
  account: Stripe.V2.Core.Account,
  organizationId: number,
): OrganizationStripeAccount {
  const cardCapability =
    account.configuration?.merchant?.capabilities?.card_payments;
  const payoutCapability =
    account.configuration?.merchant?.capabilities?.stripe_balance?.payouts;
  const requirements = account.requirements?.entries ?? [];
  const futureRequirements = account.future_requirements?.entries ?? [];
  const currentlyDue = requirements
    .filter(
      (entry) =>
        entry.awaiting_action_from === "user" &&
        entry.minimum_deadline.status === "currently_due",
    )
    .map(getRequirementLabel);
  const eventuallyDue = requirements
    .filter(
      (entry) =>
        entry.awaiting_action_from === "user" &&
        entry.minimum_deadline.status === "eventually_due",
    )
    .map(getRequirementLabel)
    .concat(
      futureRequirements
        .filter((entry) => entry.awaiting_action_from === "user")
        .map(getRequirementLabel),
    );
  const pastDue = requirements
    .filter((entry) => entry.minimum_deadline.status === "past_due")
    .map(getRequirementLabel);
  const pendingVerification = requirements
    .filter((entry) => entry.awaiting_action_from === "stripe")
    .map(getRequirementLabel)
    .concat(
      futureRequirements
        .filter((entry) => entry.awaiting_action_from === "stripe")
        .map(getRequirementLabel),
    );
  const restrictedCapability =
    cardCapability?.status === "restricted" ||
    cardCapability?.status === "unsupported"
      ? cardCapability
      : payoutCapability?.status === "restricted" ||
          payoutCapability?.status === "unsupported"
        ? payoutCapability
        : null;
  const disabledReason =
    (account.closed ? "account_closed" : null) ??
    restrictedCapability?.status_details[0]?.code ??
    (pastDue.length > 0 ? "requirements_past_due" : null);

  return {
    account_closed: account.closed === true,
    card_payments_status: cardCapability?.status ?? "inactive",
    charges_enabled:
      account.closed !== true && cardCapability?.status === "active",
    disabled_reason: disabledReason,
    fees_collector: account.defaults?.responsibilities?.fees_collector ?? null,
    losses_collector: account.defaults?.responsibilities?.losses_collector ?? null,
    dashboard: account.dashboard ?? null,
    last_synced_at: new Date().toISOString(),
    onboarding_complete:
      account.closed !== true &&
      account.applied_configurations.includes("merchant") &&
      currentlyDue.length === 0 &&
      pastDue.length === 0,
    organization_id: organizationId,
    payouts_enabled:
      account.closed !== true && payoutCapability?.status === "active",
    payouts_status: payoutCapability?.status ?? "inactive",
    requirements_currently_due: currentlyDue,
    requirements_eventually_due: eventuallyDue,
    requirements_past_due: pastDue,
    requirements_pending_verification: pendingVerification,
    stripe_account_id: account.id,
    stripe_environment: account.livemode ? "live" : "test",
  };
}

function getRequirementLabel(
  requirement:
    | Stripe.V2.Core.Account.FutureRequirements.Entry
    | Stripe.V2.Core.Account.Requirements.Entry,
) {
  const reference = requirement.reference;

  return reference?.resource
    ? `${requirement.description} (${reference.resource})`
    : requirement.description;
}
