import type Stripe from "stripe";
import {
  assertStripeKeysMatchAppEnvironment,
  getAppEnvironment,
  getStripeEnvironmentFromKey,
} from "./app-environment";

export type StripeEnvironment = "live" | "test";

export type StripePaymentRouting = {
  connectedAccountId: string | null;
  environment: StripeEnvironment;
};

export type PlatformFeeConfiguration = {
  basisPoints: number;
  fixedCents: number;
  /** Unset preserves historical, once-per-order percentage pricing. */
  policy?: "per_ticket_v2";
  percentageThresholdCents?: number;
};

export const TIERED_PLATFORM_FEE_CONFIGURATION: PlatformFeeConfiguration = {
  policy: "per_ticket_v2",
  basisPoints: 400,
  fixedCents: 100,
  percentageThresholdCents: 1000,
};

export type PlatformFeeOrderItem = {
  quantity: number;
  unit_amount_cents: number;
};

const MAX_BASIS_POINTS = 10_000;
const MAX_FIXED_FEE_CENTS = 100_000_000;

export function getStripeEnvironment(
  secretKey = process.env.STRIPE_SECRET_KEY,
): StripeEnvironment {
  if (secretKey === process.env.STRIPE_SECRET_KEY) {
    assertStripeKeysMatchAppEnvironment();
  }

  if (!secretKey) {
    return getAppEnvironment();
  }

  const environment = getStripeEnvironmentFromKey(secretKey);

  if (!environment) {
    throw new Error("STRIPE_SECRET_KEY does not have a supported Stripe key prefix.");
  }

  return environment;
}

export function isCurrentStripeEnvironment(
  environment: StripeEnvironment,
  secretKey = process.env.STRIPE_SECRET_KEY,
) {
  return environment === getStripeEnvironment(secretKey);
}

export function assertStripeEventMatchesAppEnvironment(
  livemode: boolean,
  secretKey = process.env.STRIPE_SECRET_KEY,
): StripeEnvironment {
  const eventEnvironment: StripeEnvironment = livemode ? "live" : "test";

  if (!isCurrentStripeEnvironment(eventEnvironment, secretKey)) {
    throw new Error(
      `Stripe ${eventEnvironment} event was delivered to the ${getStripeEnvironment(secretKey)} TourniBase environment.`,
    );
  }

  return eventEnvironment;
}

