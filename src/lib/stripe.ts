import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeConfigurationIssues({
  includePublishableKey = false,
  includeWebhookSecret = false,
}: {
  includePublishableKey?: boolean;
  includeWebhookSecret?: boolean;
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

  if (includeWebhookSecret && !process.env.STRIPE_WEBHOOK_SECRET) {
    issues.push("STRIPE_WEBHOOK_SECRET");
  }

  return issues;
}

export function getStripe() {
  const issues = getStripeConfigurationIssues();

  if (issues.length > 0) {
    throw new Error(`Missing Stripe configuration: ${issues.join(", ")}.`);
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }

  return stripeClient;
}
