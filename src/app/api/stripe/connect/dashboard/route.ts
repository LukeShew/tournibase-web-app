import { NextResponse } from "next/server";
import {
  getOwnedOrganizationForStripeConnect,
  parseConnectReturnEvent,
  settingsUrl,
} from "@/lib/stripe-connect-director";
import { createStripeDirectorDashboardUrl, getOrganizationStripeAccount } from "@/lib/stripe-connect";
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

  try {
    const dashboardUrl = await createStripeDirectorDashboardUrl({
      connectedAccountId: account.stripe_account_id,
      environment: getStripeEnvironment(),
    });
    const response = NextResponse.redirect(dashboardUrl, 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.redirect(settingsUrl({ event, origin, result: "dashboard_error" }), 303);
  }
}