export function getApplicationFeeRefundTargetCents({
  applicationFeeCents,
  chargeAmountCents,
  chargeAmountRefundedCents,
}: {
  applicationFeeCents: number;
  chargeAmountCents: number;
  chargeAmountRefundedCents: number;
}) {
  for (const [label, value] of [
    ["Application fee", applicationFeeCents],
    ["Charge amount", chargeAmountCents],
    ["Refunded charge amount", chargeAmountRefundedCents],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} must be a nonnegative whole number of cents.`);
    }
  }

  if (chargeAmountCents === 0 || applicationFeeCents === 0) {
    return 0;
  }

  if (chargeAmountRefundedCents > chargeAmountCents) {
    throw new Error("Refunded charge amount cannot exceed the charge amount.");
  }

  if (chargeAmountRefundedCents === chargeAmountCents) {
    return applicationFeeCents;
  }

  return Math.round(
    (applicationFeeCents * chargeAmountRefundedCents) / chargeAmountCents,
  );
}

export function isPaidStripeRefundAmountCents(amountCents: number) {
  return Number.isSafeInteger(amountCents) && amountCents > 0;
}

export function getPlatformFeeConfiguration(
  environment: Record<string, string | undefined> = process.env,
): PlatformFeeConfiguration {
  const policy = environment.TOURNIBASE_PLATFORM_FEE_POLICY?.trim();
  if (policy && policy !== "per_ticket_v2") {
    throw new Error("TOURNIBASE_PLATFORM_FEE_POLICY must be per_ticket_v2 when configured.");
  }
  return {
    ...(policy === "per_ticket_v2" ? {
      policy,
      percentageThresholdCents: 1000,
    } as const : {}),
    basisPoints: parseNonnegativeInteger(
      environment.TOURNIBASE_PLATFORM_FEE_BPS,
      "TOURNIBASE_PLATFORM_FEE_BPS",
      MAX_BASIS_POINTS,
    ),
    fixedCents: parseNonnegativeInteger(
      environment.TOURNIBASE_PLATFORM_FEE_FIXED_CENTS,
      "TOURNIBASE_PLATFORM_FEE_FIXED_CENTS",
      MAX_FIXED_FEE_CENTS,
    ),
  };
}

export function calculatePlatformFeeCents(
  amountTotalCents: number,
  configuration: PlatformFeeConfiguration,
) {
  if (!Number.isSafeInteger(amountTotalCents) || amountTotalCents < 0) {
    throw new Error("Order total must be a nonnegative whole number of cents.");
  }

  if (
    !Number.isSafeInteger(configuration.basisPoints) ||
    configuration.basisPoints < 0 ||
    configuration.basisPoints > MAX_BASIS_POINTS
  ) {
    throw new Error("TourniBase fee basis points must be between 0 and 10000.");
  }

  if (
    !Number.isSafeInteger(configuration.fixedCents) ||
    configuration.fixedCents < 0 || configuration.fixedCents > MAX_FIXED_FEE_CENTS
  ) {
    throw new Error("TourniBase fixed fee must be a nonnegative whole number of cents.");
  }

  if (configuration.policy !== undefined && configuration.policy !== "per_ticket_v2") {
    throw new Error("The TourniBase fee policy is not supported.");
  }
  const threshold = configuration.percentageThresholdCents ?? 1000;
  if (configuration.policy === "per_ticket_v2" &&
      (!Number.isSafeInteger(threshold) || threshold < 0)) {
    throw new Error("The fee threshold must be a nonnegative whole number of cents.");
  }

  if (amountTotalCents === 0) {
    return 0;
  }

  // Round the percentage on each paid ticket before multiplying quantities.
  // BigInt avoids floating-point drift and matches PostgreSQL numeric rounding.
  const percentageApplies = configuration.policy !== "per_ticket_v2" || amountTotalCents > threshold;
  const percentageCents = percentageApplies
    ? (BigInt(amountTotalCents) * BigInt(configuration.basisPoints) + BigInt(5000)) / BigInt(MAX_BASIS_POINTS)
    : BigInt(0);
  const feeCents = Number(percentageCents + BigInt(configuration.fixedCents));

  if (!Number.isSafeInteger(feeCents) || feeCents < 0) {
    throw new Error("The calculated TourniBase fee is not valid.");
  }

  return feeCents;
}

/** Quote the actual cart; a tier is selected by each ticket's base price. */
export function calculateOrderPlatformFeeCents(
  items: readonly PlatformFeeOrderItem[],
  configuration: PlatformFeeConfiguration,
) {
  let subtotal = BigInt(0);
  let fee = BigInt(0);
  // Validate configuration even for an empty cart.
  calculatePlatformFeeCents(0, configuration);
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 0 ||
        !Number.isSafeInteger(item.unit_amount_cents) || item.unit_amount_cents < 0) {
      throw new Error("Ticket prices and quantities must be nonnegative whole numbers.");
    }
    subtotal += BigInt(item.unit_amount_cents) * BigInt(item.quantity);
    if (configuration.policy === "per_ticket_v2") {
      fee += BigInt(calculatePlatformFeeCents(item.unit_amount_cents, configuration)) * BigInt(item.quantity);
    }
  }
  if (subtotal > BigInt(Number.MAX_SAFE_INTEGER) || fee > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("The order total or TourniBase fee exceeds the supported amount.");
  }
  return configuration.policy === "per_ticket_v2"
    ? Number(fee)
    : calculatePlatformFeeCents(Number(subtotal), configuration);
}

export function getStripeRequestOptions(
  routing: StripePaymentRouting,
  idempotencyKey?: string,
): Stripe.RequestOptions {
  return {
    ...(routing.connectedAccountId
      ? { stripeAccount: routing.connectedAccountId }
      : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

export function assertStripeRoutingMatches({
  actualEnvironment,
  eventConnectedAccountId,
  routing,
}: {
  actualEnvironment?: StripeEnvironment;
  eventConnectedAccountId?: string | null;
  routing: StripePaymentRouting;
}) {
  if (
    eventConnectedAccountId !== undefined &&
    eventConnectedAccountId !== routing.connectedAccountId
  ) {
    throw new Error("Stripe event account does not match the TourniBase order.");
  }

  if (
    actualEnvironment !== undefined &&
    actualEnvironment !== routing.environment
  ) {
    throw new Error("Stripe event mode does not match the TourniBase order.");
  }
}

export function getStripeDashboardPaymentUrl({
  connectedAccountId,
  environment,
  paymentIntentId,
}: {
  connectedAccountId: string;
  environment: StripeEnvironment;
  paymentIntentId: string;
}) {
  const modePath = environment === "test" ? "/test" : "";

  // Full-dashboard directors sign in with their own Stripe credentials. The
  // account precedes /test; platform Connect-admin URLs are not director links.
  return `https://dashboard.stripe.com/${encodeURIComponent(
    connectedAccountId,
  )}${modePath}/payments/${encodeURIComponent(paymentIntentId)}`;
}

function parseNonnegativeInteger(
  rawValue: string | undefined,
  variableName: string,
  maximum: number,
) {
  if (rawValue === undefined || rawValue.trim() === "") {
    return 0;
  }

  if (!/^\d+$/.test(rawValue.trim())) {
    throw new Error(`${variableName} must be a nonnegative whole number.`);
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`${variableName} is outside the supported range.`);
  }

  return value;
}
