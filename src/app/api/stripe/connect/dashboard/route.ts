import { NextResponse } from "next/server";
import {
  getOwnedOrganizationForStripeConnect,
  parseConnectReturnEvent,
  settingsUrl,
} from "@/lib/stripe-connect-director";
import { getOrganizationStripeAccount } from "@/lib/stripe-connect";
import { getStripeEnvironment } from "@/lib/stripe-connect-payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const organizationId = Number(formData.get("organizationId"));
  const event = parseConnectReturnEvent(formData.get("event"));
  const origin = new URL(request.url).origin;

  if (!Number.isSafeInteger(organizationId) || organizationId < 1) {
    return NextResponse.redirect(
      settingsUrl({
        event,
        origin,
        result: "invalid_organization",
      }),
      303,
    );
  }

  const ownership =
    await getOwnedOrganizationForStripeConnect(organizationId);
  const account = ownership
    ? await getOrganizationStripeAccount(organizationId)
    : null;

  if (!account) {
    return NextResponse.redirect(
      settingsUrl({
        event,
        origin,
        result: ownership ? "not_connected" : "not_authorized",
      }),
      303,
    );
  }

  const accountPath = encodeURIComponent(account.stripe_account_id);
  const dashboardUrl =
    getStripeEnvironment() === "test"
      ? `https://dashboard.stripe.com/test/${accountPath}/dashboard`
      : `https://dashboard.stripe.com/${accountPath}/dashboard`;

  return NextResponse.redirect(dashboardUrl, 303);
}
