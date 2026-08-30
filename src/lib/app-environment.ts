export type AppEnvironment = "live" | "test";

type EnvironmentVariables = Record<string, string | undefined>;

export const TEST_EMAIL_RECIPIENT = "lsautomates@gmail.com";
export const LIVE_SITE_URL = "https://tournibase.com";
export const TEST_SITE_URL = "https://staging.tournibase.com";
export const LIVE_HOSTNAMES = new Set(["tournibase.com", "www.tournibase.com"]);
export const TEST_HOSTNAME = "staging.tournibase.com";
export const LIVE_PLATFORM_FEE_BPS = 200;
export const LIVE_PLATFORM_FEE_FIXED_CENTS = 30;
export const TOURNIBASE_SUPABASE_PROJECT_REF = "khwaafsdtgiymucppkmo";
export const TOURNIBASE_SUPABASE_URL =
  `https://${TOURNIBASE_SUPABASE_PROJECT_REF}.supabase.co`;

export function isHostedDeployment(
  environment: EnvironmentVariables = process.env,
) {
  return environment.VERCEL === "1" || Boolean(environment.VERCEL_ENV);
}

export function getStripeEnvironmentFromKey(
  key: string | undefined,
): AppEnvironment | null {
  const value = key?.trim();

  if (!value) return null;
  if (value.startsWith("sk_live_") || value.startsWith("pk_live_")) {
    return "live";
  }
  if (value.startsWith("sk_test_") || value.startsWith("pk_test_")) {
    return "test";
  }

  return null;
}

export function getAppEnvironment(
  environment: EnvironmentVariables = process.env,
): AppEnvironment {
  const configured = environment.TOURNIBASE_APP_ENVIRONMENT?.trim();

  if (configured === "live" || configured === "test") {
    return configured;
  }

  if (configured) {
    throw new Error(
      'TOURNIBASE_APP_ENVIRONMENT must be either "live" or "test".',
    );
  }

  if (isHostedDeployment(environment)) {
    throw new Error(
      "TOURNIBASE_APP_ENVIRONMENT is required for hosted deployments.",
    );
  }

  const inferred =
    getStripeEnvironmentFromKey(environment.STRIPE_SECRET_KEY) ??
    getStripeEnvironmentFromKey(
      environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    );

  return inferred ?? "test";
}

export function assertStripeKeysMatchAppEnvironment(
  environment: EnvironmentVariables = process.env,
) {
  const appEnvironment = getAppEnvironment(environment);

  for (const [name, key] of [
    ["STRIPE_SECRET_KEY", environment.STRIPE_SECRET_KEY],
    [
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      environment.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    ],
  ] as const) {
    const value = key?.trim();
    if (!value) continue;

    const stripeEnvironment = getStripeEnvironmentFromKey(value);
    if (!stripeEnvironment) {
      throw new Error(`${name} does not have a supported Stripe key prefix.`);
    }

    if (stripeEnvironment !== appEnvironment) {
      throw new Error(
        `${name} is for Stripe ${stripeEnvironment} mode, but TourniBase is configured for ${appEnvironment}.`,
      );
    }
  }

  return appEnvironment;
}

export function isPaidCheckoutEnabled(
  environment: EnvironmentVariables = process.env,
) {
  const configured = environment.TOURNIBASE_PAID_CHECKOUT_ENABLED?.trim();

  if (configured === "true") return true;
  if (configured === "false") return false;

  if (configured) {
    throw new Error(
      'TOURNIBASE_PAID_CHECKOUT_ENABLED must be either "true" or "false".',
    );
  }

  if (isHostedDeployment(environment)) {
    throw new Error(
      "TOURNIBASE_PAID_CHECKOUT_ENABLED is required for hosted deployments.",
    );
  }

  return true;
}

export function assertPlatformFeeEnvironmentConfiguration(
  environment: EnvironmentVariables = process.env,
) {
  const appEnvironment = getAppEnvironment(environment);
  const basisPoints = readNonnegativeInteger(
    environment.TOURNIBASE_PLATFORM_FEE_BPS,
    "TOURNIBASE_PLATFORM_FEE_BPS",
  );
  const fixedCents = readNonnegativeInteger(
    environment.TOURNIBASE_PLATFORM_FEE_FIXED_CENTS,
    "TOURNIBASE_PLATFORM_FEE_FIXED_CENTS",
  );

  if (
    isHostedDeployment(environment) &&
    (!environment.TOURNIBASE_PLATFORM_FEE_BPS?.trim() ||
      !environment.TOURNIBASE_PLATFORM_FEE_FIXED_CENTS?.trim())
  ) {
    throw new Error(
      "Both TourniBase platform fee variables are required for hosted deployments.",
    );
  }

  if (appEnvironment === "test" && (basisPoints !== 0 || fixedCents !== 0)) {
    throw new Error("The TourniBase test environment must use a $0 platform fee.");
  }

  if (
    appEnvironment === "live" &&
    (basisPoints !== LIVE_PLATFORM_FEE_BPS ||
      fixedCents !== LIVE_PLATFORM_FEE_FIXED_CENTS)
  ) {
    throw new Error(
      `The TourniBase live environment must use a ${LIVE_PLATFORM_FEE_BPS} basis-point fee plus ${LIVE_PLATFORM_FEE_FIXED_CENTS} cents.`,
    );
  }

  return { basisPoints, fixedCents };
}

