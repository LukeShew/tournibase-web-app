import { NextResponse } from "next/server";
import {
  getOwnedOrganizationForStripeConnect,
  parseConnectReturnEvent,
  settingsUrl,
} from "@/lib/stripe-connect-director";
import {
  createOrganizationStripeAccount,
  createStripeConnectOnboardingLink,
  getOrganizationStripeAccount,
  getStripeConnectConfigurationIssues,
  synchronizeOrganizationStripeAccount,
} from "@/lib/stripe-connect";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return startConnect({
    createIfMissing: false,
    event: parseConnectReturnEvent(url.searchParams.get("event")),
    organizationId: Number(url.searchParams.get("organization")),
    request,
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  return startConnect({
    createIfMissing: true,
    event: parseConnectReturnEvent(formData.get("event")),
    organizationId: Number(formData.get("organizationId")),
    request,
  });
}

async function startConnect({
  createIfMissing,
  event,
  organizationId,
  request,
}: {
  createIfMissing: boolean;
  event: string | null;
  organizationId: number;
  request: Request;
}) {
  const origin = new URL(request.url).origin;
  const fallbackUrl = settingsUrl({ event, origin });

  if (!Number.isSafeInteger(organizationId) || organizationId < 1) {
    fallbackUrl.searchParams.set("payments", "invalid_organization");
    return NextResponse.redirect(fallbackUrl, 303);
  }

  if (getStripeConnectConfigurationIssues().length > 0) {
    fallbackUrl.searchParams.set("payments", "configuration_error");
    return NextResponse.redirect(fallbackUrl, 303);
  }

  try {
    const ownership =
      await getOwnedOrganizationForStripeConnect(organizationId);

    if (!ownership) {
      fallbackUrl.searchParams.set("payments", "not_authorized");
      return NextResponse.redirect(fallbackUrl, 303);
    }

    const existingAccount =
      await getOrganizationStripeAccount(organizationId);
    if (!existingAccount && !createIfMissing) {
      fallbackUrl.searchParams.set("payments", "not_connected");
      return NextResponse.redirect(fallbackUrl, 303);
    }

    const account = existingAccount
      ? await synchronizeOrganizationStripeAccount(existingAccount)
      : await createOrganizationStripeAccount({
          contactEmail: ownership.director.email,
          displayName: ownership.organization.name,
          organizationId,
        });
    const siteUrl = getSiteUrl();
    const refreshUrl = new URL(
      "/api/stripe/connect/start",
      siteUrl,
    );
    const returnUrl = new URL(
      "/api/stripe/connect/refresh",
      siteUrl,
    );

    refreshUrl.searchParams.set("organization", String(organizationId));
    returnUrl.searchParams.set("organization", String(organizationId));
    returnUrl.searchParams.set("returned", "1");

    if (event) {
      refreshUrl.searchParams.set("event", event);
      returnUrl.searchParams.set("event", event);
    }

    const accountLink = await createStripeConnectOnboardingLink({
      accountId: account.stripe_account_id,
      refreshUrl: refreshUrl.toString(),
      returnUrl: returnUrl.toString(),
    });

    return NextResponse.redirect(accountLink.url, 303);
  } catch (error) {
    console.error("[stripe-connect-start] onboarding could not start", {
      message: error instanceof Error ? error.message : "Unknown error",
      organizationId,
    });
    fallbackUrl.searchParams.set("payments", "connect_error");
    return NextResponse.redirect(fallbackUrl, 303);
  }
}
