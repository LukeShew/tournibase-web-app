import "server-only";

import Stripe from "stripe";
import {
  assertStripePlatformAccountIdMatches,
  assertStripeKeysMatchAppEnvironment,
  requireExpectedStripePlatformAccountId,
} from "@/lib/app-environment";

let stripeClient: Stripe | null = null;
let stripePlatformIdentityCheck:
  | { accountId: string; promise: Promise<void> }
  | null = null;

export function getStripeConfigurationIssues({
  includeConnectAccountWebhookSecret = false,
  includeConnectedPaymentsWebhookSecret = false,
  includePublishableKey = false,
}: {
  includeConnectAccountWebhookSecret?: boolean;
  includeConnectedPaymentsWebhookSecret?: boolean;
  includePublishableKey?: boolean;
} = {}) {
  const issues: string[] = [];

  if (!process.env.STRIPE_SECRET_KEY) {
    issues.push("STRIPE_SECRET_KEY");
  }

  if (
    includePublishableKey &&
    !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ) {
    issues.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }

  if (
    includeConnectAccountWebhookSecret &&
    !process.env.STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET
  ) {
    issues.push("STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET");
  }

  if (
    includeConnectedPaymentsWebhookSecret &&
    !process.env.STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET
  ) {
    issues.push("STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET");
  }

  return issues;
}

export function getStripePaymentWebhookSecret() {
  return process.env.STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET?.trim() || null;
}

export function getStripe() {
  const issues = getStripeConfigurationIssues();

  if (issues.length > 0) {
    throw new Error(`Missing Stripe configuration: ${issues.join(", ")}.`);
  }

  assertStripeKeysMatchAppEnvironment();

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }

  return stripeClient;
}

export async function getVerifiedStripe() {
  const stripe = getStripe();
  const expectedAccountId = requireExpectedStripePlatformAccountId();

  if (stripePlatformIdentityCheck?.accountId !== expectedAccountId) {
    const promise = stripe.accounts.retrieveCurrent().then((account) => {
      assertStripePlatformAccountIdMatches(account.id);
    });

    stripePlatformIdentityCheck = {
      accountId: expectedAccountId,
      promise,
    };
  }

  try {
    await stripePlatformIdentityCheck.promise;
  } catch (error) {
    stripePlatformIdentityCheck = null;
    throw error;
  }

  return stripe;
}