export function assertDeploymentTargetMatchesAppEnvironment(
  environment: EnvironmentVariables = process.env,
) {
  const appEnvironment = getAppEnvironment(environment);

  if (!isHostedDeployment(environment)) {
    return appEnvironment;
  }

  const vercelEnvironment = environment.VERCEL_ENV?.trim();
  const gitCommitRef = environment.VERCEL_GIT_COMMIT_REF?.trim();
  const configuredSiteUrl = environment.NEXT_PUBLIC_SITE_URL
    ?.trim()
    .replace(/\/+$/, "");
  const expectedSiteUrl =
    appEnvironment === "live" ? LIVE_SITE_URL : TEST_SITE_URL;

  if (!configuredSiteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for hosted deployments.");
  }

  if (configuredSiteUrl !== expectedSiteUrl) {
    throw new Error(
      `The ${appEnvironment} environment must use NEXT_PUBLIC_SITE_URL=${expectedSiteUrl}.`,
    );
  }

  if (vercelEnvironment === "production" && appEnvironment !== "live") {
    throw new Error("Vercel production must use the TourniBase live environment.");
  }

  if (appEnvironment === "live" && vercelEnvironment !== "production") {
    throw new Error(
      "The TourniBase live environment may run only as the Vercel production deployment.",
    );
  }

  if (appEnvironment === "test" && gitCommitRef !== "staging") {
    throw new Error(
      "The TourniBase test environment may run only from the staging branch.",
    );
  }

  if (appEnvironment === "test" && vercelEnvironment !== "preview") {
    throw new Error(
      "The TourniBase test environment may run only as a Vercel Preview deployment.",
    );
  }

  if (appEnvironment === "live" && gitCommitRef !== "main") {
    throw new Error(
      "The TourniBase live environment may run only from the main branch.",
    );
  }

  return appEnvironment;
}

export function assertRequestHostMatchesAppEnvironment(
  hostname: string,
  environment: EnvironmentVariables = process.env,
) {
  const appEnvironment = getAppEnvironment(environment);
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.$/, "");

  if (appEnvironment === "test" && LIVE_HOSTNAMES.has(normalizedHostname)) {
    throw new Error(
      "A TourniBase test deployment cannot serve a production hostname.",
    );
  }

  if (appEnvironment === "live" && normalizedHostname === TEST_HOSTNAME) {
    throw new Error(
      "A TourniBase live deployment cannot serve the staging hostname.",
    );
  }

  return appEnvironment;
}

export function getRequestHostname({
  fallbackHostname,
  forwardedHost,
  host,
}: {
  fallbackHostname: string;
  forwardedHost?: string | null;
  host?: string | null;
}) {
  const rawHostname =
    forwardedHost?.split(",", 1)[0]?.trim() || host?.trim() || fallbackHostname;

  try {
    return new URL(`http://${rawHostname}`).hostname;
  } catch {
    return rawHostname;
  }
}

export function isOfflinePassImageOptimizationSource(
  source: string | null | undefined,
) {
  if (!source) return false;

  let decodedSource = source;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const nextValue = decodeURIComponent(decodedSource);
      if (nextValue === decodedSource) break;
      decodedSource = nextValue;
    } catch {
      break;
    }
  }

  try {
    const pathname = new URL(decodedSource, TEST_SITE_URL).pathname;
    return /^\/p\/[^/]+\/offline-pass\.png\/?$/.test(pathname);
  } catch {
    return false;
  }
}

export function getEmailOverrideTo(
  environment: EnvironmentVariables = process.env,
) {
  return environment.TOURNIBASE_EMAIL_OVERRIDE_TO?.trim().toLowerCase() || null;
}

export function assertEmailEnvironmentConfiguration(
  environment: EnvironmentVariables = process.env,
) {
  const appEnvironment = getAppEnvironment(environment);
  const overrideTo = getEmailOverrideTo(environment);
  const provider = environment.EMAIL_PROVIDER?.trim().toLowerCase() || "disabled";

  if (isHostedDeployment(environment)) {
    if (provider !== "resend") {
      throw new Error(
        "Hosted TourniBase deployments must use EMAIL_PROVIDER=resend.",
      );
    }

    for (const name of ["RESEND_API_KEY", "EMAIL_FROM"] as const) {
      if (!environment[name]?.trim()) {
        throw new Error(`${name} is required for hosted email delivery.`);
      }
    }
  }

  if (appEnvironment === "live" && overrideTo) {
    throw new Error(
      "TOURNIBASE_EMAIL_OVERRIDE_TO must not be configured in the live environment.",
    );
  }

  if (
    appEnvironment === "test" &&
    provider === "resend" &&
    overrideTo !== TEST_EMAIL_RECIPIENT
  ) {
    throw new Error(
      `Test email delivery must set TOURNIBASE_EMAIL_OVERRIDE_TO to ${TEST_EMAIL_RECIPIENT}.`,
    );
  }

  return { appEnvironment, overrideTo };
}

