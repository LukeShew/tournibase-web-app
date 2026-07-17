import type Stripe from "stripe";

export type StripeEnvironment = "live" | "test";

export type StripePaymentRouting = {
  connectedAccountId: string | null;
  environment: StripeEnvironment;
};

export type PlatformFeeConfiguration = {
  basisPoints: number;
  fixedCents: number;
};

const MAX_BASIS_POINTS = 10_000;
const MAX_FIXED_FEE_CENTS = 100_000_000;

export function getStripeEnvironment(
  secretKey = process.env.STRIPE_SECRET_KEY,
): StripeEnvironment {
  return secretKey?.startsWith("sk_live_") ? "live" : "test";
}

export function isCurrentStripeEnvironment(
  environment: StripeEnvironment,
  secretKey = process.env.STRIPE_SECRET_KEY,
) {
  return environment === getStripeEnvironment(secretKey);
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
  return {
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
    configuration.fixedCents < 0
  ) {
    throw new Error("TourniBase fixed fee must be a nonnegative whole number of cents.");
  }

  if (amountTotalCents === 0) {
    return 0;
  }

  const feeCents =
    Math.round(
      (amountTotalCents * configuration.basisPoints) / MAX_BASIS_POINTS,
    ) + configuration.fixedCents;

  if (!Number.isSafeInteger(feeCents) || feeCents < 0) {
    throw new Error("The calculated TourniBase fee is not valid.");
  }

  if (feeCents >= amountTotalCents) {
    throw new Error("The TourniBase fee must be less than the order total.");
  }

  return feeCents;
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

  return `https://dashboard.stripe.com${modePath}/${encodeURIComponent(
    connectedAccountId,
  )}/payments/${encodeURIComponent(paymentIntentId)}`;
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