export function assertSupabaseEnvironmentConfiguration(
  environment: EnvironmentVariables = process.env,
) {
  if (!isHostedDeployment(environment)) {
    return;
  }

  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
  ] as const) {
    if (!environment[name]?.trim()) {
      throw new Error(`${name} is required for hosted Supabase access.`);
    }
  }

  const configuredUrl = environment.NEXT_PUBLIC_SUPABASE_URL!
    .trim()
    .replace(/\/+$/, "");

  if (configuredUrl !== TOURNIBASE_SUPABASE_URL) {
    throw new Error(
      `Hosted TourniBase deployments must use the shared Supabase project ${TOURNIBASE_SUPABASE_PROJECT_REF}.`,
    );
  }
}

export function getExpectedStripePlatformAccountId(
  environment: EnvironmentVariables = process.env,
) {
  const accountId =
    environment.TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID?.trim() || null;

  if (!accountId) {
    if (isHostedDeployment(environment)) {
      throw new Error(
        "TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID is required for hosted deployments.",
      );
    }

    return null;
  }

  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) {
    throw new Error(
      "TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID must be a Stripe account ID.",
    );
  }

  return accountId;
}

export function requireExpectedStripePlatformAccountId(
  environment: EnvironmentVariables = process.env,
) {
  const accountId = getExpectedStripePlatformAccountId(environment);

  if (!accountId) {
    throw new Error(
      "TOURNIBASE_STRIPE_PLATFORM_ACCOUNT_ID is required before Stripe API operations.",
    );
  }

  return accountId;
}

export function assertStripePlatformAccountIdMatches(
  actualAccountId: string,
  environment: EnvironmentVariables = process.env,
) {
  const expectedAccountId = getExpectedStripePlatformAccountId(environment);

  if (expectedAccountId && actualAccountId !== expectedAccountId) {
    throw new Error(
      `Stripe key belongs to platform ${actualAccountId}, not configured platform ${expectedAccountId}.`,
    );
  }

  return expectedAccountId;
}

export function isPublicSignupEnabled(
  environment: EnvironmentVariables = process.env,
) {
  return !isHostedDeployment(environment) || getAppEnvironment(environment) === "live";
}

export function isDirectorLoginEmailAllowed(
  email: string,
  environment: EnvironmentVariables = process.env,
) {
  return (
    !isHostedDeployment(environment) ||
    getAppEnvironment(environment) === "live" ||
    email.trim().toLowerCase() === TEST_EMAIL_RECIPIENT
  );
}

export function getPublicSignupHref(
  environment: EnvironmentVariables = process.env,
) {
  return isPublicSignupEnabled(environment)
    ? "/signup"
    : `${LIVE_SITE_URL}/signup`;
}

export function validateAppRuntimeConfiguration(
  environment: EnvironmentVariables = process.env,
) {
  const appEnvironment = assertStripeKeysMatchAppEnvironment(environment);
  assertDeploymentTargetMatchesAppEnvironment(environment);
  const paidCheckoutEnabled = isPaidCheckoutEnabled(environment);
  const platformFee = assertPlatformFeeEnvironmentConfiguration(environment);
  const { overrideTo } = assertEmailEnvironmentConfiguration(environment);
  assertSupabaseEnvironmentConfiguration(environment);
  getExpectedStripePlatformAccountId(environment);

  if (isHostedDeployment(environment) && paidCheckoutEnabled) {
    for (const name of [
      "STRIPE_SECRET_KEY",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_CONNECTED_PAYMENTS_WEBHOOK_SECRET",
      "STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET",
    ] as const) {
      if (!environment[name]?.trim()) {
        throw new Error(`${name} is required when hosted paid checkout is enabled.`);
      }
    }
  }

  return {
    appEnvironment,
    emailOverrideTo: overrideTo,
    paidCheckoutEnabled,
    platformFee,
  };
}

export function scopeToAppEnvironment(
  value: string,
  environment: EnvironmentVariables = process.env,
) {
  return `${getAppEnvironment(environment)}:${value}`;
}

function readNonnegativeInteger(
  value: string | undefined,
  variableName: string,
) {
  const normalized = value?.trim();

  if (!normalized) return 0;
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${variableName} must be a nonnegative whole number.`);
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${variableName} is outside the supported range.`);
  }

  return parsed;
}
